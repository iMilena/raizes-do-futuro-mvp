"""Exportação para ONNX, quantização int8 e o JSON que o app lê.

    python -m raizes_modelo.exportar --execucao padrao

Sai em public/modelo/: classificador.onnx, classificador-fp32.onnx e
classificador.json.

Três decisões que este arquivo toma:

1. A TEMPERATURA VAI EMBUTIDA. O modelo exportado devolve probabilidade já
   calibrada, não logits. Se a temperatura ficasse do lado do JavaScript, o dia
   em que alguém reexportasse o modelo sem atualizar o app produziria confiança
   errada, e confiança errada move o limiar de revisão humana sem ninguém ver.

2. QUANTIZAÇÃO ESTÁTICA, NÃO DINÂMICA. Em rede convolucional a dinâmica quase
   não quantiza as convoluções, que é onde está o peso: o arquivo encolhe pouco.
   A estática precisa de imagens de calibração (usamos as do treino) e quantiza
   de verdade.

3. O FP32 TAMBÉM É EXPORTADO, E A QUANTIZAÇÃO PRECISA PASSAR NUMA PROVA. O
   `comparar` mede tamanho, latência e, principalmente, concordância entre as
   duas versões. Abaixo de `concordancia_minima`, o int8 é descartado e o app
   recebe o fp32.

   Isso não é precaução teórica. Com a MobileNetV3-Small treinada aqui, a
   quantização pós-treino QUEBRA o modelo: 5% de concordância com o original, e
   nenhum erro levantado. Foram testadas as variantes (per-channel, reduce_range,
   u8u8, s8s8 simétrico, e exclusão das convoluções profundas e dos blocos
   squeeze-and-excite); a melhor ficou em 60%, ainda inaceitável. Quantizar só o
   Gemm preserva 100%, e é o que sobra de ganho seguro.

   A causa é conhecida: hardswish e squeeze-and-excite produzem faixas de
   ativação que a calibração estática não representa bem. A saída de verdade é
   treino consciente de quantização (QAT), que é trabalho de outra ordem. O fp32
   tem 6.1 MB, cabe no alvo de 10 MB do módulo, e roda em 15 ms no navegador,
   então a decisão prática é seguir com ele e deixar a prova montada para quando
   alguém tentar de novo.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn

from .arquitetura import construir
from .classes import ROTULOS
from .configuracao import carregar
from .conjunto_torch import ConjuntoColeta, transformacao_avaliacao
from .dados.montar import dividir


class ClassificadorExportavel(nn.Module):
    """A rede mais a calibração, num módulo só.

    Entrada: NCHW float32 já normalizado (o app faz a normalização, com os
    números que viajam no classificador.json).
    Saída: vetor de probabilidades por classe, na ordem de CLASSES.
    """

    def __init__(self, rede: nn.Module, temperatura: float) -> None:
        super().__init__()
        self.rede = rede
        # Buffer e não atributo: assim a temperatura vira constante no grafo ONNX.
        self.register_buffer("temperatura", torch.tensor(float(temperatura)))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return torch.softmax(self.rede(x) / self.temperatura, dim=1)


class LeitorCalibracao:
    """Alimenta o quantizador com imagens reais do conjunto de treino.

    Imagens de verdade, e não ruído aleatório: a quantização estática escolhe a
    escala de cada camada olhando a distribuição de ativação, e ruído produz
    distribuição que nenhuma foto de coleta gera. O modelo sairia menor e pior.
    """

    def __init__(self, amostras: list[np.ndarray], nome_entrada: str) -> None:
        self.todas = amostras
        self.nome_entrada = nome_entrada
        self.iterador = iter(amostras)

    def get_next(self):
        proximo = next(self.iterador, None)
        return None if proximo is None else {self.nome_entrada: proximo}

    def rewind(self) -> None:
        """Rebobina.

        O quantizador percorre as amostras mais de uma vez (uma para descobrir a
        faixa de cada tensor, outra para conferir). Um leitor que se esgota
        devolve None na segunda passada, o quantizador conclui que não há dados,
        e as escalas saem de um intervalo vazio: o modelo fica quebrado sem que
        nenhuma exceção seja levantada.
        """
        self.iterador = iter(self.todas)


def amostras_de_calibracao(cfg, quantidade: int = 200) -> list[np.ndarray]:
    m = cfg["modelo"]
    particoes = dividir(
        cfg.dir_dados / "conjunto", cfg.classes,
        cfg["dados"]["divisao"], cfg["semente"], cfg["dados"]["max_por_classe"],
    )
    conjunto = ConjuntoColeta(
        particoes["treino"], transformacao_avaliacao(m["tamanho_entrada"], m["media"], m["desvio"]))

    # Passo constante em vez das N primeiras: as primeiras seriam quase todas da
    # mesma classe, e a escala sairia enviesada para ela.
    passo = max(1, len(conjunto) // quantidade)
    amostras = []
    for i in range(0, len(conjunto), passo):
        if len(amostras) >= quantidade:
            break
        imagem, _ = conjunto[i]
        amostras.append(imagem.unsqueeze(0).numpy())
    return amostras


def exportar_onnx(modelo: nn.Module, tamanho: int, destino: Path, opset: int) -> Path:
    modelo.eval()
    exemplo = torch.randn(1, 3, tamanho, tamanho)
    destino.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(
        modelo, exemplo, str(destino),
        input_names=["imagem"], output_names=["probabilidades"],
        # Lote dinâmico: o app manda uma foto por vez, mas a avaliação em massa
        # (e o teste de paridade) manda muitas, e reexportar por causa disso seria bobo.
        dynamic_axes={"imagem": {0: "lote"}, "probabilidades": {0: "lote"}},
        opset_version=opset, do_constant_folding=True,
    )
    return destino


def quantizar(
    origem: Path, destino: Path, amostras: list[np.ndarray],
    tipos: list[str] | None = None,
) -> Path:
    """Quantiza estaticamente, só nas operações que valem a pena.

    `op_types_to_quantize` restrito a Conv e Gemm não é economia de escopo, é
    correção: a MobileNetV3 usa hardswish e blocos squeeze-and-excite, cujas
    faixas de ativação são largas e assimétricas. Quantizando tudo, o modelo sai
    do forno com 5% de concordância com o original, isto é, quebrado, e sem dar
    erro nenhum.

    Conv e Gemm concentram quase todo o peso do arquivo, então o ganho de tamanho
    permanece. O resto do grafo continua em fp32.

    `comparar()` existe justamente para isto ser verificado, e não presumido.
    """
    from onnxruntime.quantization import CalibrationMethod, QuantFormat, QuantType, quantize_static
    from onnxruntime.quantization.shape_inference import quant_pre_process

    preparado = origem.with_name(origem.stem + "-preparado.onnx")
    quant_pre_process(str(origem), str(preparado), skip_symbolic_shape=False)

    import onnxruntime as ort
    nome_entrada = ort.InferenceSession(str(preparado)).get_inputs()[0].name

    quantize_static(
        str(preparado), str(destino),
        LeitorCalibracao(amostras, nome_entrada),
        quant_format=QuantFormat.QDQ,
        # Pesos em int8 simétrico, ativações em uint8: é a combinação que o
        # runtime de WebAssembly executa melhor.
        weight_type=QuantType.QInt8,
        activation_type=QuantType.QUInt8,
        calibrate_method=CalibrationMethod.MinMax,
        per_channel=True,
        op_types_to_quantize=tipos or ["Conv", "Gemm"],
    )
    preparado.unlink(missing_ok=True)
    return destino


def comparar(caminho_fp32: Path, caminho_int8: Path, amostras: list[np.ndarray]) -> dict:
    """Mede tamanho, latência e concordância entre as duas versões.

    A concordância é o número que decide se a quantização pode ir para campo:
    encolher o arquivo não vale nada se o modelo passar a chamar vidro de PET.
    """
    import onnxruntime as ort

    resultado: dict = {}
    saidas: dict[str, np.ndarray] = {}

    for nome, caminho in (("fp32", caminho_fp32), ("int8", caminho_int8)):
        if not caminho.exists():
            continue
        sessao = ort.InferenceSession(str(caminho), providers=["CPUExecutionProvider"])
        entrada = sessao.get_inputs()[0].name

        sessao.run(None, {entrada: amostras[0]})  # aquecimento: a primeira inferência mede o carregamento
        tempos = []
        for amostra in amostras[:50]:
            inicio = time.perf_counter()
            saida = sessao.run(None, {entrada: amostra})[0]
            tempos.append((time.perf_counter() - inicio) * 1000)
        saidas[nome] = np.vstack([sessao.run(None, {entrada: a})[0] for a in amostras[:100]])

        tempos.sort()
        resultado[nome] = {
            "tamanho_mb": round(caminho.stat().st_size / 1e6, 2),
            "latencia_mediana_ms": round(tempos[len(tempos) // 2], 1),
            "latencia_p95_ms": round(tempos[int(len(tempos) * 0.95)], 1),
        }

    if "fp32" in saidas and "int8" in saidas:
        iguais = (saidas["fp32"].argmax(1) == saidas["int8"].argmax(1)).mean()
        resultado["concordancia_int8_fp32"] = round(float(iguais), 4)
        resultado["desvio_maximo_confianca"] = round(float(np.abs(saidas["fp32"] - saidas["int8"]).max()), 4)
    return resultado


def exportar_execucao(cfg, nome_execucao: str) -> dict:
    dir_execucao = cfg.caminho("execucoes", nome_execucao)
    checkpoint = torch.load(dir_execucao / "melhor.pt", map_location="cpu")

    arquivo_calibracao = dir_execucao / "calibracao.json"
    if arquivo_calibracao.exists():
        calibracao = json.loads(arquivo_calibracao.read_text(encoding="utf-8"))
    else:
        # Sem avaliação rodada, exporta sem calibrar e diz isso em voz alta: o
        # limiar do app estaria apoiado em confiança não verificada.
        print("AVISO: calibracao.json não existe. Rode `python -m raizes_modelo.avaliacao` "
              "antes de exportar, ou o app usará confiança não calibrada.")
        calibracao = {"temperatura": 1.0, "limiar": cfg["limiar"]["confianca_minima"]}

    m, e = cfg["modelo"], cfg["exportacao"]
    rede = construir(m["arquitetura"], len(cfg.classes), None)
    rede.load_state_dict(checkpoint["estado"])
    modelo = ClassificadorExportavel(rede, calibracao["temperatura"])

    saida = cfg.caminho(e["saida"])
    saida.mkdir(parents=True, exist_ok=True)
    caminho_fp32 = saida / "classificador-fp32.onnx"
    caminho_int8 = saida / "classificador.onnx"

    print(f"exportando ONNX (opset {e['opset']})...")
    exportar_onnx(modelo, m["tamanho_entrada"], caminho_fp32, e["opset"])

    amostras = amostras_de_calibracao(cfg)
    if e["quantizar_int8"]:
        print(f"quantizando com {len(amostras)} imagens de calibração...")
        quantizar(caminho_fp32, caminho_int8, amostras, e.get("tipos_quantizados"))
    else:
        caminho_int8.write_bytes(caminho_fp32.read_bytes())

    medidas = comparar(caminho_fp32, caminho_int8, amostras)

    # A quantização só vai para campo se concordar com o original. Abaixo do
    # mínimo, o arquivo quantizado é descartado e o app recebe o fp32: modelo
    # menor que classifica errado não é otimização, é regressão silenciosa. O app
    # continuaria respondendo, com confiança alta, trocando vidro por PET.
    concordancia = medidas.get("concordancia_int8_fp32", 1.0)
    minimo = e.get("concordancia_minima", 0.97)
    if e["quantizar_int8"] and concordancia < minimo:
        print(f"\nQUANTIZAÇÃO DESCARTADA: concordância de {concordancia:.1%} com o modelo "
              f"original, abaixo do mínimo de {minimo:.0%}. O app vai receber o fp32.")
        caminho_int8.write_bytes(caminho_fp32.read_bytes())
        medidas = comparar(caminho_fp32, caminho_int8, amostras)
        medidas["quantizacao"] = "descartada por baixa concordância"
    elif e["quantizar_int8"]:
        medidas["quantizacao"] = f"int8 estática, concordância {concordancia:.1%}"

    versao = f"{m['arquitetura']}-{nome_execucao}-e{checkpoint['epoca']}"
    manifesto = {
        "versao": versao,
        "arquivo": "classificador.onnx",
        "classes": cfg.classes,
        "rotulos": [ROTULOS[c] for c in cfg.classes],
        "tamanho_entrada": m["tamanho_entrada"],
        "normalizacao": {"media": m["media"], "desvio": m["desvio"]},
        "saida": "probabilidades",
        "temperatura_embutida": calibracao["temperatura"],
        "limiar_confianca": calibracao["limiar"],
        "medidas": medidas,
        "exportado_em": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }
    (saida / "classificador.json").write_text(
        json.dumps(manifesto, indent=2, ensure_ascii=False), encoding="utf-8")

    print("\n--- exportado ---")
    for nome, dados in medidas.items():
        print(f"  {nome}: {dados}")
    limite = e["tamanho_maximo_mb"]
    tamanho = medidas.get("int8", {}).get("tamanho_mb", 0)
    if tamanho > limite:
        print(f"\nATENÇÃO: {tamanho} MB passa do alvo de {limite} MB do módulo.")
    print(f"\nmanifesto em {saida / 'classificador.json'}")
    return manifesto


def principal() -> None:
    p = argparse.ArgumentParser(description="Exporta o modelo para ONNX quantizado")
    p.add_argument("--config", default=None)
    p.add_argument("--execucao", default="padrao")
    args = p.parse_args()
    exportar_execucao(carregar(args.config), args.execucao)


if __name__ == "__main__":
    principal()
