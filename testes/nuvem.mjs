/* ---------------------------------------------------------------------------
   Verifica, contra o banco de verdade, que o esquema compartilhado cumpre o
   que promete. Não é teste de "consegui inserir uma linha": é teste das
   GARANTIAS que fazem o desenho valer.

   O que importa aqui:
     · UPDATE e DELETE em `transacoes` são RECUSADOS (append-only de verdade)
     · a PK de `assinaturas` impede o mesmo signatário assinar duas vezes,
       e não estorva dois signatários diferentes assinando
     · `signature` unique impede replay de transação
     · os saldos vêm de soma, não de campo
     · os CHECK constraints barram lixo

   Credenciais: env SUPABASE_URL + SUPABASE_ANON_KEY, ou public/supabase.json.
   Sem credencial, o runner pula esta suíte.

   As linhas de teste usam a faixa de id 9.000.000+ e descrição "[teste]" para
   nunca colidir com dado do piloto. Elas PERMANECEM no banco de propósito:
   apagar seria justamente o que o esquema proíbe. Para limpar, use o SQL
   Editor do Supabase (service role ignora RLS):
     delete from transacoes where seq >= 9000000;
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

const BASE = cred.url.replace(/\/$/, '') + '/rest/v1/';
const H = () => ({
  apikey: cred.anonKey,
  Authorization: 'Bearer ' + cred.anonKey,
  'content-type': 'application/json',
});

let falhas = 0, total = 0;
const ok = (cond, msg) => {
  total++;
  if (cond) console.log('  ✓ ' + msg);
  else { falhas++; console.log('  ✗ FALHOU: ' + msg); }
};
const secao = t => console.log('\n' + t);

async function chamar(caminho, opcoes = {}) {
  const r = await fetch(BASE + caminho, { ...opcoes, headers: { ...H(), ...opcoes.headers } });
  const texto = await r.text();
  let corpo = null;
  try { corpo = texto ? JSON.parse(texto) : null; } catch { corpo = { bruto: texto }; }
  return { status: r.status, ok: r.ok, corpo };
}

const inserir = (tabela, linhas, prefer = 'return=representation') =>
  chamar(tabela, { method: 'POST', headers: { Prefer: prefer }, body: JSON.stringify(linhas) });
const ler = (tabela, query) => chamar(`${tabela}?${query}`);
const alterar = (tabela, filtro, campos) =>
  chamar(`${tabela}?${filtro}`, { method: 'PATCH', body: JSON.stringify(campos) });
const remover = (tabela, filtro) => chamar(`${tabela}?${filtro}`, { method: 'DELETE' });

/* faixa reservada para não encostar em dado do piloto */
const N = 9_000_000 + (Date.now() % 100_000);
const FAM = N, COND = N, PROP = N, SEQ = N;
const marca = '[teste] ' + new Date().toISOString();

console.log(`projeto: ${cred.url}`);
console.log(`faixa de teste: ${N}`);

