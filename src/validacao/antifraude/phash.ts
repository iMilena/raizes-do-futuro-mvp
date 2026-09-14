/* ---------------------------------------------------------------------------
   Hash perceptual (pHash) por DCT, 64 bits.

   O que ele resolve: o catador tira foto da mesma pilha duas vezes, ou refotografa
   a foto de ontem na tela de outro celular. O SHA-256 que o app já calcula em
   src/lib/evidencia.js não pega nada disso, porque um pixel diferente muda o
   hash inteiro. É essa a razão de existir deste arquivo: o SHA-256 prova que o
   arquivo não foi adulterado, o pHash prova que a CENA não se repetiu.

   Como funciona, em quatro passos:
     1. reduz a 32x32 em tons de cinza (some cor, ruído e resolução)
     2. DCT 2D (separa o que é forma do que é detalhe)
     3. fica com o bloco 8x8 de baixa frequência, que é a estrutura da cena
     4. cada coeficiente vira 1 bit: acima ou abaixo da mediana

   O termo DC (posição 0,0) sai da conta da mediana: ele é o brilho médio da
   foto, e foto tirada contra o sol e foto tirada na sombra da mesma pilha são a
   mesma cena. Deixá-lo dentro faria a mediana dançar com a luz do dia.

   Implementação em JS puro, sem WebAssembly: são 32x32 valores, custa menos de
   10 ms no celular, e uma dependência a mais no bundle offline custa mais que isso.
--------------------------------------------------------------------------- */

/** Lado da matriz reduzida antes da DCT. */
export const LADO_REDUZIDO = 32;
/** Lado do bloco de baixa frequência que vira hash. 8x8 = 64 bits. */
export const LADO_HASH = 8;

/**
 * Limiar padrão de distância de Hamming para considerar duas fotos "a mesma cena".
 *
 * 8 de 64 bits é o ponto de partida da literatura, e está aqui como padrão, não
 * como verdade: precisa ser calibrado com as fotos reais de Boipeba, onde areia,
 * sol forte e fundo repetido (a mesma parede do ponto de coleta em toda foto)
 * empurram fotos legitimamente distintas para perto.
 */
export const LIMIAR_HAMMING_PADRAO = 8;

/* Matriz de cossenos pré-calculada. É a mesma para toda foto, e recalcular
   1024 cossenos por imagem seria o gasto bobo deste módulo. */
const COSSENOS = (() => {
  const m = new Float64Array(LADO_REDUZIDO * LADO_REDUZIDO);
  for (let x = 0; x < LADO_REDUZIDO; x++) {
    for (let u = 0; u < LADO_REDUZIDO; u++) {
      m[x * LADO_REDUZIDO + u] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * LADO_REDUZIDO));
    }
  }
  return m;
})();

const RAIZ_MEIO = Math.SQRT1_2;

/**
 * DCT-II bidimensional de uma matriz quadrada de lado `LADO_REDUZIDO`.
 * Separável: primeiro nas linhas, depois nas colunas. O ingênuo em O(n^4)
 * faria um milhão de multiplicações onde bastam 65 mil.
 */
function dct2d(entrada: Float64Array): Float64Array {
  const n = LADO_REDUZIDO;
  const linhas = new Float64Array(n * n);

  for (let y = 0; y < n; y++) {
    for (let u = 0; u < n; u++) {
      let soma = 0;
      for (let x = 0; x < n; x++) soma += entrada[y * n + x]! * COSSENOS[x * n + u]!;
      linhas[y * n + u] = soma * (u === 0 ? RAIZ_MEIO : 1);
    }
  }

  const saida = new Float64Array(n * n);
  for (let u = 0; u < n; u++) {
    for (let v = 0; v < n; v++) {
      let soma = 0;
      for (let y = 0; y < n; y++) soma += linhas[y * n + u]! * COSSENOS[y * n + v]!;
      saida[v * n + u] = soma * (v === 0 ? RAIZ_MEIO : 1);
    }
  }
  return saida;
}

