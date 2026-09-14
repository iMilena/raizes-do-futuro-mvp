"""Relatório de avaliação do modelo.

    python -m raizes_modelo.avaliacao --execucao padrao

Gera em relatorios/: metricas.json, matriz-confusao.png e calibracao.png.

Este relatório não é documento interno. É o que vai junto quando alguém
perguntar "como vocês sabem que a validação funciona", e a resposta precisa ser
número por classe, não acurácia média. Por isso o JSON traz precisão e revocação
separadas, a matriz inteira, e o erro de calibração: quem audita precisa poder
discordar da nossa leitura olhando os mesmos dados.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from .arquitetura import construir, dispositivo
from .calibracao import achar_temperatura, analisar_limiares, confiancas_e_acertos, escolher_limiar
from .configuracao import carregar
from .conjunto_torch import ConjuntoColeta, transformacao_avaliacao
from .dados.montar import dividir
from .metricas import (
    acuracia, curva_confiabilidade, erro_calibracao_esperado, f1_macro,
    matriz_confusao, relatorio_por_classe,
)


@torch.no_grad()
def coletar_logits(rede, carregador, dev) -> tuple[list[list[float]], list[int]]:
    rede.eval()
    logits: list[list[float]] = []
    rotulos: list[int] = []
    for imagens, alvos in carregador:
        saida = rede(imagens.to(dev))
        logits.extend(saida.cpu().tolist())
        rotulos.extend(alvos.tolist())
    return logits, rotulos


def desenhar_matriz(matriz: list[list[int]], classes: list[str], destino: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    # Normalizada por linha: o que interessa é "de todo vidro de verdade, quanto
    # o modelo chamou de vidro", e a contagem crua esconde isso quando as classes
    # têm tamanhos diferentes. Os números absolutos aparecem dentro da celula.
    fig, eixo = plt.subplots(figsize=(6.5, 5.5))
    normalizada = [
        [celula / max(1, sum(linha)) for celula in linha] for linha in matriz
    ]
    imagem = eixo.imshow(normalizada, cmap="Greens", vmin=0, vmax=1)

    eixo.set_xticks(range(len(classes)), classes, rotation=30, ha="right")
    eixo.set_yticks(range(len(classes)), classes)
    eixo.set_xlabel("classificado como")
    eixo.set_ylabel("material de verdade")
    eixo.set_title("Matriz de confusão (proporção da linha)")

    for i in range(len(classes)):
        for j in range(len(classes)):
            cor = "white" if normalizada[i][j] > 0.55 else "#1b3a26"
            eixo.text(j, i, f"{normalizada[i][j]:.0%}\n({matriz[i][j]})",
                      ha="center", va="center", color=cor, fontsize=9)

    fig.colorbar(imagem, ax=eixo, fraction=0.046)
    fig.tight_layout()
    fig.savefig(destino, dpi=140)
    plt.close(fig)


def desenhar_calibracao(pontos: list[dict], ece: float, destino: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, eixo = plt.subplots(figsize=(5.5, 5.5))
    eixo.plot([0, 1], [0, 1], "--", color="#9aa", label="calibração perfeita")

    xs = [p["confianca_media"] for p in pontos if p["n"] > 0]
    ys = [p["acerto_real"] for p in pontos if p["n"] > 0]
    eixo.plot(xs, ys, "o-", color="#2e5a3e", label="modelo")

    eixo.set_xlabel("confiança declarada pelo modelo")
    eixo.set_ylabel("acerto real")
    eixo.set_title(f"Curva de calibração (ECE {ece:.3f})")
    eixo.set_xlim(0, 1)
    eixo.set_ylim(0, 1)
    eixo.legend(loc="upper left")
    eixo.grid(alpha=0.25)
    fig.tight_layout()
    fig.savefig(destino, dpi=140)
    plt.close(fig)


def _temperatura_util(logits, rotulos) -> float:
    """Acha a temperatura, e só a aceita se ela melhorar a calibração.

    A busca minimiza a perda logarítmica, que é o procedimento clássico, mas não
    é a mesma coisa que minimizar o erro de calibração: um modelo já treinado com
    label smoothing pode sair calibrado, e nesse caso a temperatura "ótima" pela
    perda piora levemente o ECE.

    Isso importa porque o ECE é o que sustenta o limiar de revisão humana. A
    comparação é feita na VALIDAÇÃO, nunca no teste.
    """
    candidata = achar_temperatura(logits, rotulos)

    conf_um, acertos_um, _ = confiancas_e_acertos(logits, rotulos, 1.0)
    conf_cand, acertos_cand, _ = confiancas_e_acertos(logits, rotulos, candidata)
    ece_um = erro_calibracao_esperado(conf_um, acertos_um)
    ece_cand = erro_calibracao_esperado(conf_cand, acertos_cand)

    if ece_cand < ece_um:
        return candidata
    print(f"temperatura {candidata} descartada: o ECE de validação iria de "
          f"{ece_um:.3f} para {ece_cand:.3f}. Fica em 1.0.")
    return 1.0


def avaliar_execucao(cfg, nome_execucao: str) -> dict:
    dev = dispositivo()
    dir_execucao = cfg.caminho("execucoes", nome_execucao)
    checkpoint = torch.load(dir_execucao / "melhor.pt", map_location=dev)

    m = cfg["modelo"]
    rede = construir(m["arquitetura"], len(cfg.classes), None).to(dev)
    rede.load_state_dict(checkpoint["estado"])

    particoes = dividir(
        cfg.dir_dados / "conjunto", cfg.classes,
        cfg["dados"]["divisao"], cfg["semente"], cfg["dados"]["max_por_classe"],
    )
    transformacao = transformacao_avaliacao(m["tamanho_entrada"], m["media"], m["desvio"])
    carregadores = {
        parte: DataLoader(ConjuntoColeta(particoes[parte], transformacao), batch_size=32)
        for parte in ("validacao", "teste")
    }

    # Temperatura sai da VALIDAÇÃO. Ajustá-la no teste seria usar o teste duas
    # vezes, e o número final deixaria de significar o que diz significar.
    logits_val, rotulos_val = coletar_logits(rede, carregadores["validacao"], dev)
    temperatura = _temperatura_util(logits_val, rotulos_val)

    logits_teste, rotulos_teste = coletar_logits(rede, carregadores["teste"], dev)
    conf_cru, acertos_cru, preditos = confiancas_e_acertos(logits_teste, rotulos_teste, 1.0)
    conf_cal, acertos_cal, _ = confiancas_e_acertos(logits_teste, rotulos_teste, temperatura)

    ece_cru = erro_calibracao_esperado(conf_cru, acertos_cru)
    ece_cal = erro_calibracao_esperado(conf_cal, acertos_cal)

    # O limiar também sai da validação, pelo mesmo motivo da temperatura.
    conf_val, acertos_val, _ = confiancas_e_acertos(logits_val, rotulos_val, temperatura)
    limiar, detalhe_limiar = escolher_limiar(conf_val, acertos_val, precisao_alvo=0.95)

    relatorio = {
        "execucao": nome_execucao,
        "arquitetura": checkpoint["arquitetura"],
        "epoca_do_checkpoint": checkpoint["epoca"],
        "classes": cfg.classes,
        "tamanho_entrada": m["tamanho_entrada"],
        "teste": {
            "n": len(rotulos_teste),
            "acuracia": acuracia(rotulos_teste, preditos),
            "f1_macro": f1_macro(rotulos_teste, preditos, len(cfg.classes)),
            "por_classe": relatorio_por_classe(rotulos_teste, preditos, cfg.classes),
            "matriz_confusao": matriz_confusao(rotulos_teste, preditos, len(cfg.classes)),
        },
        "calibracao": {
            "temperatura": temperatura,
            "ece_sem_calibracao": ece_cru,
            "ece_calibrado": ece_cal,
            "curva": curva_confiabilidade(conf_cal, acertos_cal),
        },
        "limiar": {
            "escolhido": limiar,
            "precisao_alvo": 0.95,
            "efeito_na_validacao": detalhe_limiar,
            "tabela": analisar_limiares(conf_val, acertos_val, [0.5, 0.6, 0.7, 0.8, 0.9, 0.95]),
        },
    }

    destino = cfg.caminho("relatorios")
    destino.mkdir(parents=True, exist_ok=True)
    (destino / "metricas.json").write_text(
        json.dumps(relatorio, indent=2, ensure_ascii=False), encoding="utf-8")
    desenhar_matriz(relatorio["teste"]["matriz_confusao"], cfg.classes, destino / "matriz-confusao.png")
    desenhar_calibracao(relatorio["calibracao"]["curva"], ece_cal, destino / "calibracao.png")

    # A temperatura e o limiar precisam viajar com o modelo: é `exportar.py` que
    # os embute no ONNX e no classificador.json que o app lê.
    (dir_execucao / "calibracao.json").write_text(
        json.dumps({"temperatura": temperatura, "limiar": limiar}, indent=2), encoding="utf-8")

    return relatorio


def imprimir(relatorio: dict) -> None:
    teste = relatorio["teste"]
    print(f"\n=== {relatorio['execucao']} | {teste['n']} fotos de teste ===")
    print(f"acurácia {teste['acuracia']:.3f}   F1 macro {teste['f1_macro']:.3f}\n")
    print(f"{'classe':10s} {'precisão':>9s} {'revocação':>10s} {'F1':>6s} {'n':>5s}")
    for linha in teste["por_classe"]:
        print(f"{linha['classe']:10s} {linha['precisao']:9.3f} {linha['revocacao']:10.3f} "
              f"{linha['f1']:6.3f} {linha['suporte']:5d}")

    cal = relatorio["calibracao"]
    print(f"\ncalibração: T = {cal['temperatura']}   "
          f"ECE {cal['ece_sem_calibracao']:.3f} -> {cal['ece_calibrado']:.3f}")

    lim = relatorio["limiar"]
    efeito = lim["efeito_na_validacao"]
    print(f"limiar escolhido: {lim['escolhido']}  "
          f"(classifica sozinho {efeito['cobertura']:.0%} com precisão {efeito['precisao_automatica']:.1%}, "
          f"manda {efeito['para_revisao']:.0%} para revisão humana)")
    print("\nmatriz de confusão (linha = verdadeiro):")
    for classe, linha in zip(relatorio["classes"], teste["matriz_confusao"]):
        print(f"  {classe:10s} {linha}")


def principal() -> None:
    p = argparse.ArgumentParser(description="Avalia o modelo treinado e gera o relatório")
    p.add_argument("--config", default=None)
    p.add_argument("--execucao", default="padrao")
    args = p.parse_args()
    imprimir(avaliar_execucao(carregar(args.config), args.execucao))


if __name__ == "__main__":
    principal()
