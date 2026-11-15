/* ---------------------------------------------------------------------------
   Três idiomas (português, inglês e espanhol) para o site inteiro.

   O código continua escrito em português. Quando a pessoa escolhe EN ou ES,
   esta camada troca, na própria página, cada texto pelo do dicionário
   (src/lib/traducoes/en.json e es.json, gerados a partir do código por
   scripts/i18n/extrair.mjs):

     · texto visível, inclusive o que o React desenha depois (observador de
       mutações);
     · atributos que alguém lê: placeholder, title, aria-label, alt e o rótulo
       de botões de formulário;
     · o título da aba;
     · e, para o que não passa pelo DOM (rótulos desenhados no canvas do mapa,
       confirm e prompt), a função `traduzir`.

   Cada nó guarda o seu texto original em português, então trocar EN → ES → PT
   sempre parte do original e nunca de uma tradução de tradução.

   Números entram nos dicionários como {0}, {1}…: "30 famílias" encontra a
   entrada "{0} famílias". Textos montados com variáveis (template strings)
   também viram moldes com {0}, {1}…

   Português é o padrão. A escolha fica salva no navegador e pode vir no
   endereço (?lang=en ou ?lang=es).
   Escrito com ajuda de IA (Anthropic Claude) e revisado pela equipe.
--------------------------------------------------------------------------- */

export const IDIOMAS = [
  { id: 'pt', rotulo: 'PT', nome: 'Português', html: 'pt-BR' },
  { id: 'en', rotulo: 'EN', nome: 'English', html: 'en' },
  { id: 'es', rotulo: 'ES', nome: 'Español', html: 'es' },
];
const CHAVE = 'raizes-idioma-v1';
const VALIDOS = new Set(IDIOMAS.map((i) => i.id));

const carregadores = {
  en: () => import('./traducoes/en.json'),
  es: () => import('./traducoes/es.json'),
};

let atual = 'pt';
let dic = null;            // { exatos: Map, moldes: Map, regex: [] } do idioma atual
const ouvintes = new Set();

/* ---------- dicionário ---------- */
const NUM = /\d+(?:[.,]\d+)*/g;
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function montar(bruto) {
  const exatos = new Map();
  const moldes = new Map();   // chave com números trocados por {i}
  const regex = [];           // moldes com {i} que não são números
  for (const [pt, tr] of Object.entries(bruto)) {
    if (typeof tr !== 'string' || !tr) continue;
    if (/\{\d+\}/.test(pt)) {
      moldes.set(pt, tr);
      const partes = pt.split(/(\{\d+\})/);
      const ordem = [];
      const fonte = partes.map((p) => {
        const m = p.match(/^\{(\d+)\}$/);
        if (m) { ordem.push(+m[1]); return '(.+?)'; }
        return escapar(p);
      }).join('');
      if (partes.some((p) => p && !/^\{\d+\}$/.test(p) && /\p{L}/u.test(p))) regex.push({ re: new RegExp(`^${fonte}$`, 'u'), ordem, tr });
    } else {
      exatos.set(pt, tr);
      /* a mesma frase com outros números: "Cofre 2-de-3" vale como molde
         quando a tradução repete os mesmos números */
      const nums = pt.match(NUM);
      if (nums) {
        let i = 0;
        const chave = pt.replace(NUM, () => `{${i++}}`);
        let ok = true;
        let trMolde = tr;
        nums.forEach((n, k) => {
          if (!trMolde.includes(n)) ok = false;
          else trMolde = trMolde.replace(n, `⟦${k}⟧`);
        });
        if (ok && !moldes.has(chave)) moldes.set(chave, trMolde.replace(/⟦(\d+)⟧/g, '{$1}'));
      }
    }
  }
  /* moldes mais específicos (mais texto fixo) primeiro */
  regex.sort((a, b) => b.re.source.length - a.re.source.length);
  return { exatos, moldes, regex };
}

/** Traduz um texto já normalizado; devolve null se não houver tradução. */
function buscar(t) {
  if (!dic || !t) return null;
  const e = dic.exatos.get(t);
  if (e !== undefined) return e;
  const nums = t.match(NUM);
  if (nums) {
    let i = 0;
    const chave = t.replace(NUM, () => `{${i++}}`);
    const m = dic.moldes.get(chave);
    if (m !== undefined) return m.replace(/\{(\d+)\}/g, (_, k) => nums[+k] ?? '');
  }
  if (t.length < 400) {
    for (const { re, ordem, tr } of dic.regex) {
      const m = t.match(re);
      if (m) {
        const valores = {};
        ordem.forEach((idx, k) => { const v = m[k + 1]; valores[idx] = dic.exatos.get(norm(v)) ?? v; });
        return tr.replace(/\{(\d+)\}/g, (_, k) => valores[k] ?? '');
      }
    }
  }
  return null;
}

/** Para código fora do DOM (canvas, confirm, prompt). Sem tradução, o original. */
export function traduzir(s) {
  if (atual === 'pt' || typeof s !== 'string') return s;
  const t = norm(s);
  return buscar(t) ?? s;
}

/* Em desenvolvimento, guarda o que apareceu na tela sem tradução
   (window.__idiomaFaltas), para completar os dicionários. */
const faltas = new Set();
function anotarFalta(texto) {
  if (!import.meta.env?.DEV) return;
  const t = norm(texto);
  if (t.length > 1 && /\p{L}{2}/u.test(t)) { faltas.add(t); globalThis.__idiomaFaltas = faltas; }
}

