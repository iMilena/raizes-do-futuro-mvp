# Imagens da landing page

Todas as fotos da landing e da porta do painel moram aqui, junto das variantes
WebP que o site realmente serve.

## Como uma foto é servida

Nada importa a foto direto. Cada uma é descrita em `index.js` como um objeto
com o original (fallback), o `srcset` em WebP e as dimensões, e é o componente
`components/Foto.jsx` que monta o `<picture>`:

- **WebP** em duas ou três larguras, escolhidas pelo navegador conforme o
  `sizes` que cada uso declara;
- **JPEG/PNG original** como fallback, para quem não lê WebP;
- **`width` e `height`** sempre no `<img>`, para o navegador reservar o espaço
  antes do download — é o que mantém o *layout shift* em zero.

## Trocar ou incluir uma foto

1. Coloque o arquivo final nesta pasta.
2. Se for uma foto nova, acrescente-a à lista `FOTOS` em
   `scripts/otimizar-imagens.mjs`, com as larguras que fazem sentido para o uso.
3. Rode `node scripts/otimizar-imagens.mjs`. Ele regrava a pasta `webp/` inteira.
4. Ajuste o descritor correspondente em `index.js` (imports, `srcset`, `width`,
   `height` e `alt`).
5. Commite também os `.webp` gerados: assim o build não depende do `sharp`.

## Onde cada foto aparece

| Descritor em `index.js` | Onde aparece                                              |
| ----------------------- | --------------------------------------------------------- |
| `coletaValidacao`       | Herói, ponta "Coleta e Validação" e o fundo desfocado da porta do painel |
| `fundoInfancia`         | Ponta "Fundo Infância"                                     |
| `vilaAerea`             | Etapa "Circularidade", a faixa de luz que vira o dia e o ponto da feira no mapa |
| `mutiraoGrupo`          | Galeria, "Quem opera o ciclo", página de contato e o ponto "Território" no mapa |
| `criancasPraia`         | Etapa "Saúde e educação", galeria, fundo da seção final e o ponto "Fundo Infância" no mapa |
| `logoRaizes`            | Marca no topo, no rodapé, no contato e na porta do painel  |

`hero-boipeba.jpeg` e `logo_footer.png` continuam na pasta mas **não são
exportados de propósito**: um `export` sem uso arrasta a foto inteira para dentro
do bundle. Basta reimportá-los em `index.js` se voltarem a ser usados.

As fotos ligadas a organizações parceiras que deixaram o projeto (mural, camisetas
e espaço de outra instituição) foram retiradas do site.

## Texto alternativo

O `alt` de cada foto vive junto do descritor, e não espalhado pelos componentes:
a mesma foto às vezes descreve coisas diferentes conforme o lugar, e nesses casos
quem usa passa um `alt` próprio para `<Foto>`. Foto decorativa recebe `alt=""`
explicitamente — nunca fica sem o atributo.
