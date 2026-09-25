/* ---------------------------------------------------------------------------
   Gera as versões WebP das fotos da landing.

   As fotos originais (JPEG/PNG) continuam no repositório e continuam sendo o
   fallback do <picture>; o que este script produz são as variantes servidas de
   fato, em WebP e em algumas larguras, para o navegador escolher a menor que
   serve. Rode `node scripts/otimizar-imagens.mjs` depois de trocar ou incluir
   uma foto e commite o que ele gerar — assim o build não depende do sharp.
--------------------------------------------------------------------------- */
import sharp from 'sharp';
import { mkdir, readdir, unlink, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origem = join(raiz, 'src/landing/images');
const destino = join(origem, 'webp');

/* Larguras pedidas por foto: o suficiente para 1x e 2x no maior uso de cada
   uma, sem gerar arquivo que ninguém baixa. */
const FOTOS = [
  { arquivo: 'coleta-validacao.jpeg', larguras: [800, 1200, 1600] },
  { arquivo: 'renda-direta.jpeg', larguras: [800, 1200, 1600] },
  { arquivo: 'pilares.jpeg', larguras: [600, 900, 1186] },
  { arquivo: 'fundo-infancia.png', larguras: [335, 670] },
  { arquivo: 'logo_raizes.png', larguras: [96, 192] },
  /* as fotos enviadas pela equipe em setembro de 2026 */
  { arquivo: 'oficina-escola.jpeg', larguras: [800, 1200, 1600] },
  { arquivo: 'balanca-pesagem.jpeg', larguras: [800, 1200, 1600] },
  { arquivo: 'pesagem-sacos.jpeg', larguras: [800, 1200, 1428] },
  { arquivo: 'mutirao-grupo.jpeg', larguras: [800, 1200, 1600] },
  { arquivo: 'crianca-escola.jpeg', larguras: [600, 963] },
];

await mkdir(destino, { recursive: true });

/* Limpa o que sobrou de execuções anteriores para não deixar variante órfã de
   foto que já foi trocada. */
for (const antigo of await readdir(destino).catch(() => [])) {
  await unlink(join(destino, antigo));
}

let total = 0;
for (const { arquivo, larguras } of FOTOS) {
  const base = arquivo.replace(/\.[^.]+$/, '');
  const entrada = join(origem, arquivo);
  const { width: larguraOriginal } = await sharp(entrada).metadata();

  for (const largura of larguras) {
    if (largura > larguraOriginal) continue; // não inventar pixel que não existe
    const saida = join(destino, `${base}-${largura}.webp`);
    await sharp(entrada)
      .resize({ width: largura, withoutEnlargement: true })
      .webp({ quality: 78, effort: 6 })
      .toFile(saida);
    const { size } = await stat(saida);
    total += size;
    console.log(`${base}-${largura}.webp`.padEnd(34), `${Math.round(size / 1024)} kB`);
  }
}
console.log(`\nTotal em WebP: ${Math.round(total / 1024)} kB`);
