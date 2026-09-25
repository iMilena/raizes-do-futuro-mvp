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
import rendaOriginal from './renda-direta.jpeg';
import pilaresOriginal from './pilares.jpeg';
import fundoOriginal from './fundo-infancia.png';
import logoOriginal from './logo_raizes.png';

/* variantes WebP */
import coleta800 from './webp/coleta-validacao-800.webp';
import coleta1200 from './webp/coleta-validacao-1200.webp';
import coleta1600 from './webp/coleta-validacao-1600.webp';
import renda800 from './webp/renda-direta-800.webp';
import renda1200 from './webp/renda-direta-1200.webp';
import renda1600 from './webp/renda-direta-1600.webp';
import pilares600 from './webp/pilares-600.webp';
import pilares900 from './webp/pilares-900.webp';
import pilares1186 from './webp/pilares-1186.webp';
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

/** Feira do Projeto Vivá em Moreré: a ponta "Renda Direta" e a faixa de luz. */
export const rendaDireta = {
  fallback: rendaOriginal,
  webp: srcset([[renda800, 800], [renda1200, 1200], [renda1600, 1600]]),
  width: 1600,
  height: 1200,
  alt: 'Feira da comunidade em Boipeba, com as peças artesanais expostas na banca diante do mural do Projeto Vivá.',
};

/** Roda de mulheres da comunidade: quem opera o ciclo. */
export const pilaresComunidade = {
  fallback: pilaresOriginal,
  webp: srcset([[pilares600, 600], [pilares900, 900], [pilares1186, 1186]]),
  width: 1186,
  height: 1600,
  alt: 'Roda de mulheres da comunidade de Boipeba reunidas em formação, com cadernos e materiais de trabalho.',
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
import oficinaOriginal from './oficina-escola.jpeg';
import oficina800 from './webp/oficina-escola-800.webp';
import oficina1200 from './webp/oficina-escola-1200.webp';
import oficina1600 from './webp/oficina-escola-1600.webp';
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

/** Oficina na escola da ilha: a serpente de garrafas PET iluminada. */
export const oficinaEscola = {
  fallback: oficinaOriginal,
  webp: srcset([[oficina800, 800], [oficina1200, 1200], [oficina1600, 1600]]),
  width: 1600,
  height: 1200,
  alt: 'Crianças de uma escola de Boipeba erguem uma serpente iluminada feita de garrafas PET, em oficina com o Instituto Vivá.',
};
/** Para o fundo em CSS, onde um `<picture>` não cabe. */
export const oficinaEscolaUrl = oficina1600;

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