/* ---------- página ---------- */
const ATRIBUTOS = ['placeholder', 'title', 'aria-label', 'alt', 'aria-description'];
const PULAR = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE', 'KBD', 'SAMP', 'svg:style']);
const origTexto = new WeakMap();   // nó de texto -> { orig, escrito }
const origAttr = new WeakMap();    // elemento -> { [attr]: { orig, escrito } }
let observador = null;
let aplicando = false;

function bloqueado(el) {
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
    if (PULAR.has(e.tagName)) return true;
    if (e.getAttribute('translate') === 'no' || e.isContentEditable) return true;
  }
  return false;
}

function aplicarTexto(no) {
  const valor = no.nodeValue;
  let reg = origTexto.get(no);
  /* o React (ou outro código) escreveu um texto novo: esse é o novo original */
  if (!reg || valor !== reg.escrito) { reg = { orig: valor, escrito: valor }; origTexto.set(no, reg); }
  const orig = reg.orig;
  if (!/\p{L}/u.test(orig)) return;
  let novo = orig;
  if (atual !== 'pt') {
    const t = buscar(norm(orig));
    if (t === null) anotarFalta(orig);
    if (t !== null) {
      const ini = orig.match(/^\s*/)[0];
      const fim = orig.match(/\s*$/)[0];
      novo = ini + t + fim;
    }
  }
  if (novo !== valor) no.nodeValue = novo;
  reg.escrito = novo;
}

function aplicarAtributos(el) {
  let regs = origAttr.get(el);
  for (const a of ATRIBUTOS) {
    if (!el.hasAttribute(a)) continue;
    const valor = el.getAttribute(a);
    regs ||= {};
    let r = regs[a];
    if (!r || valor !== r.escrito) r = regs[a] = { orig: valor, escrito: valor };
    const t = atual === 'pt' ? null : buscar(norm(r.orig));
    const novo = t ?? r.orig;
    if (novo !== valor) el.setAttribute(a, novo);
    r.escrito = novo;
  }
  if (el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) && el.value) {
    regs ||= {};
    let r = regs.value;
    if (!r || el.value !== r.escrito) r = regs.value = { orig: el.value, escrito: el.value };
    const novo = (atual === 'pt' ? null : buscar(norm(r.orig))) ?? r.orig;
    if (novo !== el.value) el.value = novo;
    r.escrito = novo;
  }
  if (regs) origAttr.set(el, regs);
}

function percorrer(raiz) {
  if (!raiz) return;
  if (raiz.nodeType === 3) { if (raiz.parentElement && !bloqueado(raiz.parentElement)) aplicarTexto(raiz); return; }
  if (raiz.nodeType !== 1 && raiz.nodeType !== 9 && raiz.nodeType !== 11) return;
  if (raiz.nodeType === 1 && bloqueado(raiz)) return;
  const andador = document.createTreeWalker(raiz, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (n.nodeType === 1) return PULAR.has(n.tagName) || n.getAttribute('translate') === 'no' ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  if (raiz.nodeType === 1) aplicarAtributos(raiz);
  for (let n = andador.nextNode(); n; n = andador.nextNode()) {
    if (n.nodeType === 3) aplicarTexto(n);
    else aplicarAtributos(n);
  }
}

function aoMudar(lista) {
  if (aplicando) return;
  aplicando = true;
  try {
    for (const m of lista) {
      if (m.type === 'characterData') { if (m.target.parentElement && !bloqueado(m.target.parentElement)) aplicarTexto(m.target); }
      else if (m.type === 'attributes') { if (!bloqueado(m.target)) aplicarAtributos(m.target); }
      else m.addedNodes.forEach(percorrer);
    }
  } finally { aplicando = false; }
}

function ligarObservador() {
  if (observador || typeof MutationObserver === 'undefined') return;
  observador = new MutationObserver(aoMudar);
  observador.observe(document.documentElement, {
    subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATRIBUTOS, 'value'],
  });
}

function aplicarTudo() {
  aplicando = true;
  try { percorrer(document.documentElement); } finally { aplicando = false; }
  const html = IDIOMAS.find((i) => i.id === atual)?.html ?? 'pt-BR';
  document.documentElement.lang = html;
}

/* ---------- escolha do idioma ---------- */
export const idiomaAtual = () => atual;
export function ouvirIdioma(f) { ouvintes.add(f); return () => ouvintes.delete(f); }

export async function definirIdioma(id) {
  if (!VALIDOS.has(id)) id = 'pt';
  try { globalThis.localStorage?.setItem(CHAVE, id); } catch { /* sem storage */ }
  if (id !== 'pt') {
    const mod = await carregadores[id]();
    dic = montar(mod.default ?? mod);
  } else dic = null;
  atual = id;
  if (typeof document !== 'undefined') { aplicarTudo(); ligarObservador(); }
  ouvintes.forEach((f) => f(atual));
}

function inicial() {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? '').get('lang')
      ?? new URLSearchParams((globalThis.location?.hash ?? '').split('?')[1] ?? '').get('lang');
    if (q && VALIDOS.has(q)) return q;
    const salvo = globalThis.localStorage?.getItem(CHAVE);
    if (salvo && VALIDOS.has(salvo)) return salvo;
  } catch { /* ok */ }
  return 'pt';
}

/** Chamado uma vez, antes de desenhar o app. */
export function iniciarIdioma() {
  const id = inicial();
  if (id !== 'pt') definirIdioma(id);
  else if (typeof document !== 'undefined') document.documentElement.lang = 'pt-BR';
}
