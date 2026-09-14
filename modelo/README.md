# Modelo de classificação de material reciclável

Pipeline de treino do classificador que roda dentro do app de campo, offline, no
celular do catador. Cinco classes: `PET`, `aluminio`, `vidro`, `papelao`,
`outros`.

O que este modelo faz e o que não faz:

- **faz**: olha a foto da coleta e sugere o material, com um número de confiança
  calibrado
- **não faz**: estimar peso. O peso vem da balança, sempre. Foto única sem câmera
  calibrada e sem referência de escala não sustenta peso em auditoria, e essa
  decisão é de projeto, não limitação temporária

O que o app faz com a sugestão está em [../VALIDACAO.md](../VALIDACAO.md).

## Preparar o ambiente

```bash
cd modelo
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requisitos.txt   # Windows
# .venv/bin/pip install -r requisitos.txt                   # Linux e macOS
```

Torch em CPU, fixado por versão. Treinar em notebook comum leva de 40 a 90
minutos, e é assim de propósito: quem for retreinar com as fotos de Boipeba
provavelmente não vai ter GPU.

## Baixar os dados

```bash
python -m raizes_modelo.dados.preparar
python -m raizes_modelo.dados.preparar --so trashnet   # se o Flickr estiver lento
```

Duas fontes, e cada uma cobre uma fraqueza da outra:

- **TrashNet** (Stanford, 2.527 fotos): objeto único, fundo limpo, estúdio. Vem
  num zip só, sem link quebrado. É o piso do conjunto.
- **TACO** (formato COCO): lixo no chão, com sombra, areia e vários objetos na
  mesma foto. Parece com o que o catador fotografa. As imagens vêm uma a uma do
  Flickr, parte dos links já morreu, e por isso baixamos um subconjunto
  (`max_imagens` no `configuracao/treino.yaml`), escolhido priorizando as fotos
  que trazem classe rara.

O resultado fica em `dados/conjunto/<classe>/*.jpg`, e a contagem em
`dados/contagem.json`.

Nada disso entra no git: `dados/`, `.venv/` e `execucoes/` estão no `.gitignore`.

## Treinar

```bash
python -m raizes_modelo.treino --nome padrao
```

Sai em `execucoes/padrao/`: `melhor.pt`, `divisao.json` (quais fotos foram para
treino, validação e teste), `historico.json` e a configuração usada.

Decisões que valem saber, todas ajustáveis em `configuracao/treino.yaml`:

- **MobileNetV3-Small**, com pesos de ImageNet. Alternativa considerada:
  EfficientNet-Lite0, que costuma acertar um pouco mais em texturas parecidas
  (papel contra papelão), mas não vem no torchvision e quase triplica o tamanho
  depois da quantização. O alvo aqui é menos de 10 MB e menos de 1 segundo em
  celular de entrada.
- **F1 macro decide o melhor checkpoint**, não acurácia. Com `outros` tendo o
  dobro de exemplos de `vidro`, um modelo que ignorasse vidro ainda teria
  acurácia respeitável, e seria inútil justamente na classe que a operação vende.
- **Primeiras épocas só com a cabeça.** Descongelar o tronco enquanto a cabeça
  ainda é aleatória destrói filtros de ImageNet com gradiente que é puro ruído.
- **Divisão determinística por hash do nome do arquivo.** Acrescentar fotos novas
  não remaneja as antigas: uma foto que estava no teste continua no teste, e a
  métrica nova continua comparável com a antiga. É isso que torna o fine-tune com
  as fotos de Boipeba mensurável.

## Avaliar

```bash
python -m raizes_modelo.avaliacao --execucao padrao
```

Gera `relatorios/metricas.json`, `relatorios/matriz-confusao.png` e
`relatorios/calibracao.png`.

O relatório traz precisão e revocação separadas por classe, e não só acurácia.
As duas dizem coisas diferentes para a operação:

- precisão baixa em PET: o app chama de PET o que não é, e o fardo vai
  contaminado para o comprador
- revocação baixa em PET: o app deixa de reconhecer PET de verdade, e o catador
  tem de corrigir à mão o tempo todo

