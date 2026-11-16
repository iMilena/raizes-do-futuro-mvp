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
import baiaOriginal from './hero-boipeba.jpeg';
import vilaOriginal from './hero-aerial.jpg';
import logoOriginal from './logo_raizes.png';

/* variantes WebP */
import baia739 from './webp/hero-boipeba-739.webp';
import vila800 from './webp/hero-aerial-800.webp';
import vila1200 from './webp/hero-aerial-1200.webp';
import vila1600 from './webp/hero-aerial-1600.webp';
import logo96 from './webp/logo_raizes-96.webp';
import logo192 from './webp/logo_raizes-192.webp';

const srcset = (pares) => pares.map(([url, w]) => `${url} ${w}w`).join(', ');

/** A baía de Boipeba no fim da tarde: barcos, coqueiros e casas na beira. */
export const baiaBoipeba = {
  fallback: baiaOriginal,
  webp: srcset([[baia739, 739]]),
  width: 739,
  height: 769,
  alt: 'A baía de Boipeba no fim da tarde, com barcos na água calma e casas entre os coqueiros.',
};

/** Vista aérea de uma vila de Boipeba à beira-mar: a etapa "Circularidade" e a faixa de luz. */
export const vilaAerea = {
  fallback: vilaOriginal,
  webp: srcset([[vila800, 800], [vila1200, 1200], [vila1600, 1600]]),
  width: 1920,
  height: 1280,
  alt: 'Vista aérea de uma vila de Boipeba, com casas de telhado de barro entre a mata e o mar.',
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

/* `logo_footer` continua na pasta, mas não é mais importado por ninguém. As fotos ligadas a organizações parceiras que deixaram
   o projeto foram apagadas da pasta. Ficam fora daqui de propósito — um
   `export` sem uso arrasta a foto inteira para dentro do bundle, e eram 740 kB
   que ninguém baixava para ver. Basta reimportá-lo se voltar a ser usados. */
