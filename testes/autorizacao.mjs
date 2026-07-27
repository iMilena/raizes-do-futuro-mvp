/* ---------------------------------------------------------------------------
   Autorização e consentimento — verifica contra o banco de VERDADE que a
   migração 02 faz o que promete.

   Este arquivo existe porque as três afirmações abaixo são fáceis de escrever
   num README e difíceis de garantir:

     1. quem não entrou NÃO LÊ NADA (o papel `anon` não tem policy);
     2. ninguém assina em nome de outra organização (o 2-de-3 é real);
     3. não existe família na nuvem sem consentimento ativo, e revogar tira o
        dado da leitura no mesmo instante.

   COMO RODAR
     · sem credencial nenhuma → pula.
     · com URL+anon key e a migração 02 ainda NÃO aplicada → verifica só isso e
       avisa o que falta.
     · com URL+anon key e migração aplicada → confere que anônimo está barrado.
     · com SUPABASE_TEST_EMAIL/SENHA além disso → confere papel, assinatura e
       o ciclo completo de consentimento.

   As linhas de teste usam id 9.900.000+ para não colidir com dado do piloto.
--------------------------------------------------------------------------- */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function credenciais() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return { url: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY };
  }
  try {
    const j = JSON.parse(readFileSync(join(RAIZ, 'public', 'supabase.json'), 'utf8'));
    if (j.url && j.anonKey) return j;
  } catch { /* sem arquivo */ }
  return null;
}

const cred = credenciais();
if (!cred) {
  console.log('  ⏭️  sem credenciais do Supabase (env ou public/supabase.json)');
  process.exit(0);
}

const RAIZ_URL = cred.url.replace(/\/$/, '');
const BASE = RAIZ_URL + '/rest/v1/';

let falhas = 0, total = 0;
const ok = (cond, msg) => {
  total++;
  if (cond) console.log('  ✓ ' + msg);
  else { falhas++; console.log('  ✗ FALHOU: ' + msg); }
};
const secao = t => console.log('\n' + t);

const cabAnon = () => ({ apikey: cred.anonKey, Authorization: 'Bearer ' + cred.anonKey, 'content-type': 'application/json' });
const cabToken = t => ({ apikey: cred.anonKey, Authorization: 'Bearer ' + t, 'content-type': 'application/json' });

const ID = 9_900_000 + (process.pid % 90_000); // id estável dentro da execução

/* Corpo dentro de uma função para poder sair no meio com `return`.
   `process.exit()` logo depois de um fetch derruba o Node no Windows com
   "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" — o processo morre
   enquanto o undici fecha o socket. Sair pelo exitCode espera o handle. */