Também sai daqui a **calibração**. Rede treinada com entropia cruzada é
confiante demais: diz 95% e acerta 80%. O script acha a temperatura que corrige
isso (medida na validação, nunca no teste) e escolhe o **limiar** de revisão
humana: o menor limiar em que o que é classificado sozinho atinge 95% de
precisão. A tabela no JSON mostra o custo de cada limiar em fila para a
coordenação, porque limiar alto é decisão de operação, não de estatística.

## Exportar para o app

```bash
python -m raizes_modelo.exportar --execucao padrao
```

Sai em `../public/modelo/`: `classificador.onnx` (int8), `classificador-fp32.onnx`
e `classificador.json`.

- A **temperatura vai embutida no grafo**: o modelo devolve probabilidade já
  calibrada. Se ela ficasse do lado do JavaScript, reexportar sem atualizar o app
  produziria confiança errada, e confiança errada move o limiar de revisão
  humana sem ninguém ver.
- A **quantização é estática**, com 200 imagens reais de calibração, e **só vai
  para campo se passar numa prova de concordância** com o modelo original
  (`concordancia_minima`, por padrão 97%).

### Sobre a quantização int8, que não passou

O módulo pedia int8 abaixo de 10 MB. O que a medição mostrou:

| variante | concordância com o fp32 | tamanho |
| --- | --- | --- |
| Conv e Gemm, per-channel | 5% | 1,87 MB |
| Conv e Gemm, per-tensor | 2,5% | 1,74 MB |
| Conv e Gemm, u8u8 | 0% | 1,74 MB |
| sem os blocos squeeze-and-excite nem as convoluções profundas | 60% | 3,20 MB |
| **só Gemm** | **100%** | 4,36 MB |
| **fp32 (o que está em uso)** | **100%** | **6,11 MB** |

Quantizar as convoluções quebra esta rede, e quebra em silêncio: o modelo
continua respondendo, com confiança alta, e errando. A causa é conhecida, o
hardswish e os blocos squeeze-and-excite da MobileNetV3 produzem faixas de
ativação que a calibração estática não representa. A saída de verdade é treino
consciente de quantização (QAT), que é outro projeto.

Como o fp32 tem 6,11 MB (dentro do alvo de 10 MB) e roda em 15 ms no navegador,
a decisão foi seguir com ele. A prova de concordância fica montada: quem tentar
de novo, com outra arquitetura ou com QAT, descobre na hora se funcionou. O
resultado de cada exportação fica registrado em `medidas` no
`classificador.json`.

O app confere as classes do manifesto contra as que ele conhece e se recusa a
carregar um modelo com a ordem trocada. Classificar errado com cara de certo é
pior que não classificar.

## Retreinar com as fotos de Boipeba

É o caminho que importa: as fotos reais da coleta valem mais que os dois datasets
públicos juntos, porque são a distribuição de verdade (areia, sol a pino, lona
azul, material molhado).

1. Junte as fotos em `dados/boipeba/<classe>/`. A fonte mais valiosa é o que os
   catadores **corrigiram** no app: todo registro com `corrigidoPorHumano: true`
   é uma foto que o modelo errou, com o rótulo certo dado por quem estava lá.
2. Ajuste a seção `afinamento` do `configuracao/treino.yaml`.
3. Rode:

```bash
python -m raizes_modelo.afinar --execucao boipeba-01
python -m raizes_modelo.avaliacao --execucao boipeba-01
python -m raizes_modelo.exportar --execucao boipeba-01
```

`proporcao_dados_publicos` mantém parte dos datasets públicos na mistura. Sem
isso, 300 fotos novas fazem o modelo esquecer o que já sabia (esquecimento
catastrófico), e ele passa a acertar só o que se parece com as fotos do último
mês.

Compare o `relatorios/metricas.json` antes e depois. Como a divisão é
determinística, os números são comparáveis de verdade.

## Testes

```bash
.venv/Scripts/python.exe -m pytest testes -q
```

Cobrem o que quebra em silêncio: mapeamento de categoria incompleto (um teste
confere todas as 62 categorias do TACO contra o arquivo de anotações), vazamento
entre treino e teste, divisão não determinística, e métricas que escondem a
classe pequena.
