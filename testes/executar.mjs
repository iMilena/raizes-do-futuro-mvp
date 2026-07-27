/* ---------------------------------------------------------------------------
   Runner dos testes do Raízes do Futuro.

     npm test                 roda tudo o que é possível no ambiente
     npm test -- fluxo        só o reducer (rápido, sem navegador)
     npm test -- navegador    só o app no navegador
     npm test -- qr           só o encoder de QR

   Cuida da infraestrutura para quem roda não precisar pensar nela:
     · empacota src/store.jsx (tem JSX, o Node não lê direto)
     · sobe o servidor de desenvolvimento se ainda não estiver no ar, e derruba no fim
     · pula com aviso claro — em vez de falhar — quando o ambiente não tem
       o que a suíte exige (Edge para o navegador, internet para o QR)
--------------------------------------------------------------------------- */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const TMP = join(AQUI, '.tmp');
const ALVO = 'http://localhost:5173';
const espera = ms => new Promise(r => setTimeout(r, ms));

const pedidas = process.argv.slice(2).filter(a => !a.startsWith('-'));
const querem = nome => pedidas.length === 0 || pedidas.includes(nome);

const bin = nome => join(RAIZ, 'node_modules', '.bin', process.platform === 'win32' ? nome + '.cmd' : nome);

