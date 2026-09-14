"""Classes de material do projeto, e a ordem canônica delas.

A ordem é contrato: é a ordem dos neurônios de saída do modelo, a ordem do
vetor de confiança no ONNX e a ordem da lista no classificador.json que o app
lê. Trocar a ordem aqui sem reexportar o modelo faz o app chamar vidro de PET,
em silêncio.
"""
from __future__ import annotations

CLASSES: tuple[str, ...] = ("PET", "aluminio", "vidro", "papelao", "outros")

INDICE_POR_CLASSE: dict[str, int] = {nome: i for i, nome in enumerate(CLASSES)}

# Como cada classe aparece para o catador na tela. Fica aqui, e não no app,
# para o rótulo humano e o rótulo do modelo nunca saírem de sincronia.
ROTULOS: dict[str, str] = {
    "PET": "Plástico PET",
    "aluminio": "Alumínio",
    "vidro": "Vidro",
    "papelao": "Papelão",
    "outros": "Outros",
}


def indice(classe: str) -> int:
    if classe not in INDICE_POR_CLASSE:
        raise ValueError(f"classe fora do projeto: {classe!r}. Esperado uma de {CLASSES}")
    return INDICE_POR_CLASSE[classe]
