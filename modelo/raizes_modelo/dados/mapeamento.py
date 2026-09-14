"""De categoria de dataset público para classe que o projeto opera.

Esta é a tradução mais importante do pipeline, e a mais fácil de errar em
silêncio: se "Drink can" cair em `outros`, o modelo simplesmente nunca aprende
alumínio e ninguém percebe até o catador reclamar que o app erra sempre a lata.

Por isso o mapa é explícito, categoria por categoria, e não uma heurística por
palavra no nome. E por isso existe teste conferindo que toda categoria do TACO
tem destino declarado.

Decisões que valem registrar:

  · TrashNet `plastic` vira PET. O conjunto é dominado por garrafa e copo de
    bebida, que é o que a operação chama de PET. Plástico mole (sacola, filme)
    quase não aparece lá, e vem do TACO como `outros`.
  · Papel vira `papelao`. O projeto vende fibra celulósica em fardo único, papel
    de escritório junto com caixa. Separar criaria uma classe que a operação não
    usa, e um erro de classificação sem consequência nenhuma.
  · Tampa, canudo, bituca e isopor vão para `outros`, mesmo sendo plástico. Não
    têm valor de venda no fluxo atual, e misturá-los com PET ensinaria o modelo
    a marcar como PET material que não gera receita.
"""
from __future__ import annotations

# ------------------------------------------------------------------ TrashNet --
# Pastas do dataset-resized.zip.
TRASHNET: dict[str, str] = {
    "plastic": "PET",
    "metal": "aluminio",
    "glass": "vidro",
    "cardboard": "papelao",
    "paper": "papelao",   # ver nota no topo; `papel_como_papelao: false` manda para outros
    "trash": "outros",
}

TRASHNET_PAPEL_SEPARADO: dict[str, str] = {**TRASHNET, "paper": "outros"}

# ---------------------------------------------------------------------- TACO --
# Nomes exatos das 60 categorias do annotations.json (formato COCO).
TACO: dict[str, str] = {
    # PET: garrafa de bebida transparente e afins
    "Clear plastic bottle": "PET",
    "Other plastic bottle": "PET",
    "Plastic bottle cap": "outros",
    # alumínio: lata e folha
    "Drink can": "aluminio",
    "Food Can": "aluminio",
    "Aluminium foil": "aluminio",
    "Pop tab": "aluminio",
    "Metal bottle cap": "aluminio",
    "Aluminium blister pack": "outros",
    "Scrap metal": "outros",
    "Metal lid": "aluminio",
    # vidro
    "Glass bottle": "vidro",
    "Broken glass": "vidro",
    "Glass jar": "vidro",
    "Glass cup": "vidro",
    # papel e papelão
    "Corrugated carton": "papelao",
    "Drink carton": "papelao",
    "Egg carton": "papelao",
    "Meal carton": "papelao",
    "Pizza box": "papelao",
    "Toilet tube": "papelao",
    "Other carton": "papelao",
    "Paper cup": "papelao",
    "Paper bag": "papelao",
    "Normal paper": "papelao",
    "Magazine paper": "papelao",
    "Wrapping paper": "papelao",
    "Tissues": "papelao",
    "Paper straw": "outros",
    # resto: sem valor de venda no fluxo atual
    "Plastic bag & wrapper": "outros",
    "Single-use carrier bag": "outros",
    "Polypropylene bag": "outros",
    "Crisp packet": "outros",
    "Spread tub": "outros",
    "Tupperware": "outros",
    "Disposable food container": "outros",
    "Foam food container": "outros",
    "Other plastic container": "outros",
    "Plastic glooves": "outros",
    "Plastic utensils": "outros",
    "Plastic film": "outros",
    "Six pack rings": "outros",
    "Garbage bag": "outros",
    "Other plastic wrapper": "outros",
    "Other plastic": "outros",
    "Plastic lid": "outros",
    "Plastic straw": "outros",
    "Styrofoam piece": "outros",
    "Foam cup": "outros",
    "Other plastic cup": "outros",
    "Disposable plastic cup": "outros",
    "Squeezable tube": "outros",
    "Rope & strings": "outros",
    "Shoe": "outros",
    "Battery": "outros",
    "Cigarette": "outros",
    "Food waste": "outros",
    "Unlabeled litter": "outros",
    "Carded blister pack": "outros",
    # Lata de aerossol é metal, mas não entra no fardo de alumínio: resíduo
    # pressurizado com resto de produto é recusado pelo comprador, e ensinar o
    # modelo a chamar isso de alumínio contaminaria a classe que gera receita.
    "Aerosol": "outros",
    # Papel plastificado é fibra com filme colado. Não vai no fardo de papelão
    # pelo mesmo motivo: o comprador desconta ou recusa a carga.
    "Plastified paper bag": "outros",
    "Meal carton lid": "papelao",
    "Other carton lid": "papelao",
}


def da_trashnet(pasta: str, papel_como_papelao: bool = True) -> str | None:
    """Classe de uma pasta do TrashNet, ou None se a pasta não interessa."""
    mapa = TRASHNET if papel_como_papelao else TRASHNET_PAPEL_SEPARADO
    return mapa.get(pasta.lower())


def do_taco(categoria: str) -> str:
    """Classe de uma categoria do TACO.

    Categoria desconhecida cai em `outros` em vez de quebrar o download: o TACO
    recebe categoria nova de vez em quando, e derrubar um download de 1500
    imagens por causa de um nome novo seria desproporcional. O teste de
    cobertura é que garante que o mapa está completo hoje.
    """
    return TACO.get(categoria, "outros")
