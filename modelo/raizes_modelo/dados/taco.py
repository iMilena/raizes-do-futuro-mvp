"""TACO: lixo fotografado no chão, anotado em COCO com caixa por objeto.

Por que o TACO importa aqui, mesmo dando mais trabalho que o TrashNet: as fotos
do TrashNet são de estúdio, objeto único sobre fundo branco. A foto que o
catador tira é material no chão, na areia, contra a luz, com sombra e sujeira.
O TACO é o dataset público que mais se parece com isso.

Por que só um subconjunto: as imagens não vêm no repositório, vêm uma a uma do
Flickr, e parte dos links já morreu. Baixar as 1500 leva tempo, baixar as 4784
leva muito mais, e a curva de ganho por imagem já achatou bem antes disso.

O recorte é feito pela caixa da anotação: a foto original tem vários objetos de
categorias diferentes, e treinar classificador com a imagem inteira ensinaria o
modelo a adivinhar a categoria mais comum do cenário.
"""
from __future__ import annotations

import json
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image
from tqdm import tqdm

from .mapeamento import do_taco


def baixar_anotacoes(url: str, destino: Path) -> Path:
    destino.mkdir(parents=True, exist_ok=True)
    arquivo = destino / "annotations.json"
    if arquivo.exists() and arquivo.stat().st_size > 100_000:
        print(f"[taco] anotações já estão em {arquivo}")
        return arquivo
    print(f"[taco] baixando anotações de {url}")
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    arquivo.write_bytes(r.content)
    return arquivo


def _url_da_imagem(img: dict) -> str | None:
    """A versão de 640 px basta: o recorte ainda é reduzido para 224, e baixar o
    original de 4 MB seria desperdício de banda e de tempo."""
    return img.get("flickr_640_url") or img.get("flickr_url") or None


def _escolher_imagens(anotacoes: dict, maximo: int) -> list[dict]:
    """Escolhe as imagens a baixar priorizando as que trazem classe rara.

    Pegar as `maximo` primeiras seria mais simples, e traria uma montanha de
    plástico com quase nenhum vidro, que é justamente a classe que o modelo mais
    erra. Aqui cada imagem é pontuada pela raridade das classes que ela contém.
    """
    por_categoria = {c["id"]: c["name"] for c in anotacoes["categories"]}
    classes_por_imagem: dict[int, set[str]] = defaultdict(set)
    for an in anotacoes["annotations"]:
        nome = por_categoria.get(an["category_id"], "")
        classes_por_imagem[an["image_id"]].add(do_taco(nome))

    frequencia: dict[str, int] = defaultdict(int)
    for classes in classes_por_imagem.values():
        for c in classes:
            frequencia[c] += 1

    def pontuacao(img: dict) -> float:
        classes = classes_por_imagem.get(img["id"], set())
        if not classes:
            return 0.0
        return sum(1.0 / frequencia[c] for c in classes)

    imagens = [i for i in anotacoes["images"] if _url_da_imagem(i)]
    imagens.sort(key=lambda i: (-pontuacao(i), i["id"]))  # id desempata, para ser determinístico
    return imagens[:maximo]


def _recortar(imagem: Image.Image, bbox: list[float], margem: float) -> Image.Image | None:
    x, y, larg, alt = bbox
    mx, my = larg * margem, alt * margem
    caixa = (
        max(0, int(x - mx)), max(0, int(y - my)),
        min(imagem.width, int(x + larg + mx)), min(imagem.height, int(y + alt + my)),
    )
    if caixa[2] <= caixa[0] or caixa[3] <= caixa[1]:
        return None
    return imagem.crop(caixa)


def preparar(
    url_anotacoes: str,
    dir_dados: Path,
    max_imagens: int = 1500,
    trabalhadores: int = 12,
    margem: float = 0.12,
    area_minima: int = 4096,
) -> dict[str, int]:
    bruto = dir_dados / "bruto" / "taco"
    saida = dir_dados / "conjunto"
    arquivo = baixar_anotacoes(url_anotacoes, bruto)
    anotacoes = json.loads(arquivo.read_text(encoding="utf-8"))

    por_categoria = {c["id"]: c["name"] for c in anotacoes["categories"]}
    anotacoes_por_imagem: dict[int, list[dict]] = defaultdict(list)
    for an in anotacoes["annotations"]:
        anotacoes_por_imagem[an["image_id"]].append(an)

    escolhidas = _escolher_imagens(anotacoes, max_imagens)
    print(f"[taco] {len(escolhidas)} imagens escolhidas de {len(anotacoes['images'])}")

    contagem: dict[str, int] = defaultdict(int)
    falhas = 0

    def processar(img: dict) -> tuple[dict[str, int], bool]:
        local: dict[str, int] = defaultdict(int)
        url = _url_da_imagem(img)
        try:
            r = requests.get(url, timeout=30)
            r.raise_for_status()
            original = Image.open(BytesIO(r.content)).convert("RGB")
        except Exception:
            return local, False

        # O 640_url vem redimensionado, e as caixas estão na escala do original.
        escala_x = original.width / img["width"]
        escala_y = original.height / img["height"]

        for an in anotacoes_por_imagem[img["id"]]:
            x, y, larg, alt = an["bbox"]
            caixa = [x * escala_x, y * escala_y, larg * escala_x, alt * escala_y]
            if caixa[2] * caixa[3] < area_minima:
                continue
            recorte = _recortar(original, caixa, margem)
            if recorte is None:
                continue
            classe = do_taco(por_categoria.get(an["category_id"], ""))
            pasta = saida / classe
            pasta.mkdir(parents=True, exist_ok=True)
            destino = pasta / f"taco-{img['id']}-{an['id']}.jpg"
            if not destino.exists():
                recorte.save(destino, quality=92)
            local[classe] += 1
        return local, True

    with ThreadPoolExecutor(max_workers=trabalhadores) as executor:
        futuros = [executor.submit(processar, img) for img in escolhidas]
        for fut in tqdm(as_completed(futuros), total=len(futuros), unit="img"):
            local, ok = fut.result()
            if not ok:
                falhas += 1
                continue
            for classe, n in local.items():
                contagem[classe] += n

    print(f"[taco] pronto: {dict(contagem)} ({falhas} imagens indisponíveis no Flickr)")
    return dict(contagem)
