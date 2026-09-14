"""TrashNet (Stanford): 2.527 fotos em 6 pastas, uma por material.

Vem como um zip único, então é o dataset barato: um download, sem link morto,
sem recorte. É ele que garante que o pipeline roda mesmo se o TACO falhar.
"""
from __future__ import annotations

import shutil
import zipfile
from pathlib import Path

import requests
from tqdm import tqdm

from .mapeamento import da_trashnet

NOME_ZIP = "trashnet.zip"


def baixar(url: str, destino: Path) -> Path:
    """Baixa o zip, pulando se já estiver no disco."""
    destino.mkdir(parents=True, exist_ok=True)
    arquivo = destino / NOME_ZIP
    if arquivo.exists() and arquivo.stat().st_size > 1_000_000:
        print(f"[trashnet] zip já está em {arquivo}, pulando o download")
        return arquivo

    print(f"[trashnet] baixando {url}")
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        total = int(r.headers.get("content-length", 0))
        with open(arquivo, "wb") as f, tqdm(total=total, unit="B", unit_scale=True) as barra:
            for pedaco in r.iter_content(chunk_size=1 << 16):
                f.write(pedaco)
                barra.update(len(pedaco))
    return arquivo


def extrair(arquivo: Path, destino: Path) -> Path:
    destino.mkdir(parents=True, exist_ok=True)
    marca = destino / ".extraido"
    if marca.exists():
        print(f"[trashnet] já extraído em {destino}")
        return destino
    print(f"[trashnet] extraindo {arquivo}")
    with zipfile.ZipFile(arquivo) as z:
        z.extractall(destino)
    marca.write_text("ok", encoding="utf-8")
    return destino


def organizar(extraido: Path, saida: Path, papel_como_papelao: bool = True) -> dict[str, int]:
    """Copia as fotos para saida/<classe>/, traduzindo as pastas originais.

    Copia em vez de mover porque o zip extraído é a única cópia do original: se
    o mapeamento mudar (e ele muda, papel virou papelão por decisão de operação),
    dá para reorganizar sem baixar tudo de novo.
    """
    origem = _achar_raiz(extraido)
    contagem: dict[str, int] = {}
    for pasta in sorted(p for p in origem.iterdir() if p.is_dir()):
        classe = da_trashnet(pasta.name, papel_como_papelao)
        if classe is None:
            print(f"[trashnet] pasta ignorada: {pasta.name}")
            continue
        alvo = saida / classe
        alvo.mkdir(parents=True, exist_ok=True)
        for foto in sorted(pasta.glob("*.jpg")):
            destino = alvo / f"trashnet-{pasta.name}-{foto.name}"
            if not destino.exists():
                shutil.copy2(foto, destino)
            contagem[classe] = contagem.get(classe, 0) + 1
    return contagem


def _achar_raiz(extraido: Path) -> Path:
    """O zip traz dataset-resized/<classe>/, mas já veio com um nível a mais em
    versões antigas. Procurar a pasta que tem as classes dentro evita depender
    disso."""
    candidatos = [extraido, *[p for p in extraido.rglob("*") if p.is_dir()]]
    for c in candidatos:
        nomes = {p.name.lower() for p in c.iterdir() if p.is_dir()}
        if {"glass", "metal", "paper"} <= nomes:
            return c
    raise FileNotFoundError(f"não achei as pastas de classe do TrashNet dentro de {extraido}")


def preparar(url: str, dir_dados: Path, papel_como_papelao: bool = True) -> dict[str, int]:
    bruto = dir_dados / "bruto" / "trashnet"
    zipado = baixar(url, bruto)
    extraido = extrair(zipado, bruto / "extraido")
    contagem = organizar(extraido, dir_dados / "conjunto", papel_como_papelao)
    print(f"[trashnet] pronto: {contagem}")
    return contagem
