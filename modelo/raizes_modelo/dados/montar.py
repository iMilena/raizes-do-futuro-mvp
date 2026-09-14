"""Divisão em treino, validação e teste.

Três cuidados que fazem a diferença entre uma métrica honesta e uma mentira
bonita:

1. ESTRATIFICADA. Cada parte recebe a mesma proporção de classes do todo. Sem
   isso, com 583 fotos de vidro num conjunto de 4.500, o teste pode acabar com
   trinta vidros e a acurácia da classe vira ruído.

2. DETERMINÍSTICA POR NOME DE ARQUIVO. A parte de cada foto é decidida por hash
   do nome, não por embaralhamento. Assim, acrescentar as fotos de Boipeba
   depois não remaneja o que já estava: uma foto que era de teste continua sendo
   de teste, e a métrica nova continua comparável com a antiga.

3. TETO POR CLASSE. Aplicado antes da divisão, e sempre pegando as mesmas fotos
   (as primeiras na ordem do hash), para o corte também ser reproduzível.
"""
from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from pathlib import Path

Particao = dict[str, list[Path]]


def _fracao_do_nome(nome: str, semente: int) -> float:
    """Número estável entre 0 e 1 a partir do nome do arquivo."""
    digest = hashlib.sha256(f"{semente}:{nome}".encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") / 2**64


def listar_por_classe(dir_conjunto: Path, classes: list[str]) -> dict[str, list[Path]]:
    por_classe: dict[str, list[Path]] = {}
    for classe in classes:
        pasta = dir_conjunto / classe
        por_classe[classe] = sorted(pasta.glob("*.jpg")) if pasta.exists() else []
    return por_classe


def dividir(
    dir_conjunto: Path,
    classes: list[str],
    proporcoes: dict[str, float],
    semente: int,
    max_por_classe: int | None = None,
) -> dict[str, Particao]:
    """Devolve {'treino': {classe: [caminhos]}, 'validacao': ..., 'teste': ...}."""
    p_treino = proporcoes["treino"]
    p_validacao = proporcoes["validacao"]
    partes: dict[str, Particao] = {
        "treino": defaultdict(list), "validacao": defaultdict(list), "teste": defaultdict(list),
    }

    for classe, arquivos in listar_por_classe(dir_conjunto, classes).items():
        # Ordena pelo hash para o teto por classe não favorecer uma fonte:
        # em ordem alfabética, cortar em 2500 tiraria todo o TrashNet ou todo o TACO.
        ordenados = sorted(arquivos, key=lambda p: _fracao_do_nome(p.name, semente))
        if max_por_classe:
            ordenados = ordenados[:max_por_classe]

        for arquivo in ordenados:
            f = _fracao_do_nome(arquivo.name, semente + 1)
            if f < p_treino:
                partes["treino"][classe].append(arquivo)
            elif f < p_treino + p_validacao:
                partes["validacao"][classe].append(arquivo)
            else:
                partes["teste"][classe].append(arquivo)

    return {nome: dict(parte) for nome, parte in partes.items()}


def resumir(partes: dict[str, Particao]) -> dict[str, dict[str, int]]:
    return {
        nome: {classe: len(arquivos) for classe, arquivos in sorted(parte.items())}
        for nome, parte in partes.items()
    }


def salvar_divisao(partes: dict[str, Particao], destino: Path) -> None:
    """Grava a divisão em disco.

    Serve para auditoria do treino: dá para conferir depois exatamente quais
    fotos treinaram o modelo que está no ar, e para reproduzir o mesmo treino
    mesmo que a pasta ganhe fotos novas.
    """
    dados = {
        nome: {classe: [str(p.name) for p in arquivos] for classe, arquivos in parte.items()}
        for nome, parte in partes.items()
    }
    destino.write_text(json.dumps(dados, indent=2, ensure_ascii=False), encoding="utf-8")
