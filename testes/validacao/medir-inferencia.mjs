/* ---------------------------------------------------------------------------
   Mede a inferência no navegador de verdade.

     npm run medir:inferencia

   O critério do módulo é "abaixo de 1 segundo em celular Android de entrada", e
   número de biblioteca em Python não responde isso: o que roda em campo é
   WebAssembly dentro do navegador. Este script sobe o Edge headless (o mesmo que
   a suíte antiga usa, em testes/navegador.mjs), abre o app de campo e cronometra
   a classificação de verdade, com o modelo exportado.

   Sobre o "celular de entrada": o notebook de quem desenvolve é bem mais rápido.
   Por isso o script também mede com a CPU estrangulada em 4x e 6x pelo CDP, que
   é a aproximação padrão de aparelho modesto. O alvo de 1 segundo vale para a
   medição estrangulada.

   Pula com aviso claro, em vez de falhar, quando falta Edge, servidor ou modelo:
   pular é o comportamento certo para quem clonou o repositório e ainda não
   treinou nada.
--------------------------------------------------------------------------- */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..', '..');
const ALVO = process.env.ALVO ?? 'http://localhost:5173';
const PORTA = 9444;
const LIMITE_MS = 1000;

const CAMINHOS_EDGE = [
  process.env.EDGE,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const espera = ms => new Promise(r => setTimeout(r, ms));
const pular = motivo => {
  console.log(`\n[medição] pulada: ${motivo}`);
  process.exit(0);
};

if (!existsSync(join(RAIZ, 'public', 'modelo', 'classificador.onnx'))) {
  pular('o modelo ainda não foi exportado (veja modelo/README.md)');
}
const edgeExe = CAMINHOS_EDGE.find(existsSync);
if (!edgeExe) pular('Edge não encontrado (defina EDGE=caminho\\para\\msedge.exe)');

/* Dez segundos: a primeira resposta do servidor de desenvolvimento inclui
   transformar o app inteiro, e passa de dois segundos com folga. */
try {
  await fetch(`${ALVO}/campo.html`, { signal: AbortSignal.timeout(10000) });
} catch {
  pular(`nada respondendo em ${ALVO}. Rode \`npm run dev\` em outro terminal.`);
}

/* ------------------------------------------------------------- CDP mínimo --- */

const perfil = mkdtempSync(join(tmpdir(), 'edge-medicao-'));
const edge = spawn(edgeExe, [
  '--headless=new', `--remote-debugging-port=${PORTA}`, `--user-data-dir=${perfil}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  'about:blank',
], { stdio: 'ignore' });

let ws, proximo = 1;
const pendentes = new Map();

async function urlDaPagina() {
  for (let i = 0; i < 60; i++) {
    try {
      const alvos = await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json();
      const pagina = alvos.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (pagina) return pagina.webSocketDebuggerUrl;
    } catch { /* ainda subindo */ }
    await espera(300);
  }
  throw new Error('Edge não respondeu na porta de depuração');
}

function cdp(metodo, params = {}) {
  const id = proximo++;
  ws.send(JSON.stringify({ id, method: metodo, params }));
  return new Promise((res, rej) => {
    pendentes.set(id, { res, rej });
    setTimeout(() => { if (pendentes.delete(id)) rej(new Error('timeout em ' + metodo)); }, 120000);
  });
}

async function avaliar(expressao) {
  const r = await cdp('Runtime.evaluate', {
    expression: `(async () => { ${expressao} })()`,
    returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error('erro na página: '
      + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
  }
  return r.result.value;
}

/* ------------------------------------------------------------- a medição --- */

/* Roda dentro da página. Importa o módulo do classificador direto do código
   fonte (o Vite serve TypeScript em desenvolvimento), monta uma imagem sintética
   do tamanho de uma foto de celular e cronometra. */
const MEDIR = `
  const mod = await import('/src/validacao/ia/classificador.ts');
  const classificador = new mod.Classificador({ base: '/modelo' });
  await classificador.iniciar();
  if (classificador.estado !== 'pronto') {
    return { erro: classificador.motivoIndisponivel ?? classificador.estado };
  }

  // Foto sintética de 1280x960, tamanho típico do que a câmera entrega.
  const tela = new OffscreenCanvas(1280, 960);
  const ctx = tela.getContext('2d');
  ctx.fillStyle = '#d6c8a8';
  ctx.fillRect(0, 0, 1280, 960);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = 'hsl(' + (i * 37 % 360) + ', 45%, 55%)';
    ctx.fillRect((i * 97) % 1000, (i * 61) % 700, 160, 120);
  }
  const foto = tela.transferToImageBitmap();

  const tempos = [];
  for (let i = 0; i < 25; i++) {
    const r = await classificador.classificar(foto);
    if (!r) return { erro: 'classificador devolveu null' };
    tempos.push(r.duracaoMs);
  }
  tempos.sort((a, b) => a - b);
  return {
    versao: classificador.versao,
    mediana: tempos[Math.floor(tempos.length / 2)],
    p95: tempos[Math.floor(tempos.length * 0.95)],
    pior: tempos[tempos.length - 1],
    melhor: tempos[0],
  };
`;

let falhou = false;

try {
  // WebSocket global, nativo desde o Node 22: sem dependência para falar CDP.
  ws = new WebSocket(await urlDaPagina());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = evento => {
    const msg = JSON.parse(evento.data);
    const pendente = pendentes.get(msg.id);
    if (!pendente) return;
    pendentes.delete(msg.id);
    msg.error ? pendente.rej(new Error(msg.error.message)) : pendente.res(msg.result);
  };

  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Page.navigate', { url: `${ALVO}/campo.html` });
  await espera(3000);

  console.log('\n=== inferência no navegador (Edge headless) ===\n');
  let excedeu = false;

  for (const fator of [1, 4, 6]) {
    await cdp('Emulation.setCPUThrottlingRate', { rate: fator });
    const medida = await avaliar(MEDIR);

    if (medida.erro) {
      console.log(`  modelo indisponível: ${medida.erro}`);
      falhou = true;
      break;
    }
    const rotulo = fator === 1
      ? 'sem estrangulamento (notebook)'
      : `CPU ${fator}x mais lenta (aproxima celular de entrada)`;
    console.log(`  ${rotulo}`);
    console.log(`    mediana ${medida.mediana} ms   p95 ${medida.p95} ms   `
      + `pior ${medida.pior} ms   melhor ${medida.melhor} ms`);
    if (fator > 1 && medida.p95 > LIMITE_MS) excedeu = true;
    if (fator === 1) console.log(`    modelo: ${medida.versao}`);
  }

  if (!falhou) {
    console.log(excedeu
      ? `\n  ✗ o p95 estrangulado passou de ${LIMITE_MS} ms: o alvo do módulo não está sendo cumprido`
      : `\n  ✓ abaixo de ${LIMITE_MS} ms mesmo com a CPU estrangulada em 6x`);
    falhou = excedeu;
  }
} catch (erro) {
  console.log(`\n[medição] erro: ${erro.message}`);
  falhou = true;
} finally {
  try { ws?.close(); } catch { /* já fechado */ }
  edge.kill();
  await espera(1000);
  /* O Windows ainda segura arquivos do perfil por um instante depois de o
     processo morrer, e falhar a limpeza depois de medir com sucesso seria
     trocar um resultado bom por um erro sem consequência. */
  try {
    rmSync(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    console.log(`  (perfil temporário ficou em ${perfil}, o sistema limpa depois)`);
  }
}

process.exit(falhou ? 1 : 0);
