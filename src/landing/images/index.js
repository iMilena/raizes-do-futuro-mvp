/* ---------------------------------------------------------------------------
   As fotos da landing, em um lugar só.

   Cada foto é descrita como um objeto e não como uma URL solta, porque o que a
   página serve é um <picture>: WebP em algumas larguras, com o JPEG/PNG
   original de fallback. `width`/`height` acompanham o descritor para o
   navegador reservar o espaço antes de a imagem chegar — sem isso o texto
   pula quando cada foto carrega.

   As variantes WebP saem de `node scripts/otimizar-imagens.mjs`.
--------------------------------------------------------------------------- */

/* originais — fallback do <picture> */
import coletaOriginal from './coleta-validacao.jpeg';
import vilaOriginal from './hero-aerial.jpg';
import praiaOriginal from './criancas-boipeba.jpeg';
import fundoOriginal from './fundo-infancia.png';
import logoOriginal from './logo_raizes.png';

/* variantes WebP */
import coleta800 from './webp/coleta-validacao-800.webp';
import coleta1200 from './webp/coleta-validacao-1200.webp';
import coleta1600 from './webp/coleta-validacao-1600.webp';
import vila800 from './webp/hero-aerial-800.webp';
import vila1200 from './webp/hero-aerial-1200.webp';
import vila1600 from './webp/hero-aerial-1600.webp';
import praia800 from './webp/criancas-boipeba-800.webp';
import praia1298 from './webp/criancas-boipeba-1298.webp';
import fundo335 from './webp/fundo-infancia-335.webp';
import logo96 from './webp/logo_raizes-96.webp';
import logo192 from './webp/logo_raizes-192.webp';

const srcset = (pares) => pares.map(([url, w]) => `${url} ${w}w`).join(', ');

/** Mutirão de coleta na praia: o herói, e a ponta "Coleta e Validação". */
export const coletaValidacao = {
  fallback: coletaOriginal,
  webp: srcset([[coleta800, 800], [coleta1200, 1200], [coleta1600, 1600]]),
  width: 1600,
  height: 1204,
  alt: 'Mutirão de coleta em Boipeba: moradores reunidos na praia, sob os coqueiros, ao lado dos sacos de resíduo recolhidos.',
};

/** Vista aérea de uma vila de Boipeba à beira-mar: a etapa "Circularidade" e a faixa de luz. */
export const vilaAerea = {
  fallback: vilaOriginal,
  webp: srcset([[vila800, 800], [vila1200, 1200], [vila1600, 1600]]),
  width: 1920,
  height: 1280,
  alt: 'Vista aérea de uma vila de Boipeba, com casas de telhado de barro entre a mata e o mar.',
};

/** Crianças de Boipeba numa mesa à beira da praia: o destino do ciclo. */
export const criancasPraia = {
  fallback: praiaOriginal,
  webp: srcset([[praia800, 800], [praia1298, 1298]]),
  width: 1298,
  height: 730,
  alt: 'Crianças de Boipeba reunidas numa mesa de madeira à beira da praia, olhando um ouriço-do-mar.',
};

/** As duas meninas montando peças: a ponta "Fundo Infância". */
export const fundoInfancia = {
  fallback: fundoOriginal,
  webp: srcset([[fundo335, 335]]),
  width: 335,
  height: 344,
  alt: 'Duas crianças montando peças com material reciclado sobre a mesa.',
};

/* ------------------------------------------------------------------------
   As fotos que a equipe enviou em setembro de 2026.
------------------------------------------------------------------------ */
import balancaOriginal from './balanca-pesagem.jpeg';
import balanca800 from './webp/balanca-pesagem-800.webp';
import balanca1200 from './webp/balanca-pesagem-1200.webp';
import balanca1600 from './webp/balanca-pesagem-1600.webp';
import sacosOriginal from './pesagem-sacos.jpeg';
import sacos800 from './webp/pesagem-sacos-800.webp';
import sacos1200 from './webp/pesagem-sacos-1200.webp';
import sacos1428 from './webp/pesagem-sacos-1428.webp';
import mutiraoOriginal from './mutirao-grupo.jpeg';
import mutirao800 from './webp/mutirao-grupo-800.webp';
import mutirao1200 from './webp/mutirao-grupo-1200.webp';
import mutirao1600 from './webp/mutirao-grupo-1600.webp';
import criancaOriginal from './crianca-escola.jpeg';
import crianca600 from './webp/crianca-escola-600.webp';
import crianca963 from './webp/crianca-escola-963.webp';

/** O fundo da seção final, em CSS. */
export const criancasPraiaUrl = praia1298;

/** A balança de mão marcando 6,54 kg. */
export const balancaPesagem = {
  fallback: balancaOriginal,
  webp: srcset([[balanca800, 800], [balanca1200, 1200], [balanca1600, 1600]]),
  width: 1600,
  height: 1200,
  alt: 'Balança de mão laranja marcando 6,54 kg de resíduo recolhido na praia.',
};

/** Crianças e adultos em volta dos sacos, na hora da pesagem. */
export const pesagemSacos = {
  fallback: sacosOriginal,
  webp: srcset([[sacos800, 800], [sacos1200, 1200], [sacos1428, 1428]]),
  width: 1428,
  height: 1071,
  alt: 'Crianças e adultos abrem os sacos de resíduo recolhidos enquanto a coleta é pesada numa balança de mão.',
};

/** O grupo do mutirão comemorando ao lado dos sacos. */
export const mutiraoGrupo = {
  fallback: mutiraoOriginal,
  webp: srcset([[mutirao800, 800], [mutirao1200, 1200], [mutirao1600, 1600]]),
  width: 1600,
  height: 1200,
  alt: 'Moradores, voluntários e crianças comemoram de braços erguidos ao lado dos sacos de resíduo recolhidos no mutirão.',
};

/** Criança na escola fazendo um coração com as mãos. */
export const criancaEscola = {
  fallback: criancaOriginal,
  webp: srcset([[crianca600, 600], [crianca963, 963]]),
  width: 963,
  height: 1280,
  alt: 'Criança sentada na carteira da escola faz um coração com as mãos na frente do rosto.',
};

/** Marca do projeto. */
export const logoRaizes = {
  fallback: logoOriginal,
  webp: srcset([[logo96, 96], [logo192, 192]]),
  width: 489,
  height: 476,
  alt: 'Raízes do Futuro',
};

/** A mesma marca como URL simples, para onde um `<picture>` não cabe. */
export const logoRaizesUrl = logoOriginal;

/* `hero-boipeba`, `hero-aerial`, `FAQ`, `criancas-boipeba` e `logo_footer`
   continuam na pasta, mas não são mais importados por ninguém: a landing
   redesenhada usa as quatro fotos acima. Ficam fora daqui de propósito — um
   `export` sem uso arrasta a foto inteira para dentro do bundle, e eram 740 kB
   que ninguém baixava para ver. Basta reimportá-los se voltarem a ser usados. */
