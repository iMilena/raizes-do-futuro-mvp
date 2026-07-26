/* ---------------------------------------------------------------------------
   Prova que o encoder de QR de src/qr.js gera códigos que um leitor real
   decodifica.

   Por que assim: um QR errado é pior que nenhum QR — num pitch alguém aponta
   a câmera. Como o Edge no Windows não expõe `BarcodeDetector`, a verificação
   usa um decodificador de referência (jsQR) baixado do CDN só durante o teste.
   Ele não entra no projeto: o app continua sem dependência de terceiros.
--------------------------------------------------------------------------- */
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, rmSync } from 'node:fs';
import { abrirNavegador, espera } from './ajuda/cdp.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const TMP = join(AQUI, '.tmp-qr');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ FALHOU: ') + m); if (!c) falhas++; };

/* empacota o encoder para a página poder usá-lo como global */
mkdirSync(TMP, { recursive: true });
const bin = n => join(RAIZ, 'node_modules', '.bin', process.platform === 'win32' ? n + '.cmd' : n);
const emp = spawnSync(bin('esbuild'), [
  join(RAIZ, 'src', 'qr.js'), '--bundle', '--format=iife',
  '--global-name=QRLIB', '--log-level=warning', '--outfile=' + join(TMP, 'qr-bundle.js'),
], { encoding: 'utf8', shell: process.platform === 'win32' });
if (emp.status !== 0) {
  console.error('não foi possível empacotar src/qr.js:\n' + (emp.stderr || emp.stdout));
  process.exit(1);
}
spawnSync(process.execPath, ['-e',
  `require('fs').copyFileSync(${JSON.stringify(join(AQUI, 'ajuda', 'qr-pagina.html'))}, ${JSON.stringify(join(TMP, 'index.html'))})`,
]);

let nav;
try {
  nav = await abrirNavegador({ porta: 9339 });
  await nav.cdp('Page.navigate', { url: pathToFileURL(join(TMP, 'index.html')).href });

  let pronto = false;
  for (let i = 0; i < 40 && !pronto; i++) {
    await espera(500);
    pronto = await nav.ev('return document.title === "pronto"');
  }
  if (!pronto) throw new Error('a página de verificação não terminou (CDN inacessível?)');

  const casos = await nav.ev('return window.__resultado');
  for (const c of casos) {
    if (c.erro) { ok(false, 'erro: ' + c.erro); continue; }
    ok(c.ok, `v${c.versao}-${c.nivel} máscara ${c.mascara} (${c.lado}×${c.lado}) · "${c.texto}"`);
    if (!c.ok) console.log('      decodificou: ' + JSON.stringify(c.decodificado));
  }
  ok(casos.length >= 5, `${casos.length} casos exercitados`);
  ok(casos.some(c => /—|í/.test(c.texto)), 'inclui texto acentuado (modo byte UTF-8)');
  ok(casos.some(c => c.nivel === 'L'), 'inclui o recuo automático para nível L quando o texto é longo');
} catch (e) {
  console.log('  ✗ ' + e.message);
  falhas++;
} finally {
  if (nav) await nav.fechar();
  try { rmSync(TMP, { recursive: true, force: true }); } catch { /* ignora */ }
}

console.log('\n' + '─'.repeat(52));
console.log(falhas === 0 ? '✅ todos os QR decodificaram corretamente' : `❌ ${falhas} problema(s)`);
process.exit(falhas === 0 ? 0 : 1);
