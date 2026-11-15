/* ---------------------------------------------------------------------------
   Extrai do código todos os textos que podem aparecer na tela, para os
   dicionários de inglês e espanhol (src/lib/traducoes/*.json).

   Lê todos os .js, .jsx e .ts de src com o parser do Babel e junta:
     · texto JSX (o que fica entre as tags);
     · strings e template strings que não são código (classes, ids, caminhos,
       importações, atributos técnicos). Nos templates, cada ${…} vira {0}, {1}…

   Uso:  node scripts/i18n/extrair.mjs          → scripts/i18n/textos.json
         node scripts/i18n/extrair.mjs --faltam → lista o que ainda não está
                                                  em en.json ou es.json
   Escrito com ajuda de IA (Anthropic Claude) e revisado pela equipe.
--------------------------------------------------------------------------- */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(RAIZ, 'src');

/* Atributos JSX que nunca são texto para pessoas. */
const ATRIBUTOS_TECNICOS = new Set([
  'className', 'key', 'id', 'href', 'src', 'srcSet', 'style', 'type', 'name', 'htmlFor', 'role', 'rel', 'target',
  'd', 'viewBox', 'fill', 'stroke', 'transform', 'points', 'xmlns', 'method', 'autoComplete', 'inputMode', 'lang',
  'sizes', 'loading', 'decoding', 'as', 'form', 'pattern', 'accept', 'capture', 'dir', 'tabIndex', 'strokeWidth',
  'strokeLinecap', 'strokeLinejoin', 'fillRule', 'clipRule', 'gradientUnits', 'offset', 'stopColor', 'mask', 'clipPath',
  'preserveAspectRatio', 'textAnchor', 'dominantBaseline', 'fontFamily', 'fontWeight', 'enterKeyHint', 'autoCapitalize',
  'spellCheck', 'download', 'media', 'crossOrigin', 'referrerPolicy', 'allow', 'sandbox', 'icone', 'cor', 'tom', 'variante',
  'tamanho', 'tipo', 'como', 'tab', 'rota', 'modo', 'campo', 'chave', 'idioma',
]);
/* Chamadas cujos argumentos são código. */
const CHAMADAS_TECNICAS = /^(require|import|querySelector|querySelectorAll|getElementById|addEventListener|removeEventListener|getItem|setItem|removeItem|matchMedia|createElement|getContext|setAttribute|getAttribute|removeAttribute|toggle|add|remove|contains|startsWith|endsWith|includes|split|replace|replaceAll|padStart|padEnd|join|indexOf|toLocaleString|toLocaleDateString|toLocaleTimeString|Intl|fetch|from|rpc|select|eq|order|channel|on|emit|log|warn|debug|info|error|assert|expect|describe|it|test|postMessage|scrollTo|scrollIntoView|getPropertyValue|setProperty|keys|dispatchEvent|Event|CustomEvent|URL|URLSearchParams|RegExp|Symbol|atob|btoa|encodeURIComponent|decodeURIComponent|localeCompare|insert|update|upsert|delete|match|test|exec|search|has|get|set|lazy)$/;

