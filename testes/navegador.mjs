/* Teste de ponta a ponta no navegador real (Edge headless via CDP, sem dependências novas) */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = process.env.EDGE;
const PORTA = 9333;
const ALVO = process.env.ALVO ?? 'http://localhost:5173';

let falhas = 0, total = 0;
const ok = (cond, msg) => {
  total++;
  if (cond) console.log('  \u2713 ' + msg);
  else { falhas++; console.log('  \u2717 FALHOU: ' + msg); }
};
const secao = t => console.log('\n' + t);
const espera = ms => new Promise(r => setTimeout(r, ms));
const ruidoExtensao = t => /chrome-extension|ethereum|MetaMask/i.test(String(t));

const perfil = mkdtempSync(join(tmpdir(), 'edge-e2e-'));
const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORTA}`, `--user-data-dir=${perfil}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-extensions',
  '--window-size=1280,1400', 'about:blank',
], { stdio: 'ignore' });

/* ---------- cliente CDP mínimo ---------- */
let ws, prox = 1;
const pendentes = new Map();
const erros = [];

async function conectar() {
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

function cdp(method, params = {}) {
  const id = prox++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => {
    pendentes.set(id, { res, rej });
    setTimeout(() => { if (pendentes.delete(id)) rej(new Error('timeout em ' + method)); }, 20000);
  });
}

