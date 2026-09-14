/* ---------------------------------------------------------------------------
   Quanto do quadro da foto está ocupado por material.

   Leia isto antes de usar o número: ele NÃO é volume, NÃO vira litro e NÃO vira
   peso. É a fração da imagem que difere do fundo. Serve para uma pergunta só,
   feita em deteccoes.ts: o que aparece na foto é compatível, na ordem de
   grandeza, com o peso que veio da balança?

   A tentação de transformar isto em estimador de peso existe e está descartada
   por decisão de projeto: sem câmera calibrada e sem referência de escala no
   quadro, o erro é grande demais para sustentar auditoria, e um número errado
   com aparência de medida é pior que nenhum número.

   Método, propositalmente simples: o fundo é estimado pela borda da imagem (a
   areia, o chão de cimento, a lona), e conta-se quanto do centro se afasta dele.
   Segmentação de verdade exigiria um segundo modelo, mais megabytes no bundle e
   mais tempo de inferência, para melhorar uma checagem que é grosseira por
   desenho.
--------------------------------------------------------------------------- */

/** Lado da imagem reduzida para a análise. 64 basta e custa quase nada. */
export const LADO_ANALISE = 64;

/** Distância de cor, acima da qual o pixel é considerado "material" e não fundo. */
export const LIMIAR_DIFERENCA_PADRAO = 42;

interface Cor { r: number; g: number; b: number }

function corDaBorda(rgb: ArrayLike<number>, lado: number): Cor {
  /* Mediana por canal, e não média: um objeto que encosta na borda puxa a média
     para a cor dele, e a mediana simplesmente ignora a minoria. */
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const naBorda = x === 0 || y === 0 || x === lado - 1 || y === lado - 1;
      if (!naBorda) continue;
      const i = (y * lado + x) * 3;
      rs.push(rgb[i]!); gs.push(rgb[i + 1]!); bs.push(rgb[i + 2]!);
    }
  }
  const mediana = (v: number[]) => v.sort((a, b) => a - b)[v.length >> 1]!;
  return { r: mediana(rs), g: mediana(gs), b: mediana(bs) };
}

/**
 * Fração do quadro ocupada por material, de 0 a 1.
 *
 * Recebe RGB puro (3 bytes por pixel) de uma imagem quadrada de lado `lado`,
 * para poder ser testada fora do navegador.
 */
export function estimarOcupacao(
  rgb: ArrayLike<number>,
  lado = LADO_ANALISE,
  limiar = LIMIAR_DIFERENCA_PADRAO,
): number {
  if (rgb.length !== lado * lado * 3) {
    throw new Error(`esperado ${lado * lado * 3} bytes RGB, recebido ${rgb.length}`);
  }
  const fundo = corDaBorda(rgb, lado);
  let diferentes = 0;

  for (let p = 0; p < lado * lado; p++) {
    const i = p * 3;
    // Distância de Manhattan em vez de euclidiana: mesma decisão, sem raiz quadrada
    // por pixel, e o limiar é calibrado em cima dela de qualquer forma.
    const distancia =
      Math.abs(rgb[i]! - fundo.r) + Math.abs(rgb[i + 1]! - fundo.g) + Math.abs(rgb[i + 2]! - fundo.b);
    if (distancia > limiar) diferentes++;
  }
  return diferentes / (lado * lado);
}

/** Versão do navegador: reduz a foto e mede. */
export function estimarOcupacaoDaImagem(fonte: CanvasImageSource, lado = LADO_ANALISE): number {
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(lado, lado)
    : Object.assign(document.createElement('canvas'), { width: lado, height: lado });
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('canvas 2d indisponível neste navegador');

  ctx.drawImage(fonte, 0, 0, lado, lado);
  const { data } = ctx.getImageData(0, 0, lado, lado);

  // getImageData devolve RGBA, o núcleo puro trabalha em RGB.
  const rgb = new Uint8Array(lado * lado * 3);
  for (let p = 0; p < lado * lado; p++) {
    rgb[p * 3] = data[p * 4]!;
    rgb[p * 3 + 1] = data[p * 4 + 1]!;
    rgb[p * 3 + 2] = data[p * 4 + 2]!;
  }
  return estimarOcupacao(rgb, lado);
}