/* ------------------------------------------------------- pré-requisitos ---- */
/** Empacota um módulo de src/ para o Node poder importar (tem JSX no caminho). */
function empacotar(entrada, nomeSaida) {
  mkdirSync(TMP, { recursive: true });
  const saida = join(TMP, nomeSaida);
  const r = spawnSync(bin('esbuild'), [
    join(RAIZ, 'src', entrada),
    '--bundle', '--format=esm', '--platform=node',
    '--loader:.jsx=jsx', '--jsx=automatic',
    '--log-level=warning', '--outfile=' + saida,
  ], { encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(`não foi possível empacotar ${entrada}:\n` + (r.stderr || r.stdout));
    process.exit(1);
  }
  return saida;
}

async function noAr(url) {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 1500);
    const r = await fetch(url, { signal: c.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}

async function subirServidor() {
  if (await noAr(ALVO)) return { jaEstava: true, parar: () => {} };
  console.log('  · subindo o servidor de desenvolvimento…');
  const p = spawn(bin('vite'), [], { cwd: RAIZ, stdio: 'ignore', shell: process.platform === 'win32' });
  for (let i = 0; i < 40; i++) {
    await espera(400);
    if (await noAr(ALVO)) return { jaEstava: false, parar: () => { try { p.kill(); } catch { /* já morreu */ } } };
  }
  try { p.kill(); } catch { /* idem */ }
  throw new Error('o servidor não respondeu em http://localhost:5173');
}

const temEdge = () => [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find(existsSync);

async function temInternet() {
  return noAr('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/package.json');
}

/* ------------------------------------------------------------- execução ---- */
/**
 * Código 77 = a suíte se recusou a rodar por falta de pré-requisito.
 *
 * Antes elas saíam com 0 ao pular, e o resumo mostrava ✅ para uma suíte que
 * não verificou nada — "tudo verde" escondendo cobertura perdida, que é pior do
 * que vermelho. Agora pular aparece como pular.
 */
const PULADO = 77;

function rodar(arquivo, env = {}) {
  const r = spawnSync(process.execPath, [join(AQUI, arquivo)], {
    stdio: 'inherit', env: { ...process.env, ...env }, cwd: RAIZ,
  });
  return r.status === PULADO ? 'pulado' : r.status === 0 ? 'ok' : 'falhou';
}

const resultados = [];
const registrar = (nome, estado) => resultados.push({ nome, estado });

console.log('\n🌱 Raízes do Futuro — testes\n');

let servidor = null;
try {
  const store = empacotar('store.jsx', 'store.mjs');
  const sinc = empacotar('sincronizacao.js', 'sinc.mjs');

  if (querem('fluxo')) {
    console.log('── fluxo (reducer, sem navegador) ' + '─'.repeat(24));
    registrar('fluxo', rodar('fluxo.mjs', { STORE_BUNDLE: store, SYNC_BUNDLE: sinc }));
  }

  if (querem('qr')) {
    console.log('\n── encoder de QR (decodificador independente) ' + '─'.repeat(12));
    const edge = temEdge();
    if (!edge) {
      console.log('  ⏭️  pulado: precisa do Microsoft Edge para rasterizar e decodificar');
      registrar('qr', 'pulado');
    } else if (!(await temInternet())) {
      console.log('  ⏭️  pulado: sem internet para baixar o decodificador de referência');
      registrar('qr', 'pulado');
    } else {
      registrar('qr', rodar('qr.mjs', { EDGE: edge }));
    }
  }

  if (querem('nuvem')) {
    console.log('\n── esquema compartilhado (Supabase real) ' + '─'.repeat(17));
    registrar('nuvem', rodar('nuvem.mjs', { STORE_BUNDLE: store, SYNC_BUNDLE: sinc }));
  }

  if (querem('autorizacao')) {
    console.log('\n── autorização e consentimento (Supabase real) ' + '─'.repeat(11));
    registrar('autorizacao', rodar('autorizacao.mjs'));
  }

  if (querem('aparelhos')) {
    console.log('\n── dois aparelhos, um offline ' + '─'.repeat(28));
    const edge = temEdge();
    if (!edge) {
      console.log('  ⏭️  pulado: precisa do Microsoft Edge');
      registrar('aparelhos', 'pulado');
    } else {
      servidor = servidor || await subirServidor();
      registrar('aparelhos', rodar('dois-aparelhos.mjs', { EDGE: edge, ALVO }));
    }
  }
  if (querem('navegador')) {
    console.log('\n── app no navegador ' + '─'.repeat(38));
    const edge = temEdge();
    if (!edge) {
      console.log('  ⏭️  pulado: precisa do Microsoft Edge (suíte usa o DevTools Protocol)');
      registrar('navegador', 'pulado');
    } else {
      servidor = await subirServidor();
      registrar('navegador', rodar('navegador.mjs', { EDGE: edge, ALVO }));
    }
  }
  /* fora do conjunto padrão: só roda quando pedido (`npm test -- telas`),
     porque grava arquivos em capturas/ e serve para conferir com o olho. */
  if (pedidas.includes('telas')) {
    console.log('\n── capturas de tela ' + '─'.repeat(38));
    const edge = temEdge();
    if (!edge) {
      console.log('  ⏭️  pulado: precisa do Microsoft Edge');
      registrar('telas', 'pulado');
    } else {
      servidor = servidor || await subirServidor();
      registrar('telas', rodar('telas.mjs', { EDGE: edge, ALVO }));
    }
  }
} catch (e) {
  console.error('\n✗ ' + e.message);
  registrar('infraestrutura', 'falhou');
} finally {
  if (servidor && !servidor.jaEstava) servidor.parar();
  try { rmSync(TMP, { recursive: true, force: true }); } catch { /* ignora */ }
}

console.log('\n' + '═'.repeat(58));
for (const r of resultados) {
  const marca = { ok: '✅', falhou: '❌', pulado: '⏭️ ' }[r.estado];
  console.log(`  ${marca} ${r.nome}`);
}
const falhou = resultados.some(r => r.estado === 'falhou');
const pulados = resultados.filter(r => r.estado === 'pulado');
if (pulados.length) {
  console.log(`\n⏭️  ${pulados.length} suíte(s) pulada(s): ${pulados.map(p => p.nome).join(', ')}`);
  console.log('   Pular NÃO é passar — a garantia daquela suíte não foi verificada.');
}
console.log(falhou ? '\n❌ há suíte(s) falhando\n' : pulados.length ? '\n✅ o que rodou passou (veja as puladas acima)\n' : '\n✅ tudo verde\n');
process.exit(falhou ? 1 : 0);