async function ev(expr) {
  const r = await cdp('Runtime.evaluate', {
    expression: `(() => { ${expr} })()`, returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error('erro na página: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}

/* ---------- helpers injetados na página ---------- */
const HELPERS = `
window.__t = {
  txt: () => document.body.innerText,
  tem: s => document.body.innerText.includes(s),
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

/** Estado da demo limpo, mas com o tour já marcado como visto (como um usuário que voltou). */
async function irPara(url, limparStorage = true) {
  await cdp('Page.navigate', { url });
  await espera(500);
  if (limparStorage) {
    await ev("localStorage.clear(); localStorage.setItem('raizes-tour-v1','visto'); return 1;");
    await cdp('Page.reload', {});
    await espera(1000);
  }
  await ev(HELPERS + ' return 1;');
  await espera(250);
}

/** Primeira visita de verdade: nada no localStorage, nem o estado nem o tour. */
async function irParaPrimeiraVisita(url) {
  await cdp('Page.navigate', { url });
  await espera(500);
  await ev('localStorage.clear(); return 1;');
  await cdp('Page.reload', {});
  await espera(1200);
  await ev(HELPERS + ' return 1;');
  await espera(250);
}

/* =========================================================== execução ==== */
try {
  const wsUrl = await conectar();
  ws = new WebSocket(wsUrl);
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
      if (!ruidoExtensao(t)) erros.push('EXCEÇÃO: ' + t.slice(0, 300));
    }
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
      const txt = m.params.args.map(a => a.value ?? a.description ?? '').join(' ');
      if (txt.trim() && !ruidoExtensao(txt)) erros.push(m.params.type.toUpperCase() + ': ' + txt.slice(0, 300));
    }
  };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  await cdp('Runtime.enable');
  await cdp('Page.enable');

  /* Esta suíte testa o app LOCAL-FIRST, em isolamento: bloqueia o
     public/supabase.json para o estado vir sempre da seed e as asserções serem
     determinísticas. A sincronização com a nuvem é coberta pelas suítes `nuvem`
     (garantias do esquema) e `aparelhos` (dois aparelhos, um offline) — misturar
     as duas coisas aqui tornaria o resultado dependente de dado compartilhado. */
  await cdp('Network.enable');
  await cdp('Network.setBlockedURLs', { urls: ['*supabase.json*', '*supabase.co*'] });

  /* ---------- 0. tour de primeira visita ---------- */
  secao('0. Tour de primeira visita do painel');
  await irParaPrimeiraVisita(ALVO);
  ok(await ev('return __t.conta(".tour") === 1'), 'tour abre sozinho na primeira visita');
  ok(await ev('return __t.tem("Bem-vindo ao Raízes do Futuro")'), 'passo 1 dá boas-vindas e explica o ciclo');
  ok(await ev('return __t.tem("1 de 9")'), 'contador mostra 1 de 9');
  ok(await ev('return __t.conta(".tour-pontos i") === 9'), '9 pontos de progresso');
  ok(await ev('return __t.tem("Pular por agora") && __t.tem("Não mostrar de novo")'), 'oferece pular e não mostrar de novo');
  ok(await ev('return __t.conta(".tour-alvo") === 0'), 'passo de boas-vindas não destaca aba');
  ok(await ev('return __t.conta(".tour button.acao.sec") === 0'), 'sem botão Voltar no primeiro passo');

  // percorre os 9 passos conferindo que cada um troca de aba e destaca a aba descrita
  const passosTour = [];
  for (let n = 0; n < 9; n++) {
    const info = await ev(`
      const t = document.querySelector('.tour');
      const alvo = document.querySelector('nav.tabs button.tour-alvo');
      const ativa = document.querySelector('nav.tabs button.on');
      return { titulo: t.querySelector('b').innerText, contador: t.querySelector('.tour-contador').innerText,
               alvo: alvo ? alvo.innerText.trim() : null, ativa: ativa ? ativa.innerText.trim() : null,
               botao: [...t.querySelectorAll('button.acao')].pop().innerText };
    `);
    passosTour.push(info);
    // clicar por texto: de "2 de 9" em diante existe também o botão "Voltar", que é o primeiro do container
    if (n < 8) { await ev('return __t.clicar(".tour-botoes button.acao", "Avançar")'); await espera(420); }
  }
  console.log('    passos: ' + passosTour.map(p => `${p.contador} ${p.titulo}${p.alvo ? ' →[' + p.alvo + ']' : ''}`).join(' | '));
  ok(passosTour.length === 9, '9 passos percorridos');
  ok(passosTour.map(p => p.titulo).join('|').includes('Cofre Multisig'), 'cobre a aba do Cofre Multisig');
  ok(passosTour.filter(p => p.alvo).length === 7, `destaca as 7 abas (${passosTour.filter(p => p.alvo).length})`);
  ok(passosTour.every(p => !p.alvo || p.alvo === p.ativa), 'a aba destacada é sempre a que está aberta');
  ok(passosTour[8].botao.includes('Começar a explorar'), 'último passo tem botão de conclusão');

  await ev('return __t.clicar(".tour-botoes button.acao", "Começar a explorar")');
  await espera(400);
  ok(await ev('return __t.conta(".tour") === 0'), 'concluir fecha o tour');
  ok(await ev(`return localStorage.getItem('raizes-tour-v1') === 'visto'`), 'concluir marca como visto');
  await cdp('Page.reload', {});
  await espera(1200);
  await ev(HELPERS + ' return 1;');
  ok(await ev('return __t.conta(".tour") === 0'), 'não reabre depois de concluído');

  ok(await ev('return __t.tem("Como funciona")'), 'botão "❔ Como funciona" no topo');
  await ev('return __t.clicar(".btn-tour")');
  await espera(400);
  ok(await ev('return __t.conta(".tour") === 1 && __t.tem("1 de 9")'), 'reabre pelo botão, do começo');

  // navegação: avançar, voltar e clicar num ponto
  await ev('return __t.clicar(".tour-botoes button.acao", "Avançar")');
  await espera(350);
  ok(await ev('return __t.tem("2 de 9")'), 'Avançar vai ao passo 2');
  await ev('return __t.clicar(".tour-botoes button.acao.sec", "Voltar")');
  await espera(350);
  ok(await ev('return __t.tem("1 de 9")'), 'Voltar retorna ao passo 1');
  await ev('return document.querySelectorAll(".tour-pontos i")[5].click(), 1;');
  await espera(400);
  ok(await ev('return __t.tem("6 de 9")'), 'clicar num ponto salta para o passo');
  const abaNoPasso6 = await ev('const b = document.querySelector("nav.tabs button.on"); return b.innerText.trim();');
  ok(/Cofre Multisig/.test(abaNoPasso6), `salto também troca a aba (${abaNoPasso6})`);

  // teclado
  await ev('return document.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true})) || window.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight"})), 1;');
  await espera(350);
  ok(await ev('return __t.tem("7 de 9")'), 'seta direita avança');
  await ev('return window.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowLeft"})), 1;');
  await espera(350);
  ok(await ev('return __t.tem("6 de 9")'), 'seta esquerda volta');
  await ev('return window.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"})), 1;');
  await espera(350);
  ok(await ev('return __t.conta(".tour") === 0'), 'Escape fecha o tour');

  // "pular por agora" não persiste; "não mostrar de novo" persiste
  await ev(`localStorage.removeItem('raizes-tour-v1'); return 1;`);
  await cdp('Page.reload', {});
  await espera(1200);
  await ev(HELPERS + ' return 1;');
  ok(await ev('return __t.conta(".tour") === 1'), 'volta a abrir sozinho se o registro for apagado');
  await ev('return __t.clicar(".tour-nunca", "Pular por agora")');
  await espera(350);
  ok(await ev('return __t.conta(".tour") === 0'), '"Pular por agora" fecha');
  ok(await ev(`return localStorage.getItem('raizes-tour-v1') === null`), '"Pular por agora" NÃO marca como visto');
  await cdp('Page.reload', {});
  await espera(1200);
  await ev(HELPERS + ' return 1;');
  ok(await ev('return __t.conta(".tour") === 1'), 'por isso reabre na visita seguinte');
  await ev('return __t.clicar(".tour-nunca", "Não mostrar de novo")');
  await espera(350);
  ok(await ev(`return localStorage.getItem('raizes-tour-v1') === 'visto'`), '"Não mostrar de novo" marca como visto');

  // o tour não atrapalha a demo nem aparece no app da família
  await ev(`localStorage.removeItem('raizes-tour-v1'); return 1;`);
  await cdp('Page.reload', {});
  await espera(1200);
  await ev(HELPERS + ' return 1;');
  ok(await ev('return __t.conta(".tour") === 1'), 'tour aberto antes de iniciar a demo');
  await ev('return __t.clicar(".btn-demo", "Ver o ciclo completo")');
  await espera(900);
  ok(await ev('return __t.conta(".tour") === 0'), 'iniciar a demo guiada fecha o tour');
  ok(await ev('return __t.conta(".demo-narrador") === 1'), 'narrador da demo assume a tela');
  await ev('return __t.clicar(".demo-parar")');
  await espera(400);

  await irParaPrimeiraVisita(ALVO + '/#/familia');
  ok(await ev('return __t.conta(".fam-tela.standalone") === 1'), 'rota da família carrega');
  ok(await ev('return __t.conta(".tour") === 0'), 'tour do painel NÃO aparece no app da família');

  /* ---------- 1. carga inicial e dashboard ---------- */
  secao('1. Carga inicial · Dashboard');
  await irPara(ALVO);
  ok(await ev('return __t.conta(".tour") === 0'), 'visitante que já viu o tour entra direto no painel');
  ok(await ev('return __t.tem("Impacto em tempo real")'), 'Dashboard renderiza');
  ok(await ev('return __t.tem("Raízes do Futuro")'), 'cabeçalho presente');
  ok(await ev('return __t.tem("Boipeba")'), 'cabeçalho identifica o piloto');
  ok(await ev('return __t.tem("Solana")'), 'menciona Solana');
  ok(await ev('return __t.conta(".grafico svg") >= 2'), '2 gráficos SVG (barras + donut)');
  ok(await ev('return __t.conta(".grafico svg rect.barra-anim") >= 2'), 'barras: uma por semana com coleta');
  ok(await ev('return __t.conta(".donut-legenda li") >= 2'), 'donut com legenda por fonte de receita');
  ok(await ev('return __t.tem("Ver o ciclo completo")'), 'botão do modo demo presente');
  ok(await ev('return __t.conta("nav.tabs button") === 7'), '7 abas (inclui App da Família)');

  /* ---------- 2. cofre multisig ---------- */
  secao('2. Cofre multisig — assinaturas 2-de-3');
  ok(await ev('return __t.clicar("nav.tabs button", "Cofre Multisig")'), 'abre a aba do cofre');
  await espera(350);
  ok(await ev('return __t.tem("Fundo Infância — cofre multisig")'), 'título novo do cofre');
  ok(await ev('return /proposta #\\d+/.test(__t.txt())'), 'proposta de exemplo da seed aparece');
  ok(await ev('return __t.conta(".signatario") === 3'), '3 signatários listados');
  ok(await ev('return __t.tem("Instituto Vivá") && __t.tem("DeTrash") && __t.tem("Representante Comunitário")'), 'os 3 nomes corretos');
  ok(await ev('return __t.conta(".signatario.assinou") === 1'), '1 assinatura já coletada na seed');
  ok(await ev('return __t.tem("1/2 assinaturas")'), 'contador mostra 1/2');
  ok(await ev('return __t.tem("Assinar como DeTrash")'), 'botão "Assinar como [nome]" presente');
  ok(await ev('return __t.conta(".avatar") === 3'), 'os 3 signatários têm avatar/chip');

  await ev('return __t.clicar(".signatario button", "Assinar como DeTrash")');
  await espera(700);
  ok(await ev('return __t.tem("cofre executou a transferência")'), 'ao atingir 2/3 executa com animação');
  ok(await ev('return __t.conta(".proposta.executando") === 1'), 'card recebe a classe de execução');
  ok(await ev('return __t.tem("já liberado às famílias")'), 'KPI de liberado presente');

  /* ---------- 3. explorador de transações ---------- */
  secao('3. Explorador de transações estilo Solana');
  ok(await ev('return __t.tem("Explorador de transações")'), 'seção do explorador');
  ok(await ev('return __t.conta(".tx") > 5'), 'lista de transações renderizada');
  ok(await ev('return __t.tem("LIBERAÇÃO") && __t.tem("PROPOSTA") && __t.tem("ASSINATURA")'), 'tipos PROPOSTA/ASSINATURA/LIBERAÇÃO visíveis');
  ok(await ev('return __t.conta(".tx-slot .slot-num") > 5'), 'cada transação mostra o slot');
  ok(await ev('return /[1-9A-HJ-NP-Za-km-z]{10}…[1-9A-HJ-NP-Za-km-z]{10}/.test(__t.txt())'), 'signature truncada em base58');
  ok(!(await ev('return /0x[0-9a-f]{16}/.test(__t.txt())')), 'nenhum hash no formato 0x antigo');

  await ev('return __t.clicar(".tx")');
  await espera(400);
  ok(await ev('return __t.conta(".modal") === 1'), 'clique abre o modal de detalhes');
  ok(await ev('const t = __t.txt().toLowerCase(); return t.includes("signature") && t.includes("transação anterior")'),
    'modal mostra signature e a anterior (cadeia)');
  ok(await ev('return __t.tem("Taxa") && __t.tem("SOL")'), 'modal mostra a taxa em SOL');
  ok(await ev('return __t.tem("Finalizada")'), 'modal mostra status finalizada');
  const sigs = await ev('return [...document.querySelectorAll(".bloco-det p.hash")].map(e => e.innerText.trim().length)');
  ok(sigs.length >= 2 && sigs.every(n => n === 88), `signatures completas com 88 chars (${sigs.join(', ')})`);
  await ev('return __t.clicar(".modal-x")');
  await espera(300);
  ok(await ev('return __t.conta(".modal") === 0'), 'modal fecha');
  await ev('return __t.clicar(".filtro", "RECEITA")');
  await espera(300);
  ok(await ev('return __t.conta(".filtro.on") === 1'), 'filtro por tipo funciona');

  /* ---------- 4. mercado e split animado ---------- */
  secao('4. Mercado — animação do split 60/25/15');
  await ev('return __t.clicar("nav.tabs button", "Mercado")');
  await espera(350);
  ok(await ev('return __t.tem("Nenhuma venda nesta sessão")'), 'estado vazio orientado antes da 1ª venda');
  await ev('return __t.clicar(".produto button", "Comprar")');
  await espera(300);
  ok(await ev('return __t.conta(".split-anim") === 1'), 'animação do split aparece após a venda');
  ok(await ev('return __t.conta(".split-linha") === 3'), '3 barras (60/25/15)');
  ok(await ev('return __t.tem("Renda direta") && __t.tem("Fundo Infância") && __t.tem("Operação")'), 'os 3 destinos rotulados');
  const v1 = await ev('return document.querySelectorAll(".split-valor")[0].innerText');
  await espera(900);
  const v2 = await ev('return document.querySelectorAll(".split-valor")[0].innerText');
  ok(v1 !== v2, `contadores animam ("${v1}" → "${v2}")`);
  await espera(900);
  ok(await ev('return __t.tem("Divisão executada pelo contrato")'), 'animação conclui');
  ok(await ev('return document.querySelectorAll(".split-valor")[0].innerText.includes("48,00")'), '60% de R$ 80 = R$ 48,00');

  /* ---------- 5. coleta e validação ---------- */
  secao('5. Coletor → Instituto Vivá');
  await ev('return __t.clicar("nav.tabs button", "Coletor")');
  await espera(300);
  await ev('return __t.preencher(".card.destaque input", "Seu Zé", 0)');
  await ev('return __t.preencher(".card.destaque input[type=number]", "31")');
  await ev('return __t.preencher(".card.destaque input", "Praia de Moreré", 2)');
  await espera(200);
  ok(await ev('return __t.clicar(".card.destaque button.acao", "Enviar para validação") === true'), 'formulário habilita e envia');
  await espera(400);
  ok(await ev('return __t.tem("Coleta de 31 kg enviada")'), 'toast "Coleta enviada ✔"');
  ok(await ev('return __t.tem("Seu Zé")'), 'coleta aparece na tabela');

  await ev('return __t.clicar("nav.tabs button", "Instituto Vivá")');
  await espera(350);
  ok(await ev('return __t.tem("31 kg")'), 'coleta pendente listada para validação');
  await ev('return __t.clicar(".item-validar button", "Validar (critérios DeTrash)")');
  await espera(500);
  ok(await ev('return __t.tem("Transação registrada no slot")'), 'toast global "Transação registrada no slot N"');
  await ev('return __t.clicar("button.acao.sec", "Consolidar coletas validadas")');
  await espera(450);
  ok(await ev('return __t.tem("Relatório de Circularidade emitido")'), 'relatório emitido com toast');

  /* ---------- 6. comprovação → proposta ---------- */
  secao('6. Comprovação da família → proposta no cofre');
  // o seed não deixa nenhuma comprovação pendente de validação: a família envia uma agora
  await ev('return __t.clicar("nav.tabs button", "Família (operação)")');
  await espera(400);
  ok(await ev('return __t.clicar(".card.destaque button.acao.sec", "Enviar comprovação") === true'), 'família envia a comprovação pela visão da operação');
  await espera(450);
  ok(await ev('return __t.tem("em validação")'), 'condição passa a "em validação"');

  await ev('return __t.clicar("nav.tabs button", "Instituto Vivá")');
  await espera(400);
  ok(await ev('return /Consulta pediátrica|Frequência escolar/.test(__t.txt())'), 'comprovação aparece para validação no Vivá');
  ok(await ev('return __t.tem("Livre no cofre para novas propostas")'), 'mostra saldo livre do cofre');
  await ev('return __t.clicar(".item-validar button", "criar proposta no cofre")');
  await espera(500);
  ok(await ev('return __t.tem("Proposta criada no cofre")'), 'toast: proposta criada');
  await ev('return __t.clicar("nav.tabs button", "Cofre Multisig")');
  await espera(400);
  ok(await ev('return __t.conta(".proposta") >= 1'), 'nova proposta aparece no cofre');
  ok(await ev('return __t.tem("0/2 assinaturas")'), 'nasce com 0/2 assinaturas');

  /* ---------- 7. app da família ---------- */
  secao('7. App da Família — entrada, saldo, compromissos, extrato');
  // seção autocontida: estado limpo, para a família ainda ter um compromisso pendente
  await irPara(ALVO);
  const cliqueAba = await ev('return __t.clicar("nav.tabs button", "App da Família")');
  await espera(500);
  ok(cliqueAba === true, 'abre a aba do App da Família');
  ok(await ev('return __t.conta(".moldura-celular") === 1'), 'renderiza numa única moldura de celular');
  ok(await ev('return __t.conta(".mascote-bicho") >= 1 && __t.txt().includes("🐢")'), 'mascote tartaruga presente');
  ok(await ev('return __t.tem("Escolha sua família e digite o PIN")'), 'mascote orienta a entrada');
  ok(await ev('return __t.txt().toLowerCase().includes("quem é você")'), 'seleção de família na entrada');
  ok(await ev('return __t.txt().toLowerCase().includes("pin (4 números")'), 'campo de PIN de 4 números');

  // entra como a primeira família (que já tem conta)
  const famAlvo = await ev(`
    const s = JSON.parse(localStorage.getItem('raizes-mvp-v2'));
    const f = s.familias.find(x => x.carteira);
    return { id: f.id, nome: f.resp, saldo: f.saldo };
  `);
  await ev(`return __t.preencher(".fam-entrada select", ${famAlvo.id})`);
  await espera(250);
  await ev('return __t.preencher(".fam-entrada input", "1234")');
  await espera(250);
  ok(await ev('return __t.clicar(".fam-entrada button.acao", "Entrar") === true'), 'Entrar habilita com família + PIN');
  await espera(500);

  ok(await ev('return __t.tem("Você tem")'), 'saldo apresentado em linguagem simples');
  ok(await ev('return __t.conta(".saldo-numero") === 1'), 'saldo em destaque');
  ok(await ev('return __t.tem("disponível para retirar agora")'), 'deixa claro que o dinheiro é retirável');
  ok(await ev('return __t.tem("Retirar dinheiro")'), 'botão principal de retirada');
  ok(await ev('return __t.tem("Compromissos do mês")'), 'seção de compromissos');
  ok(await ev('return __t.conta(".compromisso") >= 1'), 'compromissos como cards');
  ok(await ev('return __t.tem("Enviar foto do comprovante")'), 'botão de envio de foto');
  ok(await ev('return __t.tem("Extrato")'), 'seção de extrato');
  ok(await ev('return __t.tem("Falar com o Instituto Vivá")'), 'botão flutuante de ajuda');
  ok(await ev('return __t.tem("Bônus de julho")'), 'extrato em linguagem simples ("Bônus de julho — vacinação em dia")');
  ok(await ev('return !__t.tem("Fundo Infância")'), 'extrato não usa o jargão do programa');

  // "Picnic" fica de fora da lista: é o nome do aplicativo que a família usa (como o nome de um banco),
  // não jargão cripto — e a escolha por ele é explícita no onboarding
  const jargao = await ev(`
    const el = document.querySelector('.fam-tela');
    const t = (el ? el.innerText : '').toLowerCase();
    return ['wallet','token','blockchain','seed phrase','on-chain','hash','multisig','base58',
            'signature','solana','cred','brz','cripto','carteira','slot','ledger','smart contract']
      .filter(p => t.includes(p));
  `);
  ok(jargao.length === 0, `zero jargão cripto dentro de .fam-tela${jargao.length ? ' — encontrado: ' + jargao.join(', ') : ''}`);

  const saldoTxt = await ev('return document.querySelector(".saldo-numero").innerText');
  ok(/R\$\s?60,00/.test(saldoTxt), `saldo em reais destacado (${saldoTxt})`);

  // o botão abre um seletor de arquivo de verdade (evidencia.js calcula SHA-256
  // no aparelho); aqui simulamos a escolha da foto
  await ev('return __t.clicar(".compromisso button", "Enviar foto do comprovante")');
  await espera(400);
  const comprovante = await ev(`
    return (async () => {
      const input = document.querySelector('input[type=file]');
      if (!input) return 'sem-input';
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array([7, 7, 7, 42])], 'carteirinha.jpg', { type: 'image/jpeg' }));
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return 'ok';
    })();
  `);
  ok(comprovante === 'ok', 'seletor de arquivo presente para a foto do comprovante');
  await espera(900);
  ok(await ev('return __t.tem("Comprovante protegido e enviado")'), 'calcula o hash e confirma o envio');
  ok(await ev('return __t.tem("em análise")'), 'badge muda para "em análise"');
  ok(await ev('return __t.tem("comprovante protegido · código")'), 'mostra o código da evidência sem expor a foto');
  const evid = await ev(`
    const s = JSON.parse(localStorage.getItem('raizes-mvp-v2'));
    const c = s.familias.flatMap(f => f.condicoes).find(x => x.evidHash);
    return c ? { hash: c.evidHash, arquivo: c.arquivo } : null;
  `);
  ok(evid && /^[0-9a-f]{64}$/.test(evid.hash), `guarda SHA-256 real de 64 hex (${evid?.hash?.slice(0, 16)}…)`);
  ok(evid && evid.arquivo === 'carteirinha.jpg', 'guarda o nome do arquivo, não o conteúdo');

  /* ---------- 8. retirada em 2 toques ---------- */
  secao('8. Retirada em 2 toques (valor → confirmar → comprovante com QR)');
  ok(await ev('return __t.clicar(".saldo-card button.acao", "Retirar dinheiro") === true'), 'toque 1: abre a retirada');
  await espera(400);
  ok(await ev('return __t.conta(".input-valor") === 1'), 'campo de valor aparece');
  ok(await ev('return __t.txt().toLowerCase().includes("quanto você quer retirar")'), 'pergunta o valor em linguagem simples');
  ok(await ev('return __t.conta(".atalhos-valor button") === 3'), 'atalhos de valor (25% / 50% / Tudo)');
  await ev('return __t.clicar(".atalhos-valor button", "Tudo")');
  await espera(300);
  ok(await ev('return __t.conta(".valor-confirma") === 1'), 'mostra o valor escolhido para confirmação');
  ok(await ev('return __t.clicar("button.acao", "Confirmar Pix") === true'), 'toque 2: confirma');
  await espera(600);
  ok(await ev('return __t.tem("Pix enviado!")'), 'comprovante simulado aparece');
  ok(await ev('return __t.conta(".qr") === 1'), 'comprovante traz QR code');
  ok(await ev('return __t.conta(".qr rect") > 40'), 'QR desenhado em SVG puro');
  ok(await ev('return __t.tem("sem custo para a família")'), 'comprovante deixa claro que não há taxa');
  await ev('return __t.clicar(".recibo button.acao", "Voltar")');
  await espera(500);
  const saldoDepois = await ev('const n = document.querySelector(".saldo-numero"); return n ? n.innerText : "(sem saldo em tela)";');
  ok(/R\$\s?0,00/.test(saldoDepois), `saldo zerado após a retirada (${saldoDepois})`);
  ok(await ev('return __t.tem("Retirada pelo Pix")'), 'extrato registra a retirada em linguagem simples');

  /* ---------- 9. ajuda ---------- */
  secao('9. Ajuda — Instituto Vivá (WhatsApp simulado)');
  ok(await ev('return __t.clicar(".fab-ajuda") === true'), 'botão flutuante abre a conversa');
  await espera(400);
  ok(await ev('return __t.conta(".zap") === 1'), 'conversa simulada aparece');
  ok(await ev('return __t.tem("Instituto Vivá — atendimento")'), 'identifica o atendimento');
  ok(await ev('return __t.conta(".zap-msg.digitando") === 1'), 'mostra o agente digitando');
  await espera(1700);
  ok(await ev('return __t.conta(".zap-msg.digitando") === 0'), 'resposta chega e o "digitando" sai');
  ok(await ev('return __t.tem("Enviar foto do comprovante")'), 'agente orienta o próximo passo');
  await ev('return __t.clicar("button.acao", "Fechar conversa")');
  await espera(300);
  ok(await ev('return __t.conta(".zap") === 0'), 'conversa fecha');

  /* ---------- 10. onboarding gamificado ---------- */
  secao('10. Onboarding gamificado (família sem conta)');
  await irPara(ALVO);
  await ev('return __t.clicar("nav.tabs button", "App da Família")');
  await espera(400);
  const semConta = await ev(`
    const s = JSON.parse(localStorage.getItem('raizes-mvp-v2'));
    const f = s.familias.find(x => !x.carteira);
    return { id: f.id, nome: f.resp };
  `);
  await ev(`return __t.preencher(".fam-entrada select", ${semConta.id})`);
  await espera(250);
  await ev('return __t.preencher(".fam-entrada input", "1234")');
  await espera(250);
  await ev('return __t.clicar(".fam-entrada button.acao", "Entrar")');
  await espera(600);

  ok(await ev('return __t.conta(".fam-onb") === 1'), `família sem conta (${semConta.nome}) cai no onboarding`);
  ok(await ev('return __t.tem("Missão 1 de 4")'), 'barra de progresso indica missão 1 de 4');
  ok(await ev('return __t.conta(".progresso-fill") === 1'), 'barra de progresso presente');
  ok(await ev('return __t.conta(".missao-passo") === 4'), '4 missões na trilha');
  ok(await ev('return __t.tem("Escolher onde guardar") && __t.tem("Criar meu PIN") && __t.tem("Meus compromissos") && __t.tem("Como retirar")'), 'as 4 missões sequenciais');
  ok(await ev('return __t.conta(".balao") === 1'), 'mascote com balão de fala');
  ok(await ev('return __t.tem("tartaruga de Boipeba")'), 'mascote se apresenta como tartaruga de Boipeba');
  ok(await ev('return __t.tem("cofre digital que ninguém pode desviar")'), 'explica o conceito em 1 frase');

  // missão 1: escolher onde guardar (Picnic ou conta que já tem)
  ok(await ev('return __t.conta(".btn-conexao") === 2'), 'oferece as 2 opções de onde guardar');
  ok(await ev('return __t.tem("Conectar com Picnic") && __t.tem("recomendado")'), 'Picnic marcada como recomendada');
  ok(await ev('return __t.tem("Já tenho uma conta digital")'), 'segunda opção sem jargão cripto');
  ok(await ev('return __t.clicar(".fam-onb button.acao", "Missão cumprida") === "desabilitado"'), 'não avança sem escolher');
  await ev('return __t.clicar(".btn-conexao", "Conectar com Picnic")');
  await espera(300);
  ok(await ev('return __t.conta(".btn-conexao.sel") === 1'), 'opção escolhida fica destacada');
  ok(await ev('return __t.clicar(".fam-onb button.acao", "Missão cumprida") === true'), 'missão 1 conclui');
  await espera(300);
  ok(await ev('return __t.conta(".medalha-voa") === 1'), 'estrela ao concluir a missão');
  await espera(900);
  ok(await ev('return __t.tem("Missão 2 de 4")'), 'avança para a missão 2');
  ok(await ev('return __t.conta(".missao-passo.feita") === 1'), 'missão 1 marcada como feita');

  // missão 2: PIN
  ok(await ev('return __t.pin() === 4'), 'PIN de 4 caixas na missão 2');
  await espera(300);
  ok(await ev('return __t.clicar(".fam-onb button.acao", "Missão cumprida") === true'), 'missão 2 conclui com PIN');
  await espera(1200);
  ok(await ev('return __t.tem("Missão 3 de 4")'), 'avança para a missão 3');
  ok(await ev('return __t.conta(".lista-compromissos li") >= 2'), 'missão 3 lista os compromissos');
  ok(await ev('return __t.tem("guardado para você")'), 'missão 3 reforça que o bônus não se perde');

  await ev('return __t.clicar(".fam-onb button.acao", "Entendi")');
  await espera(1200);
  ok(await ev('return __t.tem("Missão 4 de 4")'), 'avança para a missão 4');
  ok(await ev('return __t.conta(".passo-a-passo > div") === 3'), 'missão 4 mostra o passo a passo do saque');

  ok(await ev('return __t.clicar(".fam-onb button.acao", "Criar minha conta") === true'), 'missão 4 cria a conta');
  await espera(900);
  ok(await ev('return __t.tem("Família Raízes do Futuro")'), 'badge final concedido');
  ok(await ev('return __t.conta(".badge-medalha") === 1'), 'medalha 🏅 exibida');
  ok(await ev('return __t.conta(".confete span") > 20'), 'confete em CSS puro');
  ok(await ev('return __t.tem("Conta da família criada")'), 'toast de conta criada');
  ok(await ev('return __t.tem("Concluído")'), 'barra de progresso chega a 100%');
  const contaCriada = await ev(`
    const s = JSON.parse(localStorage.getItem('raizes-mvp-v2'));
    const f = s.familias.find(x => x.id === ${semConta.id});
    return { tem: !!f.carteira, provider: f.carteira?.provider, rede: f.carteira?.rede, chars: f.carteira?.end.length };
  `);
  ok(contaCriada.tem && contaCriada.provider === 'Picnic' && contaCriada.rede === 'Solana' && contaCriada.chars === 44,
    `conta criada de fato (provider ${contaCriada.provider}, rede ${contaCriada.rede}, endereço de ${contaCriada.chars} chars)`);

  await ev('return __t.clicar(".fam-onb button.acao", "Abrir minha conta")');
  await espera(600);
  ok(await ev('return __t.tem("Você tem")'), 'abre a conta ao final');
  ok(await ev('return __t.tem("Nada por aqui ainda")'), 'estado vazio orientado no extrato novo');

  /* ---------- 11. rota #/familia ---------- */
  secao('11. Rota própria #/familia (mobile-first)');
  await irPara(ALVO + '/#/familia', false);
  await espera(500);
  ok(await ev('return __t.conta(".fam-tela.standalone") === 1'), 'renderiza em modo standalone');
  ok(await ev('return __t.conta("nav.tabs") === 0'), 'sem as abas do painel');
  ok(await ev('return __t.conta("header.top") === 0'), 'sem o cabeçalho do painel');
  ok(await ev('return __t.tem("Voltar ao painel")'), 'link de volta ao painel');
  ok(await ev('return __t.conta(".mascote-bicho") >= 1'), 'mascote presente na rota própria');
  ok(await ev('return __t.conta(".moldura-celular") === 0'), 'na rota própria não há moldura (é o próprio celular)');
  await ev('window.location.hash = "#/"; return 1;');
  await espera(500);
  ok(await ev('return __t.conta("nav.tabs") === 1'), 'volta ao painel ao trocar o hash');

  /* ---------- 12. modo demo guiado ---------- */
  secao('12. Modo demo guiado (▶ Ver o ciclo completo)');
  await irPara(ALVO);
  await espera(300);
  await ev('return __t.clicar(".btn-demo", "Ver o ciclo completo")');
  await espera(900);
  ok(await ev('return __t.conta(".demo-narrador") === 1'), 'card narrador aparece');
  ok(await ev('return __t.tem("Passo 1 de 13")'), 'narrador mostra passo atual e total');
  ok(await ev('return __t.conta(".demo-foco") >= 1'), 'elemento ativo destacado');

  const marcos = [];
  let terminou = false;
  for (let i = 0; i < 60; i++) {
    await espera(1200);
    const abaAtiva = await ev('const b = document.querySelector("nav.tabs button.on"); return b ? b.innerText.trim() : "";');
    const passo = await ev('const b = document.querySelector(".demo-narrador-topo b"); return b ? b.innerText.trim() : "";');
    if (passo && !marcos.some(m => m.passo === passo)) marcos.push({ passo, aba: abaAtiva });
    if (!(await ev('return __t.conta(".demo-narrador") === 1'))) { terminou = true; break; }
  }
  console.log('    passos: ' + marcos.map(m => `${m.passo} [${m.aba}]`).join(' → '));
  ok(marcos.length >= 10, `demo executou ${marcos.length} passos narrados (>= 10)`);
  ok(new Set(marcos.map(m => m.aba)).size >= 5, `trocou de aba automaticamente (${new Set(marcos.map(m => m.aba)).size} abas)`);
  ok(marcos.some(m => /Multisig 1/.test(m.passo)) && marcos.some(m => /Multisig 2/.test(m.passo)), 'passou pelas 2 assinaturas do multisig');
  ok(marcos.some(m => /Retirada pelo Pix/.test(m.passo)), 'passou pelo saque Pix');
  ok(marcos.some(m => /Divisão automática/.test(m.passo)), 'passou pelo split 60/25/15');
  ok(terminou, 'demo termina sozinha e o narrador desaparece');

  await espera(600);
  const fim = await ev(`
    const s = JSON.parse(localStorage.getItem('raizes-mvp-v2'));
    return { tx: s.transacoes.length, exec: s.propostas.filter(p => p.status === 'executada').length,
             liberado: s.caixas.fundoLiberado, saldo1: s.familias[0].saldo, slot: s.slot };
  `);
  console.log('    estado final: ' + JSON.stringify(fim));
  ok(fim.tx > 10, `demo gerou ${fim.tx} transações`);
  ok(fim.exec >= 1, 'demo executou ao menos 1 proposta multisig');
  ok(fim.liberado >= 60, 'demo liberou bônus para a família');
  ok(fim.saldo1 === 0, 'demo terminou com o saque feito');

  /* ---------- 13. resetar demo ---------- */
  secao('13. Resetar demo com os campos novos');
  await ev('window.confirm = () => true; return 1;');
  await ev('return __t.clicar("footer button.acao", "Resetar demo")');
  await espera(700);
  const pos = await ev(`
    const s = JSON.parse(localStorage.getItem('raizes-mvp-v2'));
    const ag = s.propostas.filter(p => p.status === 'aguardando');
    return { tx: s.transacoes.length, props: s.propostas.length, aguardando: ag.length,
             assin: ag.length ? ag[0].assinaturas.length : -1,
             slot: s.slot, cofre: !!s.cofre, prov: s.familias[0].carteira.provider };
  `);
  ok(pos.tx > 5 && pos.props >= 1, `reset volta à seed (${pos.tx} tx, ${pos.props} propostas)`);
  ok(pos.aguardando === 1 && pos.assin === 1, 'seed traz 1 proposta multisig com 1 assinatura já coletada');
  ok(pos.cofre && typeof pos.slot === 'number' && pos.prov === 'Picnic', 'reset preserva cofre, slot e provider Picnic');
  ok(await ev('return __t.tem("Impacto em tempo real")'), 'app segue funcional após o reset');

  /* ---------- 14. estado antigo/inválido ---------- */
  secao('14. Estado antigo no localStorage não quebra o app');
  await ev(`localStorage.setItem('raizes-mvp-v2', JSON.stringify({ ledger: [], coletas: [], nextId: 1 })); return 1;`);
  await cdp('Page.reload', {});
  await espera(2200);
  await ev(HELPERS + ' return 1;');
  ok(await ev('return __t.tem("Impacto em tempo real")'), 'estado inválido é descartado e a seed é recriada');
  ok(await ev('return __t.conta(".grafico svg") >= 2'), 'gráficos voltam a renderizar');

  /* ---------- 14a. ancoragem do relatório na Solana devnet ---------- */
  secao('14a. Ancoragem do relatório na Solana devnet');
  await irPara(ALVO);
  await ev('return __t.clicar("nav.tabs button", "Instituto Vivá")');
  await espera(900);
  ok(await ev('return __t.tem("ainda não ancorado")'), 'relatório da seed aparece como não ancorado');
  ok(await ev('return /SHA-256 [0-9a-f]{12}…[0-9a-f]{12}/.test(__t.txt())'), 'mostra o SHA-256 real do relatório');

  ok(await ev('return __t.clicar(".nao-ancorado .link-rastreio", "ancorar") === true'), 'abre o passo a passo');
  await espera(500);
  ok(await ev('return __t.conta(".modal") === 1'), 'modal de ancoragem abre');
  ok(await ev('return __t.conta(".linha-copiar") === 2'), 'oferece hash e comando para copiar');
  ok(await ev('return __t.tem("chave privada não entra no navegador")'), 'explica por que há etapa humana');
  const cmd = await ev('return document.querySelectorAll(".linha-copiar code")[1].innerText');
  ok(/^node ancorar-relatorio\.mjs [0-9a-f]{64} ".+"$/.test(cmd), `comando pronto e correto (${cmd.slice(0, 42)}…)`);
  const hashApp = await ev('return document.querySelectorAll(".linha-copiar code")[0].innerText.trim()');
  ok(/^[0-9a-f]{64}$/.test(hashApp), 'hash com 64 hexadecimais');

  // assinatura inválida é recusada antes de sujar o estado
  await ev('return __t.preencher(".modal input", "isso-nao-e-assinatura")');
  await espera(300);
  ok(await ev('return __t.tem("não parece uma assinatura Solana")'), 'recusa assinatura mal formada');
  ok(await ev('return __t.clicar(".modal button.acao.grande", "Registrar") === "desabilitado"'), 'botão bloqueado enquanto inválida');

  // a assinatura de verdade, da transação que ancoramos na devnet
  const SIG_REAL = '32236oNENMrvKmfp5e62Asi7Uxf7DabAiJynAeLc5JE6hVDWmEeRUYMJjGspJgt9UadUVKiUVzgKicc1F9LqDN6w';
  await ev(`return __t.preencher(".modal input", ${JSON.stringify(SIG_REAL)})`);
  await espera(400);
  ok(await ev('return __t.tem("conferir no explorer")'), 'oferece conferir antes de registrar');
  ok(await ev('return __t.clicar(".modal button.acao.grande", "Registrar") === true'), 'registra a ancoragem');
  await espera(700);

  ok(await ev('return __t.tem("ancorado na Solana devnet")'), 'selo de ancorado aparece');
  ok(await ev('return __t.tem("registro real")'), 'marcado como registro real, distinto do simulado');
  const linkAncora = await ev(`return [...document.querySelectorAll('a[href*="explorer.solana.com"]')].map(a => a.href)[0] || null;`);
  ok(typeof linkAncora === 'string' && linkAncora.includes(SIG_REAL), 'link aponta para a transação real no explorer');

  const guardado = await ev(`
    const s = JSON.parse(localStorage.getItem('raizes-mvp-v2'));
    const r = s.relatorios.find(x => x.ancoragem);
    const tx = s.transacoes.filter(t => t.tipo === 'ANCORAGEM');
    return r ? { rede: r.ancoragem.rede, hash: r.ancoragem.hash, txId: r.ancoragem.txId, txs: tx.length, real: tx[0]?.real } : null;
  `);
  ok(guardado?.rede === 'Solana devnet' && guardado.txId === SIG_REAL, 'guarda rede e assinatura corretas');
  ok(guardado?.hash === hashApp, 'o hash guardado é o mesmo que o app exibiu');
  ok(guardado?.txs === 1 && guardado.real === true, 'gera transação ANCORAGEM marcada como real');

  await ev('return __t.clicar("nav.tabs button", "Cofre Multisig")');
  await espera(600);
  ok(await ev('return __t.tem("ANCORAGEM")'), 'a ancoragem aparece no explorador de transações');

  /* ---------- 14b. QR de rastreio do produto ---------- */
  secao('14b. QR de rastreio do produto (jornada da peça)');
  await irPara(ALVO);
  await ev('return __t.clicar("nav.tabs button", "Mercado")');
  await espera(600);

  // a luminária da seed já foi vendida, então tem código e QR de verdade
  ok(await ev('return __t.clicar(".produto .link-rastreio", "rastrear origem") === true'),
    'abre o rastreio da peça já vendida');
  await espera(600);
  const codigo = await ev('const e = document.querySelector(".etiqueta-codigo"); return e ? e.innerText.trim() : null;');
  ok(/^RF-[2-9A-HJ-NP-Z]{4}$/.test(codigo || ''), `código curto sem caracteres ambíguos (${codigo})`);
  ok(await ev('return __t.conta(".rastreio svg.qr") === 1'), 'QR renderizado como SVG');
  ok(await ev('return __t.tem("Este QR é de verdade")'), 'afirma o que o QR realmente faz');

  // prova independente: o QR da tela decodifica para a URL pública
  const carregouDec = await ev(`
    return new Promise(res => {
      if (typeof jsQR === 'function') return res('ja');
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
      s.onload = () => res('ok'); s.onerror = () => res('erro');
      document.head.appendChild(s);
    });
  `);
  if (carregouDec === 'erro') {
    console.log('  ⏭️  sem internet: pulada a decodificação independente do QR');
  } else {
    const lido = await ev(`
      return (async () => {
        const svg = document.querySelector('.rastreio svg.qr');
        const xml = new XMLSerializer().serializeToString(svg);
        const img = new Image();
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
        await img.decode();
        const L = 400;
        const cv = document.createElement('canvas'); cv.width = cv.height = L;
        const cx = cv.getContext('2d');
        cx.fillStyle = '#fff'; cx.fillRect(0, 0, L, L);
        cx.imageSmoothingEnabled = false;
        cx.drawImage(img, 0, 0, L, L);
        const d = cx.getImageData(0, 0, L, L);
        const r = jsQR(d.data, d.width, d.height);
        return r ? r.data : null;
      })();
    `);
    ok(typeof lido === 'string' && lido.includes('#/rastreio/' + codigo),
      `QR da tela decodifica para a URL de rastreio (${lido})`);
    ok(typeof lido === 'string' && lido.startsWith('http'), 'a URL no QR é absoluta (abre do celular)');
  }
  await ev('return __t.clicar(".modal-x")');
  await espera(300);

  // comprar outra peça gera um código próprio
  await ev('return __t.clicar(".produto button.acao", "Comprar")');
  await espera(600);
  const codigos = await ev(`
    const s = JSON.parse(localStorage.getItem('raizes-mvp-v2'));
    const p = s.vendas.filter(v => v.tipo === 'produto' && v.rastreio);
    return { total: p.length, unicos: new Set(p.map(v => v.rastreio)).size, origem: p[p.length - 1].origem };
  `);
  ok(codigos.total >= 2 && codigos.unicos === codigos.total, `cada peça recebe código próprio (${codigos.total} peças, ${codigos.unicos} códigos)`);
  ok(Array.isArray(codigos.origem) && codigos.origem.length > 0, 'a venda guarda as coletas de origem');

  // a página pública do turista
  await ev(`window.location.hash = '#/rastreio/' + ${JSON.stringify(codigo)}; return 1;`);
  await espera(900);
  await ev(HELPERS + ' return 1;');
  ok(await ev('return __t.conta(".rastreio-tela") === 1'), 'página pública de rastreio abre');
  ok(await ev('return __t.conta("nav.tabs") === 0'), 'sem painel da operação (é página de turista)');
  ok(await ev(`return __t.tem(${JSON.stringify(codigo)})`), 'mostra o código da peça');
  ok(await ev('return __t.tem("A jornada deste material")'), 'apresenta a jornada');
  ok(await ev('return __t.tem("Verificado pela DeTrash")'), 'diz quem verificou');
  ok(await ev('return __t.tem("Para onde foi o seu dinheiro")'), 'mostra para onde foi o dinheiro');
  ok(await ev('return __t.conta(".divisao-linha") === 3'), 'divisão em 3 destinos (60/25/15)');
  ok(await ev('return __t.tem("R$ 48,00")'), '60% de R$ 80 = R$ 48,00 para quem coletou');
  ok(await ev('return __t.tem("R$ 20,00")'), '25% de R$ 80 = R$ 20,00 para o Fundo Infância');
  ok(await ev('return __t.tem("de um bônus mensal")'), 'traduz o valor em impacto para uma criança');
  ok(await ev('return /slot \\d+/.test(__t.txt())'), 'conecta com o registro da transação (slot)');

  // a página é pública: nada de família ou criança nela
  const vazou = await ev(`
    const t = document.body.innerText;
    return ['Maria de Lourdes','José Raimundo','Ana Cláudia','Vacinação','pediátrica','Matrícula','PIN']
      .filter(p => t.includes(p));
  `);
  ok(vazou.length === 0, `página pública não expõe família nem criança${vazou.length ? ' — achou: ' + vazou.join(', ') : ''}`);

  await ev(`window.location.hash = '#/rastreio/RF-ZZZZ'; return 1;`);
  await espera(700);
  await ev(HELPERS + ' return 1;');
  ok(await ev('return __t.tem("não encontrado")'), 'código inválido mostra estado vazio orientado');
  await ev(`window.location.hash = '#/'; return 1;`);
  await espera(600);

  /* ---------- 15. console ---------- */
  secao('15. Erros e avisos do console (app, sem extensões)');
  if (erros.length) erros.slice(0, 12).forEach(e => console.log('    ' + e));
  ok(erros.length === 0, `nenhum erro/aviso do app no console (${erros.length})`);

} catch (e) {
  console.log('\n💥 ERRO NO TESTE: ' + e.message);
  falhas++;
} finally {
  try { ws?.close(); } catch { /* ignora */ }
  edge.kill();
  await espera(400);
  try { rmSync(perfil, { recursive: true, force: true }); } catch { /* ignora */ }
}

console.log('\n' + '='.repeat(56));
console.log(falhas === 0 ? `✅ ${total} verificações no navegador, todas passaram` : `❌ ${falhas} de ${total} falharam`);
process.exit(falhas === 0 ? 0 : 1);