await (async () => {

/* ------------------------------------------------- estado da migração ----- */
secao('1. A migração 02 está aplicada?');
const rPapeis = await fetch(`${BASE}papeis?select=user_id&limit=1`, { headers: cabAnon() });
const aplicada = rPapeis.status !== 404;
ok(true, aplicada
  ? `tabela \`papeis\` existe (HTTP ${rPapeis.status} para anônimo)`
  : 'tabela `papeis` NÃO existe — migração 02 ainda não foi aplicada');

if (!aplicada) {
  console.log('\n  ⏭️  Rode supabase/migracao-02-auth-papeis-consentimento.sql no SQL Editor');
  console.log('     e depois esta suíte verifica as garantias de autorização.');
  console.log(`\n✅ ${total} verificação (migração pendente, nada a verificar ainda)`);
  return;
}

/* ------------------------------------------- anônimo não lê mais nada ----- */
secao('2. Quem não entrou não lê nada');
const TABELAS = ['familias', 'condicoes', 'coletas', 'relatorios', 'vendas',
  'propostas', 'transacoes', 'movimentos', 'extrato', 'assinaturas', 'consentimentos'];

for (const t of TABELAS) {
  const r = await fetch(`${BASE}${t}?select=*&limit=1`, { headers: cabAnon() });
  let corpo = [];
  try { corpo = await r.json(); } catch { /* erro do PostgREST */ }
  /* RLS sem policy para `anon` devolve 200 com lista VAZIA (não 403) — o
     PostgREST não erra, simplesmente nenhuma linha passa pelo filtro. Então a
     asserção é "não veio linha", não "veio erro". Confundir os dois é como se
     engana com RLS. */
  const vazou = Array.isArray(corpo) && corpo.length > 0;
  ok(!vazou, `${t}: anônimo não recebe linha (HTTP ${r.status}${Array.isArray(corpo) ? `, ${corpo.length} linhas` : ''})`);
}

/* as views de dinheiro são o furo clássico: sem security_invoker elas rodam
   com os direitos de quem criou e vazam por cima da RLS da tabela */
for (const v of ['saldos', 'saldo_familia', 'propostas_com_assinaturas']) {
  const r = await fetch(`${BASE}${v}?select=*&limit=1`, { headers: cabAnon() });
  let corpo = [];
  try { corpo = await r.json(); } catch { /* ok */ }
  ok(!(Array.isArray(corpo) && corpo.length > 0),
    `view ${v}: não vaza por cima da RLS (security_invoker)`);
}

const rIns = await fetch(`${BASE}coletas`, {
  method: 'POST',
  headers: { ...cabAnon(), Prefer: 'return=minimal' },
  body: JSON.stringify([{ id: ID, coletor: '[teste] anônimo', material: 'Vidro', kg: 1, local: 'x', data: '2026-07-26' }]),
});
ok(!rIns.ok, `anônimo não insere coleta (HTTP ${rIns.status})`);

/* --------------------------------------------------------- com sessão ----- */
const email = process.env.SUPABASE_TEST_EMAIL;
const senha = process.env.SUPABASE_TEST_SENHA;
if (!email || !senha) {
  console.log('\n  ⏭️  sem SUPABASE_TEST_EMAIL/SUPABASE_TEST_SENHA — as garantias de papel,');
  console.log('     assinatura e consentimento precisam de um usuário com papel.');
  return;
}

secao('3. Sessão da operação');
const rTok = await fetch(`${RAIZ_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: cred.anonKey, 'content-type': 'application/json' },
  body: JSON.stringify({ email, password: senha }),
});
const tokJson = await rTok.json().catch(() => null);
ok(rTok.ok && tokJson?.access_token, `login da operação funciona (HTTP ${rTok.status})`);
if (!rTok.ok) {
  console.log('     ' + JSON.stringify(tokJson).slice(0, 200));
  return;
}
const TOKEN = tokJson.access_token;
const UID = tokJson.user?.id;

const rPapel = await fetch(`${BASE}papeis?select=*`, { headers: cabToken(TOKEN) });
const papeis = await rPapel.json().catch(() => []);
ok(Array.isArray(papeis) && papeis.length === 1, `vê exatamente o próprio papel (${papeis.length} linha)`);
const papel = papeis[0] || {};
ok(Boolean(papel.papel), `papel definido: ${papel.papel || '—'} (${papel.organizacao || 'sem organização'})`);
ok(papel.user_id === UID, 'a linha de papel é a do usuário logado');

const rLer = await fetch(`${BASE}coletas?select=id&limit=1`, { headers: cabToken(TOKEN) });
ok(rLer.ok, `com sessão, a leitura volta a funcionar (HTTP ${rLer.status})`);

/* ------------------------------------------- consentimento é obrigatório -- */
secao('4. Não existe família na nuvem sem consentimento');
const FAM = ID + 1;

const semConsent = await fetch(`${BASE}familias`, {
  method: 'POST',
  headers: { ...cabToken(TOKEN), Prefer: 'return=minimal' },
  body: JSON.stringify([{ id: FAM, codigo: `TESTE-${FAM}`, criancas: 1 }]),
});
ok(!semConsent.ok, `família sem consentimento é RECUSADA pelo banco (HTTP ${semConsent.status})`);

const podeConsentir = ['validador', 'gestor'].includes(papel.papel);
const CONS = ID + 2;
const rConsent = await fetch(`${BASE}consentimentos`, {
  method: 'POST',
  headers: { ...cabToken(TOKEN), Prefer: 'return=minimal' },
  body: JSON.stringify([{
    id: CONS, familia_id: FAM, versao_termo: 'termo-teste-v1',
    finalidades: ['[teste] verificação de policy'],
    forma: 'presencial-assinado', termo_hash: 'a'.repeat(64), coletado_por: UID,
  }]),
});
ok(podeConsentir ? rConsent.ok : !rConsent.ok,
  podeConsentir
    ? `papel ${papel.papel} registra consentimento (HTTP ${rConsent.status})`
    : `papel ${papel.papel} NÃO registra consentimento, como esperado (HTTP ${rConsent.status})`);

if (podeConsentir && rConsent.ok) {
  const comConsent = await fetch(`${BASE}familias`, {
    method: 'POST',
    headers: { ...cabToken(TOKEN), Prefer: 'return=minimal' },
    body: JSON.stringify([{ id: FAM, codigo: `TESTE-${FAM}`, criancas: 1 }]),
  });
  ok(comConsent.ok, `com consentimento, a mesma família é ACEITA (HTTP ${comConsent.status})`);

  const rVe = await fetch(`${BASE}familias?id=eq.${FAM}&select=id`, { headers: cabToken(TOKEN) });
  const ve = await rVe.json().catch(() => []);
  ok(ve.length === 1, 'e passa a ser lida');

  secao('5. Revogar o consentimento tira o dado da leitura');
  const rRev = await fetch(`${BASE}consentimentos?id=eq.${CONS}`, {
    method: 'PATCH',
    headers: { ...cabToken(TOKEN), Prefer: 'return=minimal' },
    body: JSON.stringify({ revogado_em: new Date().toISOString(), revogado_motivo: '[teste]' }),
  });
  ok(rRev.ok, `revogação é aceita (HTTP ${rRev.status})`);

  const rDepois = await fetch(`${BASE}familias?id=eq.${FAM}&select=id`, { headers: cabToken(TOKEN) });
  const depois = await rDepois.json().catch(() => []);
  ok(depois.length === 0, 'família revogada desaparece da leitura na hora');

  /* o registro da revogação NÃO pode ser apagado: é parte da prova */
  const rDel = await fetch(`${BASE}consentimentos?id=eq.${CONS}`, { method: 'DELETE', headers: cabToken(TOKEN) });
  const sobrou = await (await fetch(`${BASE}consentimentos?id=eq.${CONS}&select=id`, { headers: cabToken(TOKEN) })).json().catch(() => []);
  ok(sobrou.length === 1, `o registro do consentimento não pode ser apagado (DELETE ${rDel.status})`);
}

/* ------------------------------------------------ 2-de-3 de verdade ------- */
secao('6. Ninguém assina em nome de outra organização');
const ORGS = ['viva', 'detrash', 'comunidade'];
const minha = papel.signatario;
ok(true, `este usuário assina como: ${minha || 'nenhuma (não é signatário)'}`);

/* precisa de uma proposta existente para tentar assinar; usa a primeira que houver */
const props = await (await fetch(`${BASE}propostas?select=id&limit=1`, { headers: cabToken(TOKEN) })).json().catch(() => []);
if (!props.length) {
  console.log('     (sem proposta na base — teste de assinatura por organização pulado)');
} else {
  const pid = props[0].id;
  for (const org of ORGS.filter(o => o !== minha)) {
    const r = await fetch(`${BASE}assinaturas`, {
      method: 'POST',
      headers: { ...cabToken(TOKEN), Prefer: 'return=minimal' },
      body: JSON.stringify([{ proposta_id: pid, signatario: org }]),
    });
    /* 409 seria "já assinou", o que também não é permissão concedida agora */
    ok(!r.ok, `recusa assinar como "${org}" (HTTP ${r.status})`);
  }
}

})();

console.log(`\n${falhas ? '❌' : '✅'} ${total} verificações de autorização, ${falhas} falha(s)`);
process.exitCode = falhas ? 1 : 0;