try {
  /* ---------------------------------------------------------------- base --- */
  secao('1. Entidades operacionais aceitam escrita');
  ok((await inserir('familias', { id: FAM, codigo: 'TESTE-' + N, criancas: 2 })).ok,
    'insere família com código pseudônimo');
  ok((await inserir('condicoes', { id: COND, familia_id: FAM, mes: 'Julho', tipo: marca })).ok,
    'insere condição ligada à família');
  ok((await inserir('propostas', { id: PROP, familia_id: FAM, condicao_id: COND, valor: 60 })).ok,
    'insere proposta no cofre');

  secao('2. CHECK constraints barram lixo');
  ok(!(await inserir('familias', { id: FAM + 1, codigo: 'X-' + N, criancas: 0 })).ok,
    'recusa família com 0 crianças');
  ok(!(await inserir('coletas', {
    id: N, coletor: 'T', material: 'Vidro', kg: -5, local: 'T', data: '2026-07-01',
  })).ok, 'recusa coleta com kg negativo');
  ok(!(await inserir('propostas', {
    id: PROP + 1, familia_id: FAM, condicao_id: COND, valor: 60, status: 'inventado',
  })).ok, 'recusa proposta com status fora do enum');
  ok(!(await inserir('condicoes', {
    id: COND + 1, familia_id: FAM, mes: 'Julho', tipo: 'x', status: 'qualquer',
  })).ok, 'recusa condição com status fora do enum');

  /* ------------------------------------------------------- append-only ----- */
  secao('3. `transacoes` é append-only DE VERDADE');
  const tx = await inserir('transacoes', {
    seq: SEQ, slot: 1, tipo: 'TESTE', descricao: marca, valor: 0,
    signature: 'sig-' + N, prev_signature: 'anterior-' + N,
  });
  ok(tx.ok, 'aceita INSERT de transação');

  const upd = await alterar('transacoes', `seq=eq.${SEQ}`, { descricao: 'REESCRITO' });
  const conferido = await ler('transacoes', `seq=eq.${SEQ}&select=descricao`);
  const naoMudou = conferido.corpo?.[0]?.descricao === marca;
  ok(naoMudou, `UPDATE não altera a linha (status ${upd.status}, descrição intacta)`);

  const del = await remover('transacoes', `seq=eq.${SEQ}`);
  const aindaLa = await ler('transacoes', `seq=eq.${SEQ}&select=seq`);
  ok(aindaLa.corpo?.length === 1, `DELETE não apaga a linha (status ${del.status})`);

  ok(!(await inserir('transacoes', {
    seq: SEQ + 1, slot: 2, tipo: 'TESTE', descricao: marca, valor: 0,
    signature: 'sig-' + N, prev_signature: 'x',
  })).ok, 'signature unique impede replay da mesma transação');

  /* ----------------------------------------------- assinaturas 2-de-3 ----- */
  secao('4. Assinatura é linha: 2-de-3 correto por construção');
  ok((await inserir('assinaturas', { proposta_id: PROP, signatario: 'viva' })).ok,
    'Instituto Vivá assina');
  const dup = await inserir('assinaturas', { proposta_id: PROP, signatario: 'viva' });
  ok(!dup.ok, `mesmo signatário não assina duas vezes (status ${dup.status})`);
  ok((await inserir('assinaturas', { proposta_id: PROP, signatario: 'detrash' })).ok,
    'DeTrash assina — signatário diferente não conflita');
  ok(!(await inserir('assinaturas', { proposta_id: PROP, signatario: 'terceiro' })).ok,
    'recusa signatário fora dos três credenciados');

  const vista = await ler('propostas_com_assinaturas', `id=eq.${PROP}&select=assinaturas,quem_assinou`);
  const linha = vista.corpo?.[0];
  ok(Number(linha?.assinaturas) === 2, `a view conta 2 assinaturas (contou ${linha?.assinaturas})`);
  ok(Array.isArray(linha?.quem_assinou) && linha.quem_assinou.includes('viva') && linha.quem_assinou.includes('detrash'),
    `a view diz quem assinou (${JSON.stringify(linha?.quem_assinou)})`);

  /* -------------------------------------------------- saldo é soma -------- */
  secao('5. Saldo é soma de livro imutável, não campo');
  await inserir('movimentos', [
    { caixa: 'fundo', valor: 645, motivo: marca, transacao_seq: SEQ },
    { caixa: 'fundo', valor: -60, motivo: marca, transacao_seq: SEQ },
  ], 'return=minimal');
  const sal = await ler('saldos', 'caixa=eq.fundo&select=saldo');
  ok(sal.ok && Number(sal.corpo?.[0]?.saldo) >= 585,
    `view saldos soma os movimentos (fundo = ${sal.corpo?.[0]?.saldo})`);

  await inserir('extrato', [
    { familia_id: FAM, descricao: 'Bônus de julho — ' + marca, valor: 60, transacao_seq: SEQ },
    { familia_id: FAM, descricao: 'Retirada pelo Pix ' + marca, valor: -20, transacao_seq: SEQ },
  ], 'return=minimal');
  const sf = await ler('saldo_familia', `familia_id=eq.${FAM}&select=saldo`);
  ok(Number(sf.corpo?.[0]?.saldo) === 40, `saldo da família = 60 − 20 = 40 (deu ${sf.corpo?.[0]?.saldo})`);

  const updExtrato = await alterar('extrato', `familia_id=eq.${FAM}`, { valor: 99999 });
  const sfDepois = await ler('saldo_familia', `familia_id=eq.${FAM}&select=saldo`);
  ok(Number(sfDepois.corpo?.[0]?.saldo) === 40,
    `extrato não pode ser reescrito para inflar saldo (status ${updExtrato.status})`);

  /* ------------------------------------------------------- integridade --- */
  secao('6. Integridade referencial');
  ok(!(await inserir('condicoes', { id: COND + 9, familia_id: 987654321, mes: 'J', tipo: 'x' })).ok,
    'recusa condição apontando para família inexistente');
  ok(!(await inserir('assinaturas', { proposta_id: 987654321, signatario: 'viva' })).ok,
    'recusa assinatura de proposta inexistente');

  /* ------------------------------------------------------------ limpeza -- */
  secao('7. Limpeza do que é apagável');
  const rmProp = await remover('propostas', `id=eq.${PROP}`);
  const rmCond = await remover('condicoes', `id=eq.${COND}`);
  const rmFam = await remover('familias', `id=eq.${FAM}`);
  ok(rmProp.ok && rmCond.ok && rmFam.ok, 'entidades operacionais podem ser removidas');
  console.log(`     (as linhas append-only da faixa ${N} permanecem — é o comportamento correto)`);
} catch (e) {
  console.log('  ✗ ' + e.message);
  falhas++;
}

console.log('\n' + '─'.repeat(52));
console.log(falhas === 0
  ? `✅ ${total} garantias do esquema confirmadas no banco real`
  : `❌ ${falhas} de ${total} falharam`);
process.exit(falhas === 0 ? 0 : 1);
