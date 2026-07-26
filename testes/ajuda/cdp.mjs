/* ---------------------------------------------------------------------------
   Cliente mínimo do Chrome DevTools Protocol.

   Existe para os testes dirigirem um navegador de verdade sem trazer
   Playwright ou Puppeteer para o projeto — usa o Edge que já está instalado
   no Windows e o `WebSocket` nativo do Node 22+.
--------------------------------------------------------------------------- */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const espera = ms => new Promise(r => setTimeout(r, ms));
const ruidoDeExtensao = t => /chrome-extension|ethereum|MetaMask/i.test(String(t));

/** Sobe o Edge headless e devolve um cliente CDP conectado à primeira aba. */
export async function abrirNavegador({ porta = 9333, edge = process.env.EDGE } = {}) {
  if (!edge) throw new Error('caminho do Edge não informado (env EDGE)');

  const perfil = mkdtempSync(join(tmpdir(), 'raizes-teste-'));
  const processo = spawn(edge, [
    '--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--disable-extensions', '--window-size=1280,1400', 'about:blank',
  ], { stdio: 'ignore' });

  let alvo = null;
  for (let i = 0; i < 60 && !alvo; i++) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json();
      alvo = lista.find(t => t.type === 'page' && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl;
    } catch { /* ainda subindo */ }
    if (!alvo) await espera(300);
  }
  if (!alvo) {
    processo.kill();
    throw new Error('o Edge não respondeu na porta de depuração');
  }

  const ws = new WebSocket(alvo);
  const pendentes = new Map();
  const erros = [];
  let proximo = 1;

  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pendentes.has(m.id)) {
      const { res, rej } = pendentes.get(m.id);
      pendentes.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
      return;
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      const t = String(d.exception?.description || d.text);
      if (!ruidoDeExtensao(t)) erros.push('EXCEÇÃO: ' + t.slice(0, 300));
    }
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
      const t = m.params.args.map(a => a.value ?? a.description ?? '').join(' ');
      if (t.trim() && !ruidoDeExtensao(t)) erros.push(m.params.type.toUpperCase() + ': ' + t.slice(0, 300));
    }
  };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

  const cdp = (metodo, params = {}) => {
    const id = proximo++;
    ws.send(JSON.stringify({ id, method: metodo, params }));
    return new Promise((res, rej) => {
      pendentes.set(id, { res, rej });
      setTimeout(() => { if (pendentes.delete(id)) rej(new Error('tempo esgotado em ' + metodo)); }, 20000);
    });
  };

  await cdp('Runtime.enable');
  await cdp('Page.enable');

  /** Avalia uma expressão na página. Aceita `return` e promessas. */
  const ev = async expr => {
    const r = await cdp('Runtime.evaluate', {
      expression: `(() => { ${expr} })()`, returnByValue: true, awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error('erro na página: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    }
    return r.result.value;
  };

  const fechar = async () => {
    try { ws.close(); } catch { /* já fechado */ }
    processo.kill();
    await espera(300);
    try { rmSync(perfil, { recursive: true, force: true }); } catch { /* ignora */ }
  };

  return { cdp, ev, erros, fechar };
}

/* ---------- utilitários injetados na página ---------- */
export const AJUDANTES = `
window.__t = {
  txt: () => document.body.innerText,
  tem: s => document.body.innerText.includes(s),
  contem: s => document.body.innerText.toLowerCase().includes(String(s).toLowerCase()),
  clicar: (sel, txt) => {
    const els = [...document.querySelectorAll(sel)];
    const el = txt ? els.find(e => e.innerText.trim().includes(txt)) : els[0];
    if (!el) return false;
    if (el.disabled) return 'desabilitado';
    el.click(); return true;
  },
  preencher: (sel, v, i = 0) => {
    const el = document.querySelectorAll(sel)[i];
    if (!el) return false;
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  },
  pin: (v = '1234') => {
    const eds = [...document.querySelectorAll('.pin input')];
    eds.forEach((el, i) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v[i]);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return eds.length;
  },
  conta: sel => document.querySelectorAll(sel).length,
};
`;

/** Contador de verificações compartilhado pelas suítes. */
export function placar() {
  let falhas = 0, total = 0;
  return {
    ok(cond, msg) {
      total++;
      if (cond) console.log('  ✓ ' + msg);
      else { falhas++; console.log('  ✗ FALHOU: ' + msg); }
    },
    secao: t => console.log('\n' + t),
    fim(rotulo) {
      console.log('\n' + '─'.repeat(52));
      console.log(falhas === 0
        ? `✅ ${total} ${rotulo}, todas passaram`
        : `❌ ${falhas} de ${total} falharam`);
      return falhas === 0;
    },
  };
}