function mediana(valores: number[]): number {
  const ordenado = [...valores].sort((a, b) => a - b);
  const meio = ordenado.length >> 1;
  return ordenado.length % 2 === 0
    ? (ordenado[meio - 1]! + ordenado[meio]!) / 2
    : ordenado[meio]!;
}

/**
 * Calcula o pHash a partir de 32x32 valores de luminância (0 a 255).
 *
 * Núcleo puro de propósito: quem reduz a imagem é o navegador (canvas) em
 * produção e a biblioteca de imagem nos testes. Se este arquivo dependesse de
 * canvas, não daria para testá-lo com foto de verdade fora do navegador.
 */
export function calcularPHash(cinza: ArrayLike<number>): string {
  const total = LADO_REDUZIDO * LADO_REDUZIDO;
  if (cinza.length !== total) {
    throw new Error(`pHash espera ${total} valores de luminância, recebeu ${cinza.length}`);
  }
  const matriz = new Float64Array(total);
  for (let i = 0; i < total; i++) matriz[i] = cinza[i]!;

  const dct = dct2d(matriz);

  const coeficientes: number[] = [];
  for (let y = 0; y < LADO_HASH; y++) {
    for (let x = 0; x < LADO_HASH; x++) coeficientes.push(dct[y * LADO_REDUZIDO + x]!);
  }

  // Mediana sem o DC, que é só o brilho médio da foto.
  const med = mediana(coeficientes.slice(1));

  let hex = '';
  for (let bloco = 0; bloco < 8; bloco++) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit++) {
      if (coeficientes[bloco * 8 + bit]! > med) byte |= 1 << (7 - bit);
    }
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

const BITS_POR_NIBBLE = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

const RE_PHASH = /^[0-9a-f]{16}$/;

/**
 * Quantos bits diferem entre dois pHashes. Vai de 0 (idêntico) a 64 (oposto).
 *
 * O formato é conferido por expressão regular, e não por `Number.isNaN` depois
 * do XOR: `parseInt('z', 16)` dá NaN, e `NaN ^ NaN` dá 0, então a checagem
 * depois da conta diria que dois hashes inválidos são idênticos.
 */
export function distanciaHamming(a: string, b: string): number {
  if (!RE_PHASH.test(a) || !RE_PHASH.test(b)) {
    throw new Error(`pHash deve ter 16 dígitos hexadecimais minúsculos: recebi "${a}" e "${b}"`);
  }
  let distancia = 0;
  for (let i = 0; i < 16; i++) {
    distancia += BITS_POR_NIBBLE[parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16)]!;
  }
  return distancia;
}

/** Duas fotos são a mesma cena, dentro do limiar? */
export function mesmaCena(a: string, b: string, limiar = LIMIAR_HAMMING_PADRAO): boolean {
  return distanciaHamming(a, b) <= limiar;
}

/* ------------------------------------------------------- lado do navegador --- */

/**
 * Reduz qualquer imagem a 32x32 em tons de cinza, usando canvas.
 *
 * Luminância com os coeficientes do Rec. 601 (0.299 / 0.587 / 0.114) e não a
 * média dos canais: a média trata azul e verde como igualmente brilhantes, e
 * garrafa PET verde contra areia clara é caso de uso, não exceção.
 */
export function reduzirParaCinza(fonte: CanvasImageSource): Float64Array {
  const canvas = criarCanvas(LADO_REDUZIDO, LADO_REDUZIDO);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('canvas 2d indisponível neste navegador');

  ctx.drawImage(fonte, 0, 0, LADO_REDUZIDO, LADO_REDUZIDO);
  const { data } = ctx.getImageData(0, 0, LADO_REDUZIDO, LADO_REDUZIDO);

  const cinza = new Float64Array(LADO_REDUZIDO * LADO_REDUZIDO);
  for (let i = 0; i < cinza.length; i++) {
    cinza[i] = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
  }
  return cinza;
}

function criarCanvas(largura: number, altura: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(largura, altura);
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  return canvas;
}

/** pHash de uma foto recém tirada, no navegador. */
export async function pHashDeBlob(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  try {
    return calcularPHash(reduzirParaCinza(bitmap));
  } finally {
    bitmap.close();
  }
}
