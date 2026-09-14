"""Ponto de entrada do preparo dos dados.

    python -m raizes_modelo.dados.preparar
    python -m raizes_modelo.dados.preparar --so trashnet

Ao fim, `dados/conjunto/<classe>/*.jpg` tem tudo junto, e a divisão em treino,
validação e teste acontece em `montar.py`, não aqui: separar o "juntar" do
"dividir" deixa retreinar com uma semente diferente sem baixar nada de novo.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from ..configuracao import carregar, fixar_semente
from . import taco, trashnet


def contar_conjunto(dir_conjunto: Path) -> dict[str, int]:
    if not dir_conjunto.exists():
        return {}
    return {
        pasta.name: len(list(pasta.glob("*.jpg")))
        for pasta in sorted(p for p in dir_conjunto.iterdir() if p.is_dir())
    }


def principal() -> None:
    p = argparse.ArgumentParser(description="Baixa e organiza os datasets públicos")
    p.add_argument("--config", default=None)
    p.add_argument("--so", choices=["trashnet", "taco"], default=None,
                   help="baixa só uma fonte (útil quando o Flickr está lento)")
    args = p.parse_args()

    cfg = carregar(args.config)
    fixar_semente(cfg["semente"])
    dir_dados = cfg.dir_dados
    dir_dados.mkdir(parents=True, exist_ok=True)

    conf_dados = cfg["dados"]
    if conf_dados["trashnet"]["usar"] and args.so in (None, "trashnet"):
        trashnet.preparar(
            conf_dados["trashnet"]["url"], dir_dados,
            papel_como_papelao=conf_dados["trashnet"]["papel_como_papelao"],
        )
    if conf_dados["taco"]["usar"] and args.so in (None, "taco"):
        t = conf_dados["taco"]
        taco.preparar(
            t["url_anotacoes"], dir_dados,
            max_imagens=t["max_imagens"], trabalhadores=t["trabalhadores"],
            margem=t["margem_recorte"], area_minima=t["area_minima_px"],
        )

    contagem = contar_conjunto(dir_dados / "conjunto")
    total = sum(contagem.values())
    print("\n--- conjunto reunido ---")
    for classe, n in sorted(contagem.items(), key=lambda kv: -kv[1]):
        print(f"  {classe:10s} {n:6d}  ({n / total:.1%})" if total else f"  {classe}: {n}")
    print(f"  {'TOTAL':10s} {total:6d}")

    resumo = dir_dados / "contagem.json"
    resumo.write_text(json.dumps(contagem, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nresumo em {resumo}")

    faltando = [c for c in cfg.classes if contagem.get(c, 0) < 100]
    if faltando:
        print(f"\nATENÇÃO: classes com menos de 100 exemplos: {faltando}. "
              "O relatório por classe vai ficar instável, considere aumentar max_imagens do TACO.")


if __name__ == "__main__":
    principal()
