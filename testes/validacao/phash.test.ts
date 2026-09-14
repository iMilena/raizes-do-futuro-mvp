/* ---------------------------------------------------------------------------
   pHash: os casos construídos que a camada antifraude precisa acertar.

   A pergunta de cada teste é operacional, não matemática: se o catador
   refotografar a mesma pilha, o sistema percebe? Se ele fotografar OUTRA pilha
   parecida, o sistema deixa passar?
--------------------------------------------------------------------------- */
import { describe, expect, it } from 'vitest';
import {
  calcularPHash, distanciaHamming, LIMIAR_HAMMING_PADRAO, mesmaCena,
} from '../../src/validacao/antifraude/phash.js';
import { estimarOcupacao, LADO_ANALISE } from '../../src/validacao/antifraude/ocupacao.js';
import { escurecer, fotoSintetica, paraCinza32, paraRgb, recomprimir, redimensionar } from './imagens.js';

const AREIA = { r: 214, g: 200, b: 170 };
const PET_VERDE = { r: 60, g: 130, b: 80 };
const PAPELAO = { r: 150, g: 110, b: 70 };

/** Uma pilha de PET na areia, 640x480. */
const pilhaPet = () => fotoSintetica(640, 480, AREIA, [
  { x: 120, y: 90, largura: 260, altura: 220, cor: PET_VERDE },
  { x: 300, y: 200, largura: 180, altura: 160, cor: { r: 90, g: 160, b: 110 } },
]);

/** Outra pilha, outro material, outro arranjo. */
const pilhaPapelao = () => fotoSintetica(640, 480, AREIA, [
  { x: 40, y: 260, largura: 500, altura: 150, cor: PAPELAO },
]);

const hashDe = async (imagem: Buffer) => calcularPHash(await paraCinza32(imagem));

describe('pHash', () => {
  it('tem 64 bits, em 16 dígitos hexadecimais', async () => {
    expect(await hashDe(await pilhaPet())).toMatch(/^[0-9a-f]{16}$/);
  });

  it('a mesma foto dá sempre o mesmo hash', async () => {
    const foto = await pilhaPet();
    expect(await hashDe(foto)).toBe(await hashDe(foto));
  });

  it('recusa entrada com tamanho errado, em vez de devolver hash sem sentido', () => {
    expect(() => calcularPHash(new Uint8Array(100))).toThrow(/1024/);
  });

  it('reconhece a foto recomprimida em JPEG como a mesma cena', async () => {
    const original = await pilhaPet();
    const ruim = await recomprimir(original, 35);
    const distancia = distanciaHamming(await hashDe(original), await hashDe(ruim));
    expect(distancia).toBeLessThanOrEqual(LIMIAR_HAMMING_PADRAO);
  });

  it('reconhece a foto redimensionada como a mesma cena', async () => {
    const original = await pilhaPet();
    const menor = await redimensionar(original, 320, 240);
    expect(mesmaCena(await hashDe(original), await hashDe(menor))).toBe(true);
  });

  it('reconhece a mesma pilha fotografada mais escura, na sombra', async () => {
    const original = await pilhaPet();
    const sombra = await escurecer(original, 0.65);
    expect(mesmaCena(await hashDe(original), await hashDe(sombra))).toBe(true);
  });

  it('separa duas coletas de material e arranjo diferentes', async () => {
    const distancia = distanciaHamming(await hashDe(await pilhaPet()), await hashDe(await pilhaPapelao()));
    expect(distancia).toBeGreaterThan(LIMIAR_HAMMING_PADRAO);
  });

  it('separa a mesma pilha depois de mudar bastante o arranjo', async () => {
    const antes = await fotoSintetica(640, 480, AREIA, [
      { x: 60, y: 60, largura: 200, altura: 180, cor: PET_VERDE },
    ]);
    const depois = await fotoSintetica(640, 480, AREIA, [
      { x: 380, y: 260, largura: 200, altura: 180, cor: PET_VERDE },
    ]);
    expect(distanciaHamming(await hashDe(antes), await hashDe(depois)))
      .toBeGreaterThan(LIMIAR_HAMMING_PADRAO);
  });
});

describe('distância de Hamming', () => {
  it('é zero para hashes iguais e 64 para hashes opostos', () => {
    expect(distanciaHamming('0000000000000000', '0000000000000000')).toBe(0);
    expect(distanciaHamming('0000000000000000', 'ffffffffffffffff')).toBe(64);
  });

  it('conta bit a bit', () => {
    expect(distanciaHamming('0000000000000001', '0000000000000000')).toBe(1);
    expect(distanciaHamming('f000000000000000', '0000000000000000')).toBe(4);
  });

  it('recusa hash malformado em vez de comparar lixo', () => {
    expect(() => distanciaHamming('abc', 'def')).toThrow();
    expect(() => distanciaHamming('zzzzzzzzzzzzzzzz', '0000000000000000')).toThrow();
  });
});

describe('ocupação do quadro', () => {
  it('é quase zero em foto sem material', async () => {
    const vazia = await fotoSintetica(320, 320, AREIA, []);
    expect(await estimarOcupacao(await paraRgb(vazia, LADO_ANALISE), LADO_ANALISE))
      .toBeLessThan(0.05);
  });

  it('cresce com a área ocupada pelo material', async () => {
    const pouco = await fotoSintetica(320, 320, AREIA, [
      { x: 130, y: 130, largura: 60, altura: 60, cor: PET_VERDE },
    ]);
    const muito = await fotoSintetica(320, 320, AREIA, [
      { x: 20, y: 20, largura: 280, altura: 280, cor: PET_VERDE },
    ]);
    const ocupacaoPouco = estimarOcupacao(await paraRgb(pouco, LADO_ANALISE), LADO_ANALISE);
    const ocupacaoMuito = estimarOcupacao(await paraRgb(muito, LADO_ANALISE), LADO_ANALISE);

    expect(ocupacaoPouco).toBeGreaterThan(0.02);
    expect(ocupacaoPouco).toBeLessThan(0.15);
    expect(ocupacaoMuito).toBeGreaterThan(0.6);
  });

  it('recusa buffer com tamanho incompatível', () => {
    expect(() => estimarOcupacao(new Uint8Array(10), LADO_ANALISE)).toThrow();
  });
});
