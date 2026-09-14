"""Leitura da configuração e fixação da semente.

Duas coisas que todo script do pipeline faz antes de qualquer outra, e que
portanto não podem estar copiadas em cinco arquivos.
"""
from __future__ import annotations

import os
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

RAIZ = Path(__file__).resolve().parent.parent
PADRAO = RAIZ / "configuracao" / "treino.yaml"


@dataclass(frozen=True)
class Config:
    bruto: dict[str, Any]

    def __getitem__(self, chave: str) -> Any:
        return self.bruto[chave]

    def caminho(self, *partes: str) -> Path:
        """Resolve caminho relativo à pasta modelo/, para o script rodar de qualquer lugar."""
        return (RAIZ / Path(*partes)).resolve()

    @property
    def dir_dados(self) -> Path:
        return self.caminho(self.bruto["dados"]["diretorio"])

    @property
    def classes(self) -> list[str]:
        return list(self.bruto["classes"])


def carregar(caminho: str | Path | None = None) -> Config:
    arquivo = Path(caminho) if caminho else PADRAO
    with open(arquivo, encoding="utf-8") as f:
        return Config(yaml.safe_load(f))


def fixar_semente(semente: int) -> None:
    """Fixa tudo o que o pipeline usa de aleatório.

    `cudnn.deterministic` também entra, mesmo o treino sendo em CPU: quem
    retreinar com GPU herda a mesma execução reproduzível sem precisar lembrar
    de ligar isso à mão.
    """
    random.seed(semente)
    os.environ["PYTHONHASHSEED"] = str(semente)
    try:
        import numpy as np

        np.random.seed(semente)
    except ImportError:
        pass
    try:
        import torch

        torch.manual_seed(semente)
        torch.cuda.manual_seed_all(semente)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False
    except ImportError:
        pass
