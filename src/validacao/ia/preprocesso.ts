/* ---------------------------------------------------------------------------
   Da foto da câmera para o tensor que o modelo espera.

   Esta é a parte que, quando sai errada, ninguém percebe: o modelo continua
   respondendo, com confiança alta, e errado. Por isso o pré-processamento tem
   de ser o MESMO do treino, e os números que o definem (tamanho, média, desvio)
   não estão escritos aqui: vêm do classificador.json, que é gerado junto com o
   modelo em `exportar.py`.

   O recorte central depois de redimensionar imita `transformacao_avaliacao` do
   treino. A câmera entrega 4:3 ou 16:9, o modelo quer quadrado, e esticar a
   imagem (que seria mais simples) deformaria proporção de garrafa e lata,
   justamente o que distingue PET de alumínio numa foto de longe.
--------------------------------------------------------------------------- */

export interface ParametrosPreprocesso {
  tamanhoEntrada: number;
  media: [number, number, number];
  desvio: [number, number, number];
}

/**
 * Converte a imagem em Float32Array no formato NCHW (1, 3, lado, lado).
 *
 * NCHW e não NHWC porque é o layout que o PyTorch exporta, e converter no
 * JavaScript a cada foto custaria mais do que já custa a inferência.
 */
export function imagemParaTensor(
  fonte: CanvasImageSource,
  largura: number,
  altura: number,
  parametros: ParametrosPreprocesso,
): Float32Array {
  const lado = parametros.tamanhoEntrada;
  const canvas = criarCanvas(lado, lado);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('canvas 2d indisponível neste navegador');

  // Recorte central: pega o maior quadrado do meio da foto e o desenha no canvas.
  const menorLado = Math.min(largura, altura);
  const origemX = (largura - menorLado) / 2;
  const origemY = (altura - menorLado) / 2;
  ctx.drawImage(fonte, origemX, origemY, menorLado, menorLado, 0, 0, lado, lado);

  const { data } = ctx.getImageData(0, 0, lado, lado);
  const tensor = new Float32Array(3 * lado * lado);
  const pixels = lado * lado;

  for (let p = 0; p < pixels; p++) {
    for (let canal = 0; canal < 3; canal++) {
      const valor = data[p * 4 + canal]! / 255;
      tensor[canal * pixels + p] = (valor - parametros.media[canal]!) / parametros.desvio[canal]!;
    }
  }
  return tensor;
}

function criarCanvas(largura: number, altura: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(largura, altura);
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  return canvas;
}

/** Dimensões de qualquer fonte de imagem aceita pelo canvas. */
export function dimensoes(fonte: CanvasImageSource): { largura: number; altura: number } {
  if (fonte instanceof ImageBitmap) return { largura: fonte.width, altura: fonte.height };
  if (typeof HTMLVideoElement !== 'undefined' && fonte instanceof HTMLVideoElement) {
    return { largura: fonte.videoWidth, altura: fonte.videoHeight };
  }
  const qualquer = fonte as { width?: number; height?: number };
  return { largura: qualquer.width ?? 0, altura: qualquer.height ?? 0 };
}
