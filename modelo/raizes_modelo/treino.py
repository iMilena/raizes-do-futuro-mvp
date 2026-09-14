"""Treino do classificador.

    python -m raizes_modelo.treino
    python -m raizes_modelo.treino --config configuracao/treino.yaml

Grava em `execucoes/<nome>/`: melhor checkpoint, divisão dos dados, histórico
por época e a configuração usada. Tudo o que é preciso para alguém, meses
depois, saber o que produziu o modelo que está no celular do catador.

A métrica que decide o melhor checkpoint é F1 macro, não acurácia. Com 1338
fotos de `outros` e 583 de vidro, um modelo que ignorasse vidro ainda teria
acurácia respeitável, e seria inútil justamente na classe que a operação vende.
F1 macro trata as cinco classes como igualmente importantes, que é como a
operação as trata.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader

from .arquitetura import congelar_tronco, construir, contar_parametros, dispositivo, parametros_em_grupos
from .classes import CLASSES
from .configuracao import carregar, fixar_semente
from .conjunto_torch import (
    ConjuntoColeta, pesos_por_classe, transformacao_avaliacao, transformacao_treino,
)
from .dados.montar import dividir, resumir, salvar_divisao
from .metricas import f1_macro, matriz_confusao, relatorio_por_classe


def _carregadores(cfg, particoes):
    m = cfg["modelo"]
    t = cfg["treino"]
    treino_tf = transformacao_treino(m["tamanho_entrada"], m["media"], m["desvio"])
    aval_tf = transformacao_avaliacao(m["tamanho_entrada"], m["media"], m["desvio"])

    conjuntos = {
        "treino": ConjuntoColeta(particoes["treino"], treino_tf),
        "validacao": ConjuntoColeta(particoes["validacao"], aval_tf),
        "teste": ConjuntoColeta(particoes["teste"], aval_tf),
    }
    # `num_workers=0` no Windows: o spawn de processo custa mais que o ganho em
    # conjunto deste tamanho, e trava com frequência em notebook.
    trabalhadores = 0 if __import__("sys").platform == "win32" else t["trabalhadores_dados"]
    carregadores = {
        "treino": DataLoader(conjuntos["treino"], batch_size=t["lote"], shuffle=True,
                             num_workers=trabalhadores, drop_last=False),
        "validacao": DataLoader(conjuntos["validacao"], batch_size=t["lote"], shuffle=False,
                                num_workers=trabalhadores),
        "teste": DataLoader(conjuntos["teste"], batch_size=t["lote"], shuffle=False,
                            num_workers=trabalhadores),
    }
    return conjuntos, carregadores


@torch.no_grad()
def avaliar(rede, carregador, dispositivo_, criterio) -> tuple[float, list[int], list[int], list[list[float]]]:
    rede.eval()
    perda_total, n = 0.0, 0
    verdadeiros: list[int] = []
    preditos: list[int] = []
    logits_todos: list[list[float]] = []

    for imagens, rotulos in carregador:
        imagens, rotulos = imagens.to(dispositivo_), rotulos.to(dispositivo_)
        saida = rede(imagens)
        perda_total += criterio(saida, rotulos).item() * rotulos.size(0)
        n += rotulos.size(0)
        verdadeiros.extend(rotulos.cpu().tolist())
        preditos.extend(saida.argmax(1).cpu().tolist())
        logits_todos.extend(saida.cpu().tolist())

    return (perda_total / max(1, n)), verdadeiros, preditos, logits_todos


def treinar(cfg, nome_execucao: str) -> Path:
    fixar_semente(cfg["semente"])
    dev = dispositivo()
    print(f"dispositivo: {dev}")

    particoes = dividir(
        cfg.dir_dados / "conjunto", cfg.classes,
        cfg["dados"]["divisao"], cfg["semente"], cfg["dados"]["max_por_classe"],
    )
    print("divisão:", json.dumps(resumir(particoes), ensure_ascii=False))

    dir_execucao = cfg.caminho("execucoes", nome_execucao)
    dir_execucao.mkdir(parents=True, exist_ok=True)
    salvar_divisao(particoes, dir_execucao / "divisao.json")
    (dir_execucao / "configuracao-usada.json").write_text(
        json.dumps(cfg.bruto, indent=2, ensure_ascii=False), encoding="utf-8")

    conjuntos, carregadores = _carregadores(cfg, particoes)
    if len(conjuntos["treino"]) == 0:
        raise SystemExit("conjunto de treino vazio: rode `python -m raizes_modelo.dados.preparar` antes")

    m, t = cfg["modelo"], cfg["treino"]
    rede = construir(m["arquitetura"], len(cfg.classes), m["pesos_iniciais"]).to(dev)
    print(f"parâmetros: {contar_parametros(rede):,}")

    pesos = pesos_por_classe(conjuntos["treino"].contagem_por_classe()).to(dev) \
        if t["pesos_por_classe"] else None
    # label_smoothing baixo: além de regularizar, evita que a rede produza
    # confiança 0.999 em tudo, o que estragaria a calibração do limiar do app.
    criterio = nn.CrossEntropyLoss(weight=pesos, label_smoothing=0.05)

    otimizador = torch.optim.AdamW(
        parametros_em_grupos(rede, t["taxa_aprendizado"], t["taxa_aprendizado_tronco"]),
        weight_decay=t["decaimento_peso"],
    )
    agendador = torch.optim.lr_scheduler.CosineAnnealingLR(otimizador, T_max=t["epocas"])

    melhor_f1, melhor_epoca = -1.0, -1
    historico: list[dict] = []
    caminho_melhor = dir_execucao / "melhor.pt"
    inicio = time.time()

    for epoca in range(1, t["epocas"] + 1):
        so_cabeca = epoca <= t["epocas_so_cabeca"]
        congelar_tronco(rede, so_cabeca)

        rede.train()
        perda_treino, vistos = 0.0, 0
        for imagens, rotulos in carregadores["treino"]:
            imagens, rotulos = imagens.to(dev), rotulos.to(dev)
            otimizador.zero_grad(set_to_none=True)
            saida = rede(imagens)
            perda = criterio(saida, rotulos)
            perda.backward()
            otimizador.step()
            perda_treino += perda.item() * rotulos.size(0)
            vistos += rotulos.size(0)
        agendador.step()

        perda_val, verdadeiros, preditos, _ = avaliar(rede, carregadores["validacao"], dev, criterio)
        f1 = f1_macro(verdadeiros, preditos, len(cfg.classes))
        acuracia = sum(int(a == b) for a, b in zip(verdadeiros, preditos)) / max(1, len(verdadeiros))

        historico.append({
            "epoca": epoca, "so_cabeca": so_cabeca,
            "perda_treino": perda_treino / max(1, vistos), "perda_validacao": perda_val,
            "f1_macro": f1, "acuracia": acuracia,
        })
        marca = ""
        if f1 > melhor_f1:
            melhor_f1, melhor_epoca = f1, epoca
            torch.save({
                "estado": rede.state_dict(), "arquitetura": m["arquitetura"],
                "classes": cfg.classes, "epoca": epoca, "f1_macro": f1,
                "tamanho_entrada": m["tamanho_entrada"], "media": m["media"], "desvio": m["desvio"],
            }, caminho_melhor)
            marca = "  <- melhor"

        print(f"época {epoca:2d}/{t['epocas']}  perda_tr {historico[-1]['perda_treino']:.4f}  "
              f"perda_val {perda_val:.4f}  acurácia {acuracia:.3f}  F1 macro {f1:.3f}{marca}")

        if epoca - melhor_epoca >= t["paciencia"]:
            print(f"parando cedo: {t['paciencia']} épocas sem melhora no F1 macro")
            break

    (dir_execucao / "historico.json").write_text(
        json.dumps(historico, indent=2, ensure_ascii=False), encoding="utf-8")

    # Relatório rápido no teste, com o melhor checkpoint. O relatório completo,
    # com matriz de confusão e calibração, sai de `avaliacao.py`.
    rede.load_state_dict(torch.load(caminho_melhor, map_location=dev)["estado"])
    _, verdadeiros, preditos, _ = avaliar(rede, carregadores["teste"], dev, criterio)
    print(f"\nmelhor época: {melhor_epoca} (F1 macro de validação {melhor_f1:.3f})")
    print(f"tempo total: {(time.time() - inicio) / 60:.1f} min")
    print("\n--- teste ---")
    for linha in relatorio_por_classe(verdadeiros, preditos, CLASSES):
        print(f"  {linha['classe']:10s} precisão {linha['precisao']:.3f}  "
              f"revocação {linha['revocacao']:.3f}  F1 {linha['f1']:.3f}  n={linha['suporte']}")
    print("\nmatriz de confusão (linha = verdadeiro, coluna = predito):")
    for classe, linha in zip(CLASSES, matriz_confusao(verdadeiros, preditos, len(CLASSES))):
        print(f"  {classe:10s} {linha}")

    print(f"\ncheckpoint em {caminho_melhor}")
    return caminho_melhor


def principal() -> None:
    p = argparse.ArgumentParser(description="Treina o classificador de material reciclável")
    p.add_argument("--config", default=None)
    p.add_argument("--nome", default="padrao", help="nome da execução, vira pasta em execucoes/")
    args = p.parse_args()
    treinar(carregar(args.config), args.nome)


if __name__ == "__main__":
    principal()
