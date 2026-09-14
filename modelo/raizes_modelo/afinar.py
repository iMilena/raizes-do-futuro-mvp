"""Fine-tune com as fotos reais de Boipeba.

    python -m raizes_modelo.afinar --execucao boipeba-01

As fotos da ilha ainda não existem, e este arquivo existe antes delas de
propósito: o caminho de retreino precisa estar pronto e documentado para que,
quando as primeiras centenas de fotos chegarem, ninguém tenha de reinventar o
procedimento no meio da operação.

Duas decisões que definem este script:

1. MISTURA COM OS DADOS PÚBLICOS. Treinar só com as fotos novas produz
   esquecimento catastrófico: em poucas épocas o modelo passa a acertar bem o
   que se parece com o último mês de coleta e a errar tudo o mais. A
   `proporcao_dados_publicos` mantém parte do TACO e do TrashNet na mistura.

2. TAXA DE APRENDIZADO BAIXA, E TRONCO LIVRE. Ao contrário do treino do zero,
   aqui a cabeça já sabe o que faz. O que precisa mudar são os filtros do meio,
   que nunca viram areia molhada nem lona azul, e mudar pouco.

A fonte mais valiosa de fotos é o próprio app: todo registro com
`corrigidoPorHumano: true` é uma foto que o modelo errou, com o rótulo certo
dado por quem estava lá na hora. Exportar essas fotos do aparelho é uma decisão
de operação (e de consentimento), não deste script.
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader

from .arquitetura import construir, dispositivo, parametros_em_grupos
from .classes import CLASSES
from .configuracao import carregar, fixar_semente
from .conjunto_torch import (
    ConjuntoColeta, pesos_por_classe, transformacao_avaliacao, transformacao_treino,
)
from .dados.montar import dividir, listar_por_classe, resumir
from .metricas import f1_macro, relatorio_por_classe
from .treino import avaliar


def _misturar(
    publicas: dict[str, list[Path]],
    boipeba: dict[str, list[Path]],
    proporcao: float,
    semente: int,
) -> dict[str, list[Path]]:
    """Junta as fotos novas com uma amostra das públicas.

    A amostra é proporcional ao tamanho do conjunto novo, classe por classe: com
    `proporcao 0.5` e 200 fotos novas de PET, entram 100 públicas de PET. Assim o
    modelo continua vendo o que já sabia sem afogar as fotos que importam.
    """
    aleatorio = random.Random(semente)
    saida: dict[str, list[Path]] = {}
    for classe in boipeba.keys() | publicas.keys():
        novas = boipeba.get(classe, [])
        antigas = publicas.get(classe, [])
        quantas = min(len(antigas), int(len(novas) * proporcao))
        saida[classe] = [*novas, *aleatorio.sample(antigas, quantas)]
    return saida


def afinar(cfg, nome_execucao: str, base: str) -> Path:
    fixar_semente(cfg["semente"])
    dev = dispositivo()

    a = cfg["afinamento"]
    dir_boipeba = cfg.caminho(a["diretorio_fotos"])
    if not dir_boipeba.exists():
        raise SystemExit(
            f"não achei as fotos de Boipeba em {dir_boipeba}.\n"
            "Organize-as em <classe>/*.jpg (as mesmas classes do projeto) e rode de novo."
        )

    fotos_boipeba = listar_por_classe(dir_boipeba, cfg.classes)
    total_novas = sum(len(v) for v in fotos_boipeba.values())
    if total_novas == 0:
        raise SystemExit(f"{dir_boipeba} existe mas está vazia")
    print(f"fotos de Boipeba: {total_novas} ({ {c: len(v) for c, v in fotos_boipeba.items()} })")

    # A divisão das fotos novas usa a mesma função determinística do treino: o
    # teste continua sendo teste, e a comparação antes/depois fica honesta.
    particoes_novas = dividir(
        dir_boipeba, cfg.classes, cfg["dados"]["divisao"], cfg["semente"])
    particoes_publicas = dividir(
        cfg.dir_dados / "conjunto", cfg.classes,
        cfg["dados"]["divisao"], cfg["semente"], cfg["dados"]["max_por_classe"])

    treino = _misturar(
        particoes_publicas["treino"], particoes_novas["treino"],
        a["proporcao_dados_publicos"], cfg["semente"])
    print("mistura de treino:", {c: len(v) for c, v in sorted(treino.items())})
    print("validação (só Boipeba):", resumir({"v": particoes_novas["validacao"]})["v"])

    m = cfg["modelo"]
    treino_tf = transformacao_treino(m["tamanho_entrada"], m["media"], m["desvio"])
    aval_tf = transformacao_avaliacao(m["tamanho_entrada"], m["media"], m["desvio"])
    conjunto_treino = ConjuntoColeta(treino, treino_tf)

    trabalhadores = 0 if __import__("sys").platform == "win32" else cfg["treino"]["trabalhadores_dados"]
    carregador_treino = DataLoader(
        conjunto_treino, batch_size=cfg["treino"]["lote"], shuffle=True, num_workers=trabalhadores)
    # A validação e o teste são SÓ de Boipeba: o que interessa medir agora é o
    # desempenho na ilha, não no dataset público.
    carregador_val = DataLoader(
        ConjuntoColeta(particoes_novas["validacao"], aval_tf), batch_size=32, num_workers=trabalhadores)
    carregador_teste = DataLoader(
        ConjuntoColeta(particoes_novas["teste"], aval_tf), batch_size=32, num_workers=trabalhadores)

    checkpoint = torch.load(cfg.caminho("execucoes", base, "melhor.pt"), map_location=dev)
    rede = construir(m["arquitetura"], len(cfg.classes), None).to(dev)
    rede.load_state_dict(checkpoint["estado"])

    criterio = nn.CrossEntropyLoss(
        weight=pesos_por_classe(conjunto_treino.contagem_por_classe()).to(dev),
        label_smoothing=0.05)
    otimizador = torch.optim.AdamW(
        parametros_em_grupos(rede, a["taxa_aprendizado"], a["taxa_aprendizado"] / 5),
        weight_decay=cfg["treino"]["decaimento_peso"])

    dir_execucao = cfg.caminho("execucoes", nome_execucao)
    dir_execucao.mkdir(parents=True, exist_ok=True)
    caminho_melhor = dir_execucao / "melhor.pt"

    # Marco zero: como o modelo base vai nas fotos de Boipeba, antes de afinar.
    _, v0, p0, _ = avaliar(rede, carregador_teste, dev, criterio)
    f1_antes = f1_macro(v0, p0, len(cfg.classes))
    print(f"\nF1 macro do modelo base nas fotos de Boipeba: {f1_antes:.3f}")

    melhor_f1, historico = -1.0, []
    for epoca in range(1, a["epocas"] + 1):
        rede.train()
        perda_total, vistos = 0.0, 0
        for imagens, rotulos in carregador_treino:
            imagens, rotulos = imagens.to(dev), rotulos.to(dev)
            otimizador.zero_grad(set_to_none=True)
            perda = criterio(rede(imagens), rotulos)
            perda.backward()
            otimizador.step()
            perda_total += perda.item() * rotulos.size(0)
            vistos += rotulos.size(0)

        _, verdadeiros, preditos, _ = avaliar(rede, carregador_val, dev, criterio)
        f1 = f1_macro(verdadeiros, preditos, len(cfg.classes))
        historico.append({"epoca": epoca, "perda_treino": perda_total / max(1, vistos), "f1_macro": f1})

        marca = ""
        if f1 > melhor_f1:
            melhor_f1 = f1
            torch.save({
                "estado": rede.state_dict(), "arquitetura": m["arquitetura"],
                "classes": cfg.classes, "epoca": epoca, "f1_macro": f1,
                "tamanho_entrada": m["tamanho_entrada"], "media": m["media"], "desvio": m["desvio"],
                "afinado_de": base,
            }, caminho_melhor)
            marca = "  <- melhor"
        print(f"época {epoca:2d}/{a['epocas']}  perda {historico[-1]['perda_treino']:.4f}  "
              f"F1 macro {f1:.3f}{marca}")

    rede.load_state_dict(torch.load(caminho_melhor, map_location=dev)["estado"])
    _, v1, p1, _ = avaliar(rede, carregador_teste, dev, criterio)
    f1_depois = f1_macro(v1, p1, len(cfg.classes))

    print(f"\n--- fotos de Boipeba, no teste ---")
    print(f"F1 macro: {f1_antes:.3f} (base) -> {f1_depois:.3f} (afinado)")
    for linha in relatorio_por_classe(v1, p1, CLASSES):
        print(f"  {linha['classe']:10s} precisão {linha['precisao']:.3f}  "
              f"revocação {linha['revocacao']:.3f}  n={linha['suporte']}")
    if f1_depois <= f1_antes:
        print("\nATENÇÃO: o fine-tune não melhorou. Antes de exportar, confira se há fotos "
              "suficientes por classe e se os rótulos estão certos. Modelo pior em campo é "
              "pior que modelo velho.")

    (dir_execucao / "historico.json").write_text(
        json.dumps({"antes": f1_antes, "depois": f1_depois, "epocas": historico},
                   indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\ncheckpoint em {caminho_melhor}")
    print("Próximos passos: `avaliacao` para recalibrar o limiar, depois `exportar`.")
    return caminho_melhor


def principal() -> None:
    p = argparse.ArgumentParser(description="Afina o modelo com as fotos reais de Boipeba")
    p.add_argument("--config", default=None)
    p.add_argument("--execucao", default="boipeba-01", help="nome da execução nova")
    p.add_argument("--base", default="padrao", help="execução de onde vem o checkpoint inicial")
    args = p.parse_args()
    afinar(carregar(args.config), args.execucao, args.base)


if __name__ == "__main__":
    principal()