const temLetra = (s) => /\p{L}/u.test(s);
const pareceCodigo = (s) => {
  const t = s.trim();
  if (!t || !temLetra(t)) return true;
  if (/^(https?:|mailto:|tel:|data:|#|\/|\.\/|\.\.\/)/.test(t)) return true;
  if (/^[a-z0-9_\-./:#?=&%@+[\]()]+$/.test(t)) return true;            // ids, classes, chaves
  if (/^[A-Z0-9_]+$/.test(t) && t.length > 3 && t.includes('_')) return true; // CONSTANTES
  if (/[{};]\s*$|=>|^\s*[.#]?[a-z-]+\s*\{/.test(t)) return true;        // css e código
  if (/^(rgba?|hsla?|var|calc|url|linear-gradient|radial-gradient)\(/.test(t)) return true;
  if (/^[a-z-]+(\s+[a-z0-9-]+)+$/.test(t) && !/[ãáàâéêíóôõúç]/.test(t) && t.split(' ').every(w => w.includes('-') || w.length < 3 || /\d/.test(w))) return true; // listas de classes
  return false;
};
const norm = (s) => s.replace(/\s+/g, ' ').trim();

function arquivos(dir) {
  const out = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) { if (nome !== 'traducoes') out.push(...arquivos(p)); }
    else if (nome !== 'i18n.jsx' && nome !== 'idioma.js' && /\.(jsx?|tsx?)$/.test(nome) && !/\.(test|spec)\./.test(nome) && !/\.d\.ts$/.test(nome)) out.push(p);
  }
  return out;
}

function andar(no, pai, visitar) {
  if (!no || typeof no.type !== 'string') return;
  visitar(no, pai);
  for (const k of Object.keys(no)) {
    if (k === 'loc' || k === 'start' || k === 'end' || k === 'extra' || k === 'leadingComments' || k === 'trailingComments') continue;
    const v = no[k];
    if (Array.isArray(v)) for (const f of v) andar(f, no, visitar);
    else if (v && typeof v.type === 'string') andar(v, no, visitar);
  }
}
const nomeChamada = (c) => c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed ? c.property.name : c.type === 'Import' ? 'import' : '';

export function extrair() {
  const textos = new Map(); // texto -> primeiro arquivo
  for (const arq of arquivos(SRC)) {
    const codigo = readFileSync(arq, 'utf8');
    let ast;
    try {
      ast = parse(codigo, { sourceType: 'module', plugins: ['jsx', 'typescript'], errorRecovery: true });
    } catch (e) { console.warn('não li', relative(RAIZ, arq), e.message); continue; }
    const pais = new WeakMap();
    andar(ast.program, null, (no, pai) => {
      pais.set(no, pai);
      const guardar = (s) => { const t = norm(s); if (t && !pareceCodigo(t) && !textos.has(t)) textos.set(t, relative(RAIZ, arq)); };
      const tecnico = () => {
        let p = pai, filho = no;
        for (let i = 0; i < 6 && p; i++) {
          if (p.type === 'ImportDeclaration' || p.type === 'ExportNamedDeclaration' && p.source === filho || p.type === 'ExportAllDeclaration') return true;
          if (p.type === 'JSXAttribute') { const n = p.name.name?.name ? `${p.name.namespace.name}:${p.name.name.name}` : p.name.name; return ATRIBUTOS_TECNICOS.has(n) || /^(data-|aria-(controls|labelledby|describedby|hidden|current|expanded|pressed|live|haspopup|selected|checked|modal|orientation|valuenow|valuemin|valuemax))/.test(n) || /^on[A-Z]/.test(n); }
          if ((p.type === 'ObjectProperty' || p.type === 'ObjectMethod') && p.key === filho && !p.computed) return true;
          if (p.type === 'CallExpression' || p.type === 'NewExpression') return CHAMADAS_TECNICAS.test(nomeChamada(p.callee));
          if (p.type === 'MemberExpression' && p.property === filho) return true;
          if (p.type === 'BinaryExpression' && ['===', '!==', '==', '!=', 'in', 'instanceof'].includes(p.operator)) return true;
          if (p.type === 'SwitchCase' && p.test === filho) return true;
          if (p.type === 'TSLiteralType' || p.type?.startsWith('TS')) return true;
          if (p.type === 'TaggedTemplateExpression') return true;
          filho = p; p = pais.get(p);
        }
        return false;
      };
      if (no.type === 'JSXText') guardar(no.value);
      else if (no.type === 'StringLiteral' && !tecnico()) guardar(no.value);
      else if (no.type === 'TemplateLiteral' && !tecnico()) {
        const partes = [];
        no.quasis.forEach((q, i) => { partes.push(q.value.cooked ?? q.value.raw); if (i < no.expressions.length) partes.push(`{${i}}`); });
        const s = partes.join('');
        if (no.expressions.length === 0) guardar(s);
        else if (temLetra(s.replace(/\{\d+\}/g, '')) && !pareceCodigo(s.replace(/\{\d+\}/g, 'x'))) guardar(s);
        /* também os pedaços com letra, que aparecem sozinhos quando o template é montado aos poucos */
        for (const q of no.quasis) { const v = q.value.cooked ?? ''; if (norm(v).split(' ').length >= 2) guardar(v); }
      }
    });
  }
  return textos;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const textos = extrair();
  const lista = [...textos.keys()].sort((a, b) => a.localeCompare(b, 'pt'));
  if (process.argv.includes('--faltam')) {
    for (const l of ['en', 'es']) {
      const p = join(SRC, 'lib', 'traducoes', `${l}.json`);
      const d = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
      const faltam = lista.filter((t) => !(t in d));
      console.log(`${l}: ${Object.keys(d).length} traduzidos, ${faltam.length} faltam`);
      if (process.argv.includes('--mostrar')) faltam.slice(0, 80).forEach((t) => console.log('   ', JSON.stringify(t)));
    }
  } else {
    writeFileSync(join(RAIZ, 'scripts', 'i18n', 'textos.json'), JSON.stringify(Object.fromEntries(lista.map((t) => [t, textos.get(t)])), null, 1));
    console.log(`${lista.length} textos, ${lista.reduce((n, t) => n + t.length, 0)} caracteres`);
  }
}
