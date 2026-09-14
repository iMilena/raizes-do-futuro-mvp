"""Calibração da confiança, e escolha do limiar de revisão humana.

Por que isto não é opcional neste projeto: o número que o app mostra ao catador
("92% PET") e o limiar que manda um registro para revisão humana são a mesma
coisa. Rede neural treinada com entropia cruzada é sistematicamente confiante
demais: diz 95% e acerta 80%. Com um modelo assim, limiar de 0.70 deixa passar
sozinho um monte de erro, e a coordenação nunca fica sabendo.

Duas etapas:

1. TEMPERATURA. Divide os logits por um escalar T antes do softmax, e acha o T
   que minimiza a perda no conjunto de VALIDAÇÃO (nunca no de teste: o teste
   tem de continuar sendo terra virgem). T > 1 espalha a distribuição, isto é,
   reduz a confiança exagerada. É um parâmetro só, então não há como piorar a
   acurácia: a ordem das classes não muda, só a confiança declarada.

2. LIMIAR. Com a confiança já honesta, escolhe o menor limiar em que a precisão
   do que é classificado automaticamente atinge a meta. Abaixo dele, revisão
   humana. O relatório mostra também quanto da fila isso manda para a
   coordenação, porque limiar alto demais é uma decisão de operação, não de
   estatística: alguém tem de revisar.
"""
from __future__ import annotations

import math
from collections.abc import Sequence


def softmax(logits: Sequence[float], temperatura: float = 1.0) -> list[float]:
    escalados = [x / temperatura for x in logits]
    maior = max(escalados)
    exponenciais = [math.exp(x - maior) for x in escalados]
    total = sum(exponenciais)
    return [e / total for e in exponenciais]


def perda_log(logits: Sequence[Sequence[float]], rotulos: Sequence[int], temperatura: float) -> float:
    """Entropia cruzada média com a temperatura aplicada."""
    total = 0.0
    for linha, rotulo in zip(logits, rotulos):
        probabilidade = softmax(linha, temperatura)[rotulo]
        total -= math.log(max(probabilidade, 1e-12))
    return total / max(1, len(rotulos))


def achar_temperatura(
    logits: Sequence[Sequence[float]],
    rotulos: Sequence[int],
    minimo: float = 0.25,
    maximo: float = 10.0,
    passos: int = 60,
) -> float:
    """Busca ternária pelo T que minimiza a perda.

    Busca ternária e não gradiente: a função é unimodal em T, são 60 avaliações
    de uma conta barata, e assim o módulo não depende de otimizador nenhum.
    """
    baixo, alto = minimo, maximo
    for _ in range(passos):
        t1 = baixo + (alto - baixo) / 3
        t2 = alto - (alto - baixo) / 3
        if perda_log(logits, rotulos, t1) < perda_log(logits, rotulos, t2):
            alto = t2
        else:
            baixo = t1
    return round((baixo + alto) / 2, 4)


def confiancas_e_acertos(
    logits: Sequence[Sequence[float]], rotulos: Sequence[int], temperatura: float = 1.0,
) -> tuple[list[float], list[bool], list[int]]:
    confiancas: list[float] = []
    acertos: list[bool] = []
    preditos: list[int] = []
    for linha, rotulo in zip(logits, rotulos):
        probabilidades = softmax(linha, temperatura)
        predito = max(range(len(probabilidades)), key=lambda i: probabilidades[i])
        confiancas.append(probabilidades[predito])
        acertos.append(predito == rotulo)
        preditos.append(predito)
    return confiancas, acertos, preditos


def analisar_limiares(
    confiancas: Sequence[float], acertos: Sequence[bool], limiares: Sequence[float],
) -> list[dict]:
    """Para cada limiar: quanto fica automático, com que precisão, e quanto sobra
    para revisão humana."""
    total = len(confiancas)
    linhas = []
    for limiar in limiares:
        automaticos = [i for i, c in enumerate(confiancas) if c >= limiar]
        certos = sum(1 for i in automaticos if acertos[i])
        linhas.append({
            "limiar": round(limiar, 2),
            "cobertura": len(automaticos) / total if total else 0.0,
            "precisao_automatica": certos / len(automaticos) if automaticos else 1.0,
            "para_revisao": (total - len(automaticos)) / total if total else 0.0,
            "erros_que_passam": len(automaticos) - certos,
        })
    return linhas


def escolher_limiar(
    confiancas: Sequence[float],
    acertos: Sequence[bool],
    precisao_alvo: float = 0.95,
    limiar_maximo: float = 0.95,
) -> tuple[float, dict]:
    """Menor limiar que atinge a precisão alvo no que é classificado sozinho.

    Menor, e não o mais seguro: cada ponto a mais de limiar é mais fila na mesa
    da coordenação, e coordenação afogada revisa mal, o que anula o ganho.

    Se nem o limiar máximo atinge a meta, devolve o máximo e o relatório mostra
    a precisão que deu. Nesse caso a resposta certa não é apertar o limiar, é
    melhorar o modelo com as fotos reais de Boipeba.
    """
    limiares = [i / 100 for i in range(50, int(limiar_maximo * 100) + 1)]
    analise = analisar_limiares(confiancas, acertos, limiares)
    for linha in analise:
        if linha["precisao_automatica"] >= precisao_alvo:
            return linha["limiar"], linha
    return analise[-1]["limiar"], analise[-1]
