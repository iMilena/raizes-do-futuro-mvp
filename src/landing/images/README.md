# Imagens da landing page

Esta pasta reúne todas as imagens usadas na landing page do "Raízes do Futuro".

## O que já está aqui
- `hero-aerial.jpg` — foto real usada no topo do site (hero). Foi
  comprimida (de ~4,3 MB para ~380 KB) para não pesar o repositório;
  se quiser trocar por uma versão em maior qualidade, vale comprimir
  antes de commitar (ex: `convert original.png -resize 1920x1920\> -quality 85 hero-aerial.jpg`).

## O que ainda é placeholder
As demais imagens (avatares do card flutuante, fotos dos cards de "Como
Funciona", da seção "Os Quatro Pilares", do FAQ e do CTA final) ainda
apontam para fotos de banco de imagens (Unsplash), usadas só como
referência de enquadramento e proporção.

## Como trocar por fotos reais do projeto
1. Coloque o arquivo de imagem final nesta mesma pasta (ex:
   `coleta-validacao.jpg`, `familia-boipeba.jpg` etc).
2. Abra o arquivo `index.js` desta pasta.
3. Troque a URL do Unsplash correspondente por um import local, por
   exemplo:

   ```js
   // antes
   export const coletaValidacao = 'https://images.unsplash.com/...';

   // depois
   import coletaValidacao from './coleta-validacao.jpg';
   export { coletaValidacao };
   ```

Nenhum componente precisa ser alterado — todos importam as imagens a
partir de `images/index.js`, então a troca é feita em um único lugar.

## Imagens usadas hoje (mapa rápido)
| Variável             | Onde aparece                         |
| --------------------- | ------------------------------------- |
| `heroAerial`          | Fundo da seção principal (hero)       |
| `avatarFamilia1/2`    | Avatares do card "Famílias Impactadas"|
| `coletaValidacao`     | Card "Coleta e Validação"             |
| `fundoInfancia`       | Card "Fundo Infância" (destaque)      |
| `rendaDireta`         | Card "Renda Direta"                   |
| `pilaresComunidade`   | Imagem central de "Os Quatro Pilares" |
| `faqMateriais`        | Imagem ao lado do FAQ                 |
| `ctaMangue`           | Imagem do bloco de call-to-action     |
