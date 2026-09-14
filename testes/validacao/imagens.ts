/* Fábrica de imagens sintéticas para os testes de pHash e ocupação.

   Usa `sharp`, que já era dependência do projeto. A alternativa seria fixar
   pHashes calculados uma vez e comparar com constantes, mas isso testaria que o
   código continua igual a si mesmo, e não que ele resiste a recompressão e
   redimensionamento, que é a pergunta de verdade. */
import sharp from 'sharp';
import { LADO_REDUZIDO } from '../../src/validacao/antifraude/phash.js';

export interface Retangulo {
  x: number; y: number; largura: number; altura: number;
  cor: { r: number; g: number; b: number };
}

/** Uma "foto" de teste: fundo liso com alguns blocos, no tamanho pedido. */
export async function fotoSintetica(
  largura: number,
  altura: number,
  fundo: { r: number; g: number; b: number },
  formas: Retangulo[],
  opcoes: { qualidadeJpeg?: number } = {},
): Promise<Buffer> {
  const sobreposicoes = await Promise.all(formas.map(async f => ({
    input: await sharp({
      create: { width: f.largura, height: f.altura, channels: 3, background: f.cor },
    }).png().toBuffer(),
    left: f.x,
    top: f.y,
  })));

  return sharp({ create: { width: largura, height: altura, channels: 3, background: fundo } })
    .composite(sobreposicoes)
    .jpeg({ quality: opcoes.qualidadeJpeg ?? 90 })
    .toBuffer();
}

/** Reduz qualquer imagem aos 32x32 em tons de cinza que o pHash espera. */
export async function paraCinza32(imagem: Buffer): Promise<Uint8Array> {
  const { data } = await sharp(imagem)
    .resize(LADO_REDUZIDO, LADO_REDUZIDO, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new Uint8Array(data);
}

/** Reduz a imagem ao RGB quadrado que o estimador de ocupação espera. */
export async function paraRgb(imagem: Buffer, lado: number): Promise<Uint8Array> {
  const { data } = await sharp(imagem)
    .resize(lado, lado, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new Uint8Array(data);
}

/** Recomprime em JPEG com qualidade baixa, imitando o que o app faz ao salvar. */
export async function recomprimir(imagem: Buffer, qualidade: number): Promise<Buffer> {
  return sharp(imagem).jpeg({ quality: qualidade }).toBuffer();
}

/** Redimensiona, imitando foto da mesma cena tirada com outra resolução. */
export async function redimensionar(imagem: Buffer, largura: number, altura: number): Promise<Buffer> {
  return sharp(imagem).resize(largura, altura, { fit: 'fill' }).jpeg({ quality: 90 }).toBuffer();
}

/** Escurece a imagem, imitando a mesma pilha fotografada na sombra. */
export async function escurecer(imagem: Buffer, fator: number): Promise<Buffer> {
  return sharp(imagem).linear(fator, 0).jpeg({ quality: 90 }).toBuffer();
}
