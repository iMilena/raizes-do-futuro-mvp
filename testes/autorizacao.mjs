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

/**
 * Faixa de id deste teste. Estável DENTRO da execução, diferente ENTRE execuções.
 *
 * Antes vinha de `process.pid % 90000` — e pid repete. Quando repetia, o INSERT
 * batia na chave primária de uma execução anterior, voltava 409, e a asserção
 * "o aparelho da família deposita sem sessão" falhava por colisão, não por
 * policy. Falhou uma vez na rodada completa e passou sozinha, que é a assinatura
 * clássica de teste com id não-único.
 */
const ID = 9_900_000 + (Date.now() % 80_000) + Math.floor(Math.random() * 900);

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

let CT = null, segredo = null, temContestacoes = false;

/* -------------------------------- canal de contestação sem conta (migr. 04) -- */
secao('7. Contestação: caixa de entrada, não acesso');

const rTab = await fetch(`${BASE}contestacoes?select=id&limit=1`, { headers: cabAnon() });
if (rTab.status === 404) {
  console.log('     ⏭️  migração 04 não aplicada — rode supabase/migracao-04-contestacoes.sql');
} else {
  temContestacoes = true;
  /* 1. o anônimo NÃO lê nada */
  const corpoAnon = await rTab.json().catch(() => null);
  ok(!(Array.isArray(corpoAnon) && corpoAnon.length > 0),
    `anônimo não lê contestação nenhuma (HTTP ${rTab.status})`);

  /* 2. mas DEPOSITA — é o que faz o canal existir para quem não tem conta */
  CT = ID + 10;
  /* segredo único por execução: reaproveitar faz a leitura por chave devolver a
     linha de OUTRA execução (a função tem `limit 1`) e a asserção mede a coisa
     errada */
  segredo = 'seg-' + ID + '-' + Math.random().toString(16).slice(2, 14);
  const rDep = await fetch(`${BASE}contestacoes`, {
    method: 'POST',
    headers: { ...cabAnon(), Prefer: 'return=minimal' },
    body: JSON.stringify([{
      id: CT, familia_id: ID + 1, tipo: 'coleta', alvo_id: 1,
      alvo_desc: '[teste] 60 kg', motivo: 'O peso está errado',
      detalhe: '[teste] verificação de policy', chave_leitura: segredo,
    }]),
  });
  ok(rDep.ok, `o aparelho da família deposita sem sessão (HTTP ${rDep.status})`);

  /* 3. e NÃO consegue fabricar uma reclamação já resolvida */
  const rForja = await fetch(`${BASE}contestacoes`, {
    method: 'POST',
    headers: { ...cabAnon(), Prefer: 'return=minimal' },
    body: JSON.stringify([{
      id: CT + 1, familia_id: ID + 1, tipo: 'coleta', motivo: 'forjada',
      chave_leitura: segredo + 'x', status: 'resolvida', resposta: 'já pagamos',
    }]),
  });
  ok(!rForja.ok, `não consegue inserir contestação já "resolvida" (HTTP ${rForja.status})`);

  /* 4. nem responder à própria reclamação */
  const rResp = await fetch(`${BASE}contestacoes?id=eq.${CT}`, {
    method: 'PATCH',
    headers: { ...cabAnon(), Prefer: 'return=minimal' },
    body: JSON.stringify({ resposta: 'me respondi', status: 'resolvida' }),
  });
  const conf = await (await fetch(`${BASE}rpc/contestacao_por_chave`, {
    method: 'POST', headers: cabAnon(), body: JSON.stringify({ chave: segredo }),
  })).json().catch(() => []);
  ok(Array.isArray(conf) && conf.length === 1, 'a leitura pelo segredo devolve a própria contestação');
  ok(conf[0]?.resposta == null, `e o anônimo não conseguiu responder a si mesmo (PATCH ${rResp.status})`);

  /* 5. segredo errado não devolve nada — é capacidade, não filtro de tela */
  const errado = await (await fetch(`${BASE}rpc/contestacao_por_chave`, {
    method: 'POST', headers: cabAnon(), body: JSON.stringify({ chave: 'x'.repeat(32) }),
  })).json().catch(() => []);
  ok(Array.isArray(errado) && errado.length === 0, 'segredo errado não devolve linha nenhuma');
  const curto = await (await fetch(`${BASE}rpc/contestacao_por_chave`, {
    method: 'POST', headers: cabAnon(), body: JSON.stringify({ chave: 'abc' }),
  })).json().catch(() => []);
  ok(Array.isArray(curto) && curto.length === 0, 'e segredo curto também não');

  /* 6. ninguém apaga reclamação */
  const rDel = await fetch(`${BASE}contestacoes?id=eq.${CT}`, { method: 'DELETE', headers: cabAnon() });
  const aindaLa = await (await fetch(`${BASE}rpc/contestacao_por_chave`, {
    method: 'POST', headers: cabAnon(), body: JSON.stringify({ chave: segredo }),
  })).json().catch(() => []);
  ok(aindaLa.length === 1, `reclamação não é apagável (DELETE ${rDel.status})`);
}

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

if (temContestacoes) {
  /* 7. com sessão, a operação lê e responde */
  if (TOKEN && ['validador', 'gestor'].includes(papel.papel)) {
    /* A contestação de teste é de uma família SEM consentimento — de propósito.
       Na migração 04 a policy de leitura exigia consentimento, e o efeito era
       grave: o depósito não exige (o celular não tem sessão), então a família
       sem consentimento reclamava e a operação nunca via. Reclamar sobre dado
       inexato é direito independente do consentimento (LGPD art. 18, III), e a
       migração 05 tirou esse gate. Esta asserção é o que trava a regressão. */
    const rLer = await fetch(`${BASE}contestacoes?id=eq.${CT}&select=motivo,status`, { headers: cabToken(TOKEN) });
    const vista = await rLer.json().catch(() => []);
    ok(rLer.ok, `a operação com papel ${papel.papel} lê a contestação (HTTP ${rLer.status})`);
    ok(Array.isArray(vista) && vista.length === 1,
      `e VÊ a linha mesmo sem consentimento da família (${Array.isArray(vista) ? vista.length : '?'} linha) — migração 05`);
    const rOk = await fetch(`${BASE}contestacoes?id=eq.${CT}`, {
      method: 'PATCH',
      headers: { ...cabToken(TOKEN), Prefer: 'return=minimal' },
      body: JSON.stringify({ resposta: '[teste] conferimos', status: 'resolvida', respondido_em: new Date().toISOString() }),
    });
    ok(rOk.ok, `e responde (HTTP ${rOk.status})`);
    const depois = await (await fetch(`${BASE}rpc/contestacao_por_chave`, {
      method: 'POST', headers: cabAnon(), body: JSON.stringify({ chave: segredo }),
    })).json().catch(() => []);
    ok(depois[0]?.resposta === '[teste] conferimos',
      'e a família recebe a resposta pelo segredo, sem ter conta — o circuito fecha');
    void vista;
  }
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
