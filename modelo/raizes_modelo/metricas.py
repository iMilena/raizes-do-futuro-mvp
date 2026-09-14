"""Métricas escritas à mão, sem scikit-learn no caminho crítico.

Não é preciosismo: são vinte linhas de aritmética, o pipeline fica com uma
dependência a menos para quem for retreinar num computador com internet ruim, e
principalmente as métricas ficam auditáveis. Quem lê o relatório de avaliação
consegue conferir a conta aqui, e é esse relatório que vai para investidor e
para empresa compradora.

(`scikit-learn` continua nos requisitos: `calibracao.py` usa a regressão
isotônica dele, que aí sim não vale reimplementar.)
"""
from __future__ import annotations

from collections.abc import Sequence


def matriz_confusao(verdadeiros: Sequence[int], preditos: Sequence[int], n_classes: int) -> list[list[int]]:
    """Linha é a classe verdadeira, coluna é a predita."""
    matriz = [[0] * n_classes for _ in range(n_classes)]
    for v, p in zip(verdadeiros, preditos):
        matriz[v][p] += 1
    return matriz


def relatorio_por_classe(
    verdadeiros: Sequence[int], preditos: Sequence[int], classes: Sequence[str],
) -> list[dict]:
    """Precisão, revocação, F1 e suporte, classe por classe.

    As duas dizem coisas diferentes para a operação:
      · precisão baixa em PET: o app chama de PET o que não é, e o fardo vai
        contaminado para o comprador
      · revocação baixa em PET: o app deixa de reconhecer PET de verdade, e o
        catador tem de corrigir à mão o tempo todo
    """
    matriz = matriz_confusao(verdadeiros, preditos, len(classes))
    linhas = []
    for i, nome in enumerate(classes):
        acertos = matriz[i][i]
        preditos_i = sum(matriz[j][i] for j in range(len(classes)))
        verdadeiros_i = sum(matriz[i])
        precisao = acertos / preditos_i if preditos_i else 0.0
        revocacao = acertos / verdadeiros_i if verdadeiros_i else 0.0
        f1 = 2 * precisao * revocacao / (precisao + revocacao) if (precisao + revocacao) else 0.0
        linhas.append({
            "classe": nome, "precisao": precisao, "revocacao": revocacao,
            "f1": f1, "suporte": verdadeiros_i,
        })
    return linhas


def f1_macro(verdadeiros: Sequence[int], preditos: Sequence[int], n_classes: int) -> float:
    """Média simples do F1 das classes.

    Simples, e não ponderada pelo tamanho: as cinco classes valem o mesmo para a
    operação, mesmo que `outros` tenha o dobro de exemplos de `vidro`.
    """
    nomes = [str(i) for i in range(n_classes)]
    linhas = relatorio_por_classe(verdadeiros, preditos, nomes)
    return sum(l["f1"] for l in linhas) / max(1, len(linhas))


def acuracia(verdadeiros: Sequence[int], preditos: Sequence[int]) -> float:
    if not verdadeiros:
        return 0.0
    return sum(int(a == b) for a, b in zip(verdadeiros, preditos)) / len(verdadeiros)


def erro_calibracao_esperado(confiancas: Sequence[float], acertos: Sequence[bool], n_faixas: int = 10) -> float:
    """ECE: o quanto a confiança do modelo mente.

    Divide as predições em faixas de confiança e compara, em cada faixa, a
    confiança média com a taxa de acerto real. ECE de 0.15 quer dizer que,
    quando o modelo diz 90%, ele acerta por volta de 75%.

    É a métrica que decide o limiar do app. Um modelo descalibrado com limiar
    em 0.70 manda para revisão humana o conjunto errado de registros: ou afoga a
    coordenação em fila, ou deixa passar erro dizendo ter certeza.
    """
    if not confiancas:
        return 0.0
    total = len(confiancas)
    ece = 0.0
    for faixa in range(n_faixas):
        baixo, alto = faixa / n_faixas, (faixa + 1) / n_faixas
        indices = [i for i, c in enumerate(confiancas) if (baixo < c <= alto) or (faixa == 0 and c == 0)]
        if not indices:
            continue
        conf_media = sum(confiancas[i] for i in indices) / len(indices)
        acerto_medio = sum(1 for i in indices if acertos[i]) / len(indices)
        ece += (len(indices) / total) * abs(conf_media - acerto_medio)
    return ece


def curva_confiabilidade(
    confiancas: Sequence[float], acertos: Sequence[bool], n_faixas: int = 10,
) -> list[dict]:
    """Pontos do gráfico de calibração: confiança média contra acerto real."""
    pontos = []
    for faixa in range(n_faixas):
        baixo, alto = faixa / n_faixas, (faixa + 1) / n_faixas
        indices = [i for i, c in enumerate(confiancas) if (baixo < c <= alto) or (faixa == 0 and c == 0)]
        pontos.append({
            "faixa": f"{baixo:.1f} a {alto:.1f}",
            "meio": (baixo + alto) / 2,
            "n": len(indices),
            "confianca_media": (sum(confiancas[i] for i in indices) / len(indices)) if indices else None,
            "acerto_real": (sum(1 for i in indices if acertos[i]) / len(indices)) if indices else None,
        })
    return pontos
