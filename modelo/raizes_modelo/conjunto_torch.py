"""Dataset e transformações do PyTorch.

As transformações de treino não são as de praxe copiadas de tutorial: cada uma
responde a uma coisa que acontece na foto do catador em Boipeba.

    · giro e espelho: não existe "de cabeça para cima" numa pilha no chão
    · corte aleatório: enquadramento varia muito de foto para foto
    · brilho, contraste e saturação fortes: sol das 11 da manhã contra sombra da
      lona, que é a variação mais brutal do conjunto
    · desfoque leve: celular de entrada foca mal e a lente vive suja de areia

O que NÃO entra: rotação de 90 graus em degraus e distorção de perspectiva
pesada, que geram fotos que nenhuma câmera produziria, e cortam dados úteis em
troca de robustez a um problema que não existe.
"""
from __future__ import annotations

from pathlib import Path

import torch
from PIL import Image
from torch.utils.data import Dataset
from torchvision import transforms

from .classes import INDICE_POR_CLASSE


class ConjuntoColeta(Dataset):
    """Fotos de material reciclável, rotuladas pela classe do projeto."""

    def __init__(self, particao: dict[str, list[Path]], transformacao) -> None:
        self.itens: list[tuple[Path, int]] = []
        for classe, arquivos in sorted(particao.items()):
            for arquivo in arquivos:
                self.itens.append((arquivo, INDICE_POR_CLASSE[classe]))
        self.transformacao = transformacao

    def __len__(self) -> int:
        return len(self.itens)

    def __getitem__(self, indice: int):
        caminho, rotulo = self.itens[indice]
        with Image.open(caminho) as img:
            imagem = img.convert("RGB")
        return self.transformacao(imagem), rotulo

    def contagem_por_classe(self) -> list[int]:
        contagem = [0] * len(INDICE_POR_CLASSE)
        for _, rotulo in self.itens:
            contagem[rotulo] += 1
        return contagem


def transformacao_treino(tamanho: int, media: list[float], desvio: list[float]):
    return transforms.Compose([
        transforms.RandomResizedCrop(tamanho, scale=(0.6, 1.0), ratio=(0.75, 1.33)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(p=0.2),
        transforms.ColorJitter(brightness=0.4, contrast=0.35, saturation=0.35, hue=0.05),
        transforms.RandomApply([transforms.GaussianBlur(3, sigma=(0.1, 1.2))], p=0.25),
        transforms.ToTensor(),
        transforms.Normalize(media, desvio),
    ])


def transformacao_avaliacao(tamanho: int, media: list[float], desvio: list[float]):
    """Sem aleatoriedade nenhuma.

    O corte central depois de redimensionar para 114% imita o que o app faz: a
    câmera entrega 4:3 e o classificador recebe um quadrado do centro. Avaliar
    com a imagem inteira esticada mediria um pré-processamento que não existe
    em produção.
    """
    return transforms.Compose([
        transforms.Resize(int(tamanho * 1.14)),
        transforms.CenterCrop(tamanho),
        transforms.ToTensor(),
        transforms.Normalize(media, desvio),
    ])


def pesos_por_classe(contagem: list[int]) -> torch.Tensor:
    """Peso inversamente proporcional à frequência, normalizado pela média.

    Serve para o modelo não resolver o problema chutando a classe maior. A
    normalização mantém a escala da perda comparável entre execuções com
    conjuntos de tamanhos diferentes.
    """
    total = sum(contagem)
    n_classes = len(contagem)
    pesos = [total / (n_classes * max(1, c)) for c in contagem]
    media = sum(pesos) / n_classes
    return torch.tensor([p / media for p in pesos], dtype=torch.float32)
