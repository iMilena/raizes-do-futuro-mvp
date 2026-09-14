/* ---------------------------------------------------------------------------
   Fumaça das telas novas, no navegador de verdade.

     npm run dev            (em outro terminal)
     npm run fumaca:telas

   Os 184 testes em Vitest cobrem a lógica: evidência, antifraude, Merkle, fila,
   revisão. Não cobrem "a tela abre". Este script cobre, e é rápido: sobe o Edge
   headless (o mesmo caminho da suíte antiga, em testes/navegador.mjs), abre as
   duas páginas e confere o que precisa estar lá.

   Inclui uma verificação que não é decorativa: o alvo de toque do botão
   principal. O app é para ser usado de pé, no sol, com dedo molhado, e um botão
   que encolheu por causa de um CSS mexido é uma regressão de verdade, ainda que
   nenhum teste de lógica perceba.
--------------------------------------------------------------------------- */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ALVO = process.env.ALVO ?? 'http://localhost:5173';
const PORTA = 9555;
const CAMINHOS_EDGE = [
  process.env.EDGE,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const espera = ms => new Promise(r => setTimeout(r, ms));
const pular = motivo => { console.log(`\n[fumaça] pulada: ${motivo}`); process.exit(0); };

const edgeExe = CAMINHOS_EDGE.find(existsSync);
if (!edgeExe) pular('Edge não encontrado (defina EDGE=caminho\\para\\msedge.exe)');
/* Dez segundos, e sondando campo.html em vez da raiz. A primeira resposta do
   servidor de desenvolvimento inclui transformar o app inteiro, e passa de dois
   segundos com folga: sonda curta faz o teste "pular" por lentidão, que é o
   jeito mais silencioso de um teste deixar de rodar. */
try {
  await fetch(`${ALVO}/campo.html`, { signal: AbortSignal.timeout(10000) });
} catch {
  pular(`nada respondendo em ${ALVO}. Rode \`npm run dev\` em outro terminal.`);
}

const temModelo = existsSync(new URL('../../public/modelo/classificador.json', import.meta.url));

const perfil = mkdtempSync(join(tmpdir(), 'edge-fumaca-'));
const edge = spawn(edgeExe, ['--headless=new', `--remote-debugging-port=${PORTA}`,
  `--user-data-dir=${perfil}`, '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', 'about:blank'], { stdio: 'ignore' });

let ws, proximo = 1;
const pendentes = new Map();
const erros = [];
let falhas = 0;

const ok = (cond, msg) => {
  console.log((cond ? '  ✓ ' : '  ✗ FALHOU: ') + msg);
  if (!cond) falhas++;
};

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
    setTimeout(() => { if (pendentes.delete(id)) rej(new Error('timeout em ' + metodo)); }, 30000);
  });
}

