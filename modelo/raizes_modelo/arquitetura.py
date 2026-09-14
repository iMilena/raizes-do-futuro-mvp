"""A rede.

MobileNetV3-Small, com os pesos de ImageNet e a cabeça trocada pelas 5 classes
do projeto.

Por que ela, e não EfficientNet-Lite0: as duas cabem no orçamento, e a Lite0
costuma acertar um pouco mais em texturas parecidas (papel contra papelão). Mas
a MobileNetV3-Small vem no torchvision com pesos prontos, exporta para ONNX sem
operador exótico e fica em torno de 2.5 M parâmetros contra 4.7 M da Lite0, o
que importa quando o alvo é 10 MB depois da quantização e menos de 1 segundo em
celular de entrada. Trocar depois é mudar esta função, e mais nada.

O caminho de fine-tune com as fotos de Boipeba usa exatamente esta mesma
arquitetura: `afinar.py` carrega o checkpoint e continua daqui.
"""
from __future__ import annotations

import torch
from torch import nn
from torchvision import models

ARQUITETURAS = ("mobilenetv3_small", "efficientnet_lite0")


def construir(arquitetura: str, n_classes: int, pesos_iniciais: str | None = "IMAGENET1K_V1") -> nn.Module:
    if arquitetura == "mobilenetv3_small":
        rede = models.mobilenet_v3_small(weights=pesos_iniciais)
        # classifier = [Linear(576,1024), Hardswish, Dropout, Linear(1024,1000)]
        entradas = rede.classifier[3].in_features
        rede.classifier[3] = nn.Linear(entradas, n_classes)
        return rede

    if arquitetura == "efficientnet_lite0":
        # O torchvision não traz a variante Lite. A B0 é o equivalente disponível,
        # e fica documentado que não é a Lite de verdade, para ninguém comparar
        # números com a literatura achando que é.
        rede = models.efficientnet_b0(weights=pesos_iniciais)
        entradas = rede.classifier[1].in_features
        rede.classifier[1] = nn.Linear(entradas, n_classes)
        return rede

    raise ValueError(f"arquitetura desconhecida: {arquitetura}. Esperado uma de {ARQUITETURAS}")


def congelar_tronco(rede: nn.Module, congelar: bool) -> None:
    """Liga e desliga o gradiente de tudo que não é a cabeça classificadora.

    Existe porque as primeiras épocas treinam só a cabeça: com a cabeça ainda
    aleatória, o gradiente que chega ao tronco é ruído, e ruído destrói filtros
    de ImageNet que levaram semanas de GPU para existir.
    """
    for nome, parametro in rede.named_parameters():
        if not nome.startswith("classifier"):
            parametro.requires_grad = not congelar


def parametros_em_grupos(rede: nn.Module, lr_cabeca: float, lr_tronco: float) -> list[dict]:
    """Taxa menor para o tronco que para a cabeça.

    O tronco já sabe ver bordas e texturas, e só precisa de ajuste fino. A
    cabeça nasceu agora e precisa andar rápido.
    """
    cabeca, tronco = [], []
    for nome, parametro in rede.named_parameters():
        (cabeca if nome.startswith("classifier") else tronco).append(parametro)
    return [
        {"params": cabeca, "lr": lr_cabeca},
        {"params": tronco, "lr": lr_tronco},
    ]


def contar_parametros(rede: nn.Module) -> int:
    return sum(p.numel() for p in rede.parameters())


def dispositivo() -> torch.device:
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")
