"""Testes do pipeline de dados e das métricas.

O que é testado aqui é o que, quando quebra, quebra em silêncio: um mapeamento
incompleto que manda alumínio para `outros`, uma divisão que vaza teste no
treino, uma métrica que parece boa porque ignora a classe menor.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from raizes_modelo.classes import CLASSES, indice
from raizes_modelo.configuracao import carregar
from raizes_modelo.dados.mapeamento import TACO, do_taco, da_trashnet
from raizes_modelo.dados.montar import dividir, resumir
from raizes_modelo.metricas import (
    acuracia, curva_confiabilidade, erro_calibracao_esperado, f1_macro,
    matriz_confusao, relatorio_por_classe,
)

RAIZ = Path(__file__).resolve().parent.parent


# --------------------------------------------------------------- mapeamento ---

def test_toda_categoria_do_taco_tem_destino_declarado():
    """O arquivo de anotações do TACO é a fonte da verdade sobre as categorias.

    Se o TACO ganhar categoria nova, `do_taco` manda para `outros` para não
    derrubar o download, e é este teste que avisa que alguém precisa decidir
    onde ela entra de verdade.
    """
    anotacoes = RAIZ / "dados" / "bruto" / "taco" / "annotations.json"
    if not anotacoes.exists():
        pytest.skip("anotações do TACO ainda não baixadas")

    nomes = {c["name"] for c in json.loads(anotacoes.read_text(encoding="utf-8"))["categories"]}
    nao_mapeadas = sorted(nomes - set(TACO))
    assert not nao_mapeadas, f"categorias sem destino declarado: {nao_mapeadas}"


def test_todo_destino_do_mapeamento_e_classe_do_projeto():
    for origem, destino in TACO.items():
        assert destino in CLASSES, f"{origem} aponta para classe inexistente: {destino}"


def test_lata_de_bebida_vira_aluminio_e_nao_outros():
    # Erro clássico: a classe de maior valor cair no coringa e ninguém notar.
    assert do_taco("Drink can") == "aluminio"
    assert do_taco("Clear plastic bottle") == "PET"
    assert do_taco("Glass bottle") == "vidro"
    assert do_taco("Corrugated carton") == "papelao"


def test_categoria_desconhecida_cai_em_outros_sem_quebrar():
    assert do_taco("Categoria Inventada 2030") == "outros"


def test_trashnet_respeita_a_decisao_sobre_papel():
    assert da_trashnet("paper", papel_como_papelao=True) == "papelao"
    assert da_trashnet("paper", papel_como_papelao=False) == "outros"
    assert da_trashnet("pasta_que_nao_existe") is None


def test_classe_fora_do_projeto_e_erro_explicito():
    with pytest.raises(ValueError):
        indice("isopor")


# ------------------------------------------------------------------ divisão ---

def _conjunto_falso(tmp_path: Path, por_classe: int = 40) -> Path:
    conjunto = tmp_path / "conjunto"
    for classe in CLASSES:
        pasta = conjunto / classe
        pasta.mkdir(parents=True)
        for i in range(por_classe):
            (pasta / f"{classe}-{i:03d}.jpg").write_bytes(b"falso")
    return conjunto


def test_divisao_nao_vaza_foto_entre_as_partes(tmp_path):
    partes = dividir(_conjunto_falso(tmp_path), list(CLASSES),
                     {"treino": 0.7, "validacao": 0.15, "teste": 0.15}, semente=42)
    caminhos = {nome: {p for arqs in parte.values() for p in arqs} for nome, parte in partes.items()}
    assert not caminhos["treino"] & caminhos["validacao"]
    assert not caminhos["treino"] & caminhos["teste"]
    assert not caminhos["validacao"] & caminhos["teste"]


def test_divisao_e_deterministica(tmp_path):
    conjunto = _conjunto_falso(tmp_path)
    proporcoes = {"treino": 0.7, "validacao": 0.15, "teste": 0.15}
    assert resumir(dividir(conjunto, list(CLASSES), proporcoes, 42)) == \
           resumir(dividir(conjunto, list(CLASSES), proporcoes, 42))


def test_foto_nova_nao_remaneja_as_antigas(tmp_path):
    """O caminho de fine-tune depende disto: acrescentar as fotos de Boipeba não
    pode mover para o treino uma foto que estava no teste, senão a métrica nova
    não é comparável com a antiga."""
    conjunto = _conjunto_falso(tmp_path, por_classe=30)
    proporcoes = {"treino": 0.7, "validacao": 0.15, "teste": 0.15}
    antes = dividir(conjunto, list(CLASSES), proporcoes, 42)
    teste_antes = {p.name for arqs in antes["teste"].values() for p in arqs}

    for i in range(30, 45):
        (conjunto / "PET" / f"boipeba-{i:03d}.jpg").write_bytes(b"nova")

    depois = dividir(conjunto, list(CLASSES), proporcoes, 42)
    teste_depois = {p.name for arqs in depois["teste"].values() for p in arqs}
    assert teste_antes <= teste_depois


def test_teto_por_classe_limita_sem_zerar_nenhuma(tmp_path):
    partes = dividir(_conjunto_falso(tmp_path, por_classe=100), list(CLASSES),
                     {"treino": 0.7, "validacao": 0.15, "teste": 0.15}, 42, max_por_classe=20)
    for classe in CLASSES:
        total = sum(len(parte.get(classe, [])) for parte in partes.values())
        assert total == 20


def test_proporcoes_ficam_perto_do_pedido(tmp_path):
    partes = dividir(_conjunto_falso(tmp_path, por_classe=400), list(CLASSES),
                     {"treino": 0.7, "validacao": 0.15, "teste": 0.15}, 42)
    totais = {nome: sum(len(a) for a in parte.values()) for nome, parte in partes.items()}
    total = sum(totais.values())
    assert 0.65 < totais["treino"] / total < 0.75
    assert 0.11 < totais["validacao"] / total < 0.19


# ----------------------------------------------------------------- métricas ---

def test_matriz_de_confusao_conta_certo():
    m = matriz_confusao([0, 0, 1, 2], [0, 1, 1, 2], 3)
    assert m[0] == [1, 1, 0]
    assert m[1] == [0, 1, 0]
    assert m[2] == [0, 0, 1]


def test_f1_macro_pune_quem_ignora_a_classe_pequena():
    """É o caso que a acurácia esconde: 90 fotos de `outros`, 10 de vidro, e o
    modelo chuta `outros` sempre."""
    verdadeiros = [0] * 90 + [1] * 10
    preditos = [0] * 100
    assert acuracia(verdadeiros, preditos) == 0.9
    assert f1_macro(verdadeiros, preditos, 2) < 0.5


def test_relatorio_separa_precisao_de_revocacao():
    linhas = relatorio_por_classe([0, 0, 1, 1], [0, 1, 1, 1], ["a", "b"])
    a = next(l for l in linhas if l["classe"] == "a")
    b = next(l for l in linhas if l["classe"] == "b")
    assert a["precisao"] == 1.0 and a["revocacao"] == 0.5
    assert b["precisao"] == pytest.approx(2 / 3) and b["revocacao"] == 1.0


def test_ece_e_zero_quando_o_modelo_e_honesto():
    # Confiança 0.9 com 90% de acerto: perfeitamente calibrado.
    confiancas = [0.9] * 100
    acertos = [True] * 90 + [False] * 10
    assert erro_calibracao_esperado(confiancas, acertos) == pytest.approx(0.0, abs=0.02)


def test_ece_pega_excesso_de_confianca():
    confiancas = [0.99] * 100
    acertos = [True] * 60 + [False] * 40
    assert erro_calibracao_esperado(confiancas, acertos) > 0.3


def test_curva_de_confiabilidade_cobre_todas_as_faixas():
    pontos = curva_confiabilidade([0.05, 0.35, 0.65, 0.95], [False, True, True, True])
    assert len(pontos) == 10
    assert sum(p["n"] for p in pontos) == 4


# ------------------------------------------------------------ configuração ---

def test_configuracao_padrao_bate_com_as_classes_do_codigo():
    cfg = carregar()
    assert cfg.classes == list(CLASSES), "treino.yaml e classes.py divergiram"


def test_configuracao_tem_semente_e_limiar():
    cfg = carregar()
    assert isinstance(cfg["semente"], int)
    assert 0 < cfg["limiar"]["confianca_minima"] < 1