async function ev(expressao) {
  const r = await cdp('Runtime.evaluate', {
    expression: `(async () => { ${expressao} })()`, returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  }
  return r.result.value;
}

try {
  ws = new WebSocket(await urlDaPagina());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = evento => {
    const msg = JSON.parse(evento.data);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      erros.push(msg.params.args.map(a => a.value ?? a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      erros.push(msg.params.exceptionDetails.exception?.description
        ?? msg.params.exceptionDetails.text);
    }
    const pendente = pendentes.get(msg.id);
    if (!pendente) return;
    pendentes.delete(msg.id);
    msg.error ? pendente.rej(new Error(msg.error.message)) : pendente.res(msg.result);
  };

  await cdp('Runtime.enable');
  await cdp('Page.enable');

  console.log('\n--- app de campo (campo.html) ---');
  await cdp('Page.navigate', { url: `${ALVO}/campo.html` });
  await espera(4000);

  ok(await ev(`return !!document.querySelector('.campo-topo h1')`), 'cabeçalho renderizou');
  ok(await ev(`return document.querySelector('.botao-gigante')?.textContent.includes('Nova coleta')`),
    'botão principal presente');
  ok(await ev(`return document.querySelectorAll('.fila-caixa').length === 3`),
    'resumo da fila presente');
  ok(await ev(`
    const r = document.querySelector('.botao-gigante').getBoundingClientRect();
    return r.height >= 64 && r.width >= 200;
  `), 'alvo de toque grande o bastante para dedo molhado');
  ok(await ev(`
    const bancos = await indexedDB.databases();
    return bancos.some(b => b.name === 'raizes-validacao');
  `), 'banco local criado na abertura');

  if (temModelo) {
    ok(await ev(`
      const m = await (await fetch('/modelo/classificador.json')).json();
      return m.classes.join(',') === 'PET,aluminio,vidro,papelao,outros';
    `), 'manifesto do modelo servido com as classes na ordem certa');
  } else {
    console.log('  ⏭  modelo não exportado, checagem do manifesto pulada');
  }

  const passo = await ev(`
    [...document.querySelectorAll('button')]
      .find(b => b.textContent.includes('Nova coleta')).click();
    await new Promise(r => setTimeout(r, 400));
    return document.querySelector('.campo-pergunta')?.textContent ?? '(nada)';
  `);
  ok(passo.includes('Fotografe'), `o fluxo começa pela foto: "${passo}"`);

  console.log('\n--- painel de revisão (revisao.html) ---');
  await cdp('Page.navigate', { url: `${ALVO}/revisao.html` });
  await espera(3000);

  ok(await ev(`return document.querySelector('.revisao-topo h1')?.textContent.includes('Validação')`),
    'cabeçalho renderizou');
  ok(await ev(`return document.querySelectorAll('.numero-caixa').length === 5`),
    'números do topo presentes');
  ok(await ev(`return document.querySelectorAll('.filtro').length === 3`), 'filtros presentes');
  ok(await ev(`return !!document.querySelector('.revisao-lotes table')`),
    'tabela de lotes diários presente');

  console.log('\n--- a mesma tela, dentro do painel da operação ---');
  await cdp('Page.navigate', { url: `${ALVO}/#/painel` });
  await espera(3500);

  const abriu = await ev(`
    const alvo = [...document.querySelectorAll('button')]
      .find(b => b.textContent.includes('Conferência'));
    if (!alvo) return 'aba não encontrada no menu';
    alvo.click();
    await new Promise(r => setTimeout(r, 1200));
    return document.querySelector('.revisao') ? 'ok' : 'a aba abriu vazia';
  `);
  ok(abriu === 'ok', `a aba Conferência monta o painel de revisão (${abriu})`);

  /* O styles.css do painel estiliza h2, h3, table, input e label por elemento, e
     é carregado em toda rota. Estas duas medidas são o que denuncia o vazamento:
     o título encolhendo para o tamanho do painel, e o campo de autor virando
     rótulo de 10px em caixa alta. */
  ok(await ev(`
    const h1 = document.querySelector('.revisao-topo h1');
    return h1 && parseFloat(getComputedStyle(h1).fontSize) > 22;
  `), 'o título da tela não encolheu para a régua do painel');
  ok(await ev(`
    const campo = document.querySelector('.revisao-autor input');
    return campo && parseFloat(getComputedStyle(campo).fontSize) >= 15
      && getComputedStyle(campo).textTransform === 'none';
  `), 'o campo de quem revisa não virou rótulo do painel');
  ok(await ev(`
    return getComputedStyle(document.body).backgroundColor !== 'rgb(247, 244, 236)';
  `), 'o fundo do painel continua sendo o do painel');

  const ruido = erros.filter(e => !/favicon|chrome-extension/i.test(String(e)));
  ok(ruido.length === 0, ruido.length ? `console limpo (achei: ${ruido.join(' | ')})` : 'console limpo');
} catch (erro) {
  console.log(`\n[fumaça] erro: ${erro.message}`);
  falhas++;
} finally {
  try { ws?.close(); } catch { /* já fechado */ }
  edge.kill();
  await espera(1000);
  try {
    rmSync(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch { /* o Windows solta o perfil depois; não é motivo para falhar */ }
}

console.log(falhas ? `\n${falhas} falha(s)` : '\n✅ telas de pé');
process.exit(falhas ? 1 : 0);
