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

/* Esta suíte exige sessão da operação. Não é escolha de teste: o cliente de
   nuvem passou a recusar trabalhar sem sessão (`nuvem.ativo()`), e o banco não
   tem policy para o papel anônimo depois da migração 02. Fingir uma sessão aqui
   testaria um caminho que não existe no app. */
const { abrirSessao, avisoSemSessao } = await import('./ajuda/sessao.mjs');
const SESSAO = await abrirSessao(cred);
if (!SESSAO) {
  avisoSemSessao('a suíte do esquema compartilhado');
  process.exit(77); // 77 = pulado, ver testes/executar.mjs
}
const TOKEN = SESSAO.access_token;

const H = () => ({
  apikey: cred.anonKey,
  Authorization: 'Bearer ' + (TOKEN || cred.anonKey),
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

/* Antes de tudo: o esquema está na versão nova? Sem isso, todo o resto falha por
   um motivo só, e dez linhas vermelhas escondem a única ação necessária. */
{
  const sonda = await chamar('movimentos?select=transacao_sig&limit=1');
  if (sonda.status !== 200) {
    console.log('\n  ✗ MIGRAÇÃO PENDENTE');
    console.log('    rode supabase/migracao-01-chave-e-idempotencia.sql no SQL Editor do Supabase.');
    console.log('');
    console.log('    Sem ela, dois problemas ficam abertos:');
    console.log('      · `seq` como chave primária descarta em silêncio a transação de um');
    console.log('        segundo aparelho offline — o caso que a sincronização deveria resolver;');
    console.log('      · o reenvio da fila duplica dinheiro (testado: R$ 90 viraram R$ 180).');
    process.exit(1);
  }
}
try {
  /* ---------------------------------------------------------------- base --- */
  secao('1. Entidades operacionais aceitam escrita');
  /* Consentimento PRIMEIRO: desde a migração 02 a policy am_criar recusa
     família sem consentimento ativo. Esta suíte foi escrita antes disso e
     inseria família direto — o 403 resultante era a policy funcionando, não
     defeito. Registrar aqui é o que o app faz na aba Cadastro. */
  const consentiu = await inserir('consentimentos', {
    id: N, familia_id: FAM, versao_termo: 'termo-teste-nuvem',
    finalidades: ['[teste] garantias do esquema'], forma: 'presencial-assinado',
    termo_hash: 'c'.repeat(64), coletado_por: SESSAO.usuario.id,
  });
  ok(consentiu.ok, `consentimento registrado antes da família (status ${consentiu.status})`);
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
  /* Desde a migração 02, só assina quem é signatário DAQUELA organização — a
     trava que faz o 2-de-3 valer. O usuário desta suíte tem signatario nulo
     de propósito (dar-lhe uma organização real duplicaria o signatário e o
     2-de-3 voltaria a poder ser cumprido por uma só). Então: com signatário,
     exercita a chave primária; sem, confere que a recusa acontece — que é a
     garantia mais importante das duas. */
  const meuSig = SESSAO.papel?.signatario ?? null;
  if (meuSig) {
    ok((await inserir('assinaturas', { proposta_id: PROP, signatario: meuSig })).ok,
      `assina como ${meuSig}`);
    const dup = await inserir('assinaturas', { proposta_id: PROP, signatario: meuSig });
    ok(!dup.ok, `mesmo signatário não assina duas vezes (status ${dup.status})`);
  } else {
    const recusa = await inserir('assinaturas', { proposta_id: PROP, signatario: 'viva' });
    ok(!recusa.ok,
      `sem signatário no papel, a assinatura é RECUSADA pelo banco (status ${recusa.status})`);
    console.log('     (a PK de assinaturas e o 2-de-3 por organizacao estao em: npm test -- autorizacao)');
  }
  ok(!(await inserir('assinaturas', { proposta_id: PROP, signatario: 'terceiro' })).ok,
    'recusa signatário fora dos três credenciados');

  /* A garantia da view não é "conta 2": é BATER COM A TABELA. Assim ela é
     verificável com qualquer número de assinaturas — inclusive zero, que é o
     caso de um usuário sem signatário. Antes a asserção fixava 2 e falhava por
     falta de permissão de assinar, não por a view estar errada. */
  const naTabela = await ler('assinaturas', `proposta_id=eq.${PROP}&select=signatario`);
  const assinantes = (naTabela.corpo || []).map(a => a.signatario).sort();
  const vista = await ler('propostas_com_assinaturas', `id=eq.${PROP}&select=assinaturas,quem_assinou`);
  const linha = vista.corpo?.[0];
  ok(Number(linha?.assinaturas) === assinantes.length,
    `a view conta o mesmo que a tabela (${linha?.assinaturas} = ${assinantes.length})`);
  ok(JSON.stringify((linha?.quem_assinou || []).slice().sort()) === JSON.stringify(assinantes),
    `a view diz exatamente quem assinou (${JSON.stringify(linha?.quem_assinou)})`);

  /* -------------------------------------------------- saldo é soma -------- */
  secao('5. Saldo é soma de livro imutável, não campo');
  // duas transações distintas: (transacao_sig, caixa) é único, então dois
  // movimentos no mesmo caixa precisam vir de transações diferentes
  await inserir('transacoes', {
    seq: SEQ + 2, slot: 3, tipo: 'TESTE', descricao: marca, valor: 0,
    signature: 'sig2-' + N, prev_signature: 'sig-' + N,
  }, 'return=minimal');
  await inserir('movimentos', [
    { caixa: 'fundo', valor: 645, motivo: marca, transacao_sig: 'sig-' + N },
    { caixa: 'fundo', valor: -60, motivo: marca, transacao_sig: 'sig2-' + N },
  ], 'return=minimal');
  const sal = await ler('saldos', 'caixa=eq.fundo&select=saldo');
  ok(sal.ok && Number(sal.corpo?.[0]?.saldo) >= 585,
    `view saldos soma os movimentos (fundo = ${sal.corpo?.[0]?.saldo})`);

  await inserir('extrato', [
    { familia_id: FAM, descricao: 'Bônus de julho — ' + marca, valor: 60, transacao_sig: 'sig-' + N },
    { familia_id: FAM, descricao: 'Retirada pelo Pix ' + marca, valor: -20, transacao_sig: 'sig2-' + N },
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

/* =========================================================================
   Parte 2 — ida e volta do estado do app

   Aqui não se testa mais o esquema, e sim a sincronização: rodar ações no
   reducer, subir os deltas, baixar de volta e conferir que o estado reconstruído
   bate. É o que precisa estar verde antes de confiar o dado de uma família a
   isto.
   ========================================================================= */

if (!process.env.STORE_BUNDLE || !process.env.SYNC_BUNDLE) {
  console.log('\n(parte 2 pulada: rode via `npm test` para os módulos serem empacotados)');
} else {

  const { pathToFileURL } = await import('node:url');
  const store = await import(pathToFileURL(process.env.STORE_BUNDLE).href);
  const sinc = await import(pathToFileURL(process.env.SYNC_BUNDLE).href);
  // o proprio modulo de sincronizacao reexporta a nuvem, garantindo mesma instancia
  const nuvem = sinc;
  await sinc.configurar(cred);
  /* a mesma sessão de cima, injetada no módulo empacotado: é isto que faz
     `nuvem.ativo()` responder true e o token entrar nos cabeçalhos */
  sinc.auth._definirSessao(SESSAO);

  secao('8. Ida e volta: estado do app → nuvem → estado do app');
  /* faixa própria para não misturar com o piloto: ids deslocados */
  let s = store.estadoInicial();
  const desloca = st => ({
    ...st,
    nextId: N + 100,
    /* consentimento entra aqui porque sem ele NADA de família sobe — nem a
       família, nem condição, nem extrato. É a regra nova, e o round-trip
       precisa exercitá-la em vez de contorná-la. */
    familias: st.familias.map(f => ({ ...f, id: f.id + N, codigo: 'RT-' + (f.id + N),
      condicoes: f.condicoes.map(c => ({ ...c, id: c.id + N })),
      consentimentos: [{
        id: f.id + N + 500_000,
        versaoTermo: 'termo-teste-roundtrip',
        finalidades: ['[teste] ida e volta'],
        forma: 'presencial-assinado',
        termoHash: 'b'.repeat(64),
        coletadoPor: SESSAO.usuario.id,
        coletadoEm: new Date().toISOString(),
        revogadoEm: null,
      }] })),
    coletas: st.coletas.map(c => ({ ...c, id: c.id + N })),
    relatorios: st.relatorios.map(r => ({ ...r, id: r.id + N })),
    // rastreio e unique (duas pecas nao compartilham codigo): a faixa entra nele tambem
    vendas: st.vendas.map(v => ({ ...v, id: v.id + N, rastreio: v.rastreio ? `RT${N}-${v.id}` : null })),
    propostas: st.propostas.map(p => ({ ...p, id: p.id + N, familiaId: p.familiaId + N, condicaoId: p.condicaoId + N })),
    transacoes: st.transacoes.map(t => ({ ...t, seq: t.seq + N + 1000, signature: `rt${N}-${t.seq}` })),
  });
  s = desloca(s);

  const enviar = async (antes, depois) => {
    const ops = sinc.calcularDeltas(antes, depois);
    sinc.enfileirar(ops);
    const r = await sinc.escoarFila();
    return r;
  };

  /* estado inicial inteiro sobe */
  const r0 = await enviar(null, s);
  ok(r0.erro === null, `estado inicial subiu sem erro (${r0.enviadas} operações)${r0.erro ? ' — ' + r0.erro : ''}`);

  /* uma jornada: coleta → validação → venda → assinatura que executa */
  const antes1 = s;
  s = store.reducer(s, { type: 'NOVA_COLETA', payload: { coletor: 'Teste RT', material: 'Vidro', kg: 33, local: 'Cueira', data: '2026-07-26' } });
  const nova = s.coletas[s.coletas.length - 1];
  s = store.reducer(s, { type: 'VALIDAR_COLETA', id: nova.id });
  s = store.reducer(s, { type: 'NOVA_VENDA', payload: { tipo: 'esg', descricao: 'RT relatório', comprador: 'RT', valor: 2000 } });
  const pAberta = s.propostas.find(p => p.status === 'aguardando');
  s = store.reducer(s, { type: 'ASSINAR_PROPOSTA', propostaId: pAberta.id, signatario: 'detrash' });
  const r1 = await enviar(antes1, s);
  ok(r1.erro === null, `jornada subiu sem erro (${r1.enviadas} operações)${r1.erro ? ' — ' + r1.erro : ''}`);
  ok(sinc.tamanhoFila() === 0, 'fila esvaziou');

  /* baixa e compara */
  const remoto = await nuvem.carregar();
  /* filtra pelos ids EXATOS desta execução — `id > N` pegava famílias de
     execuções anteriores, cujo N era outro */
  const meusIds = new Set(s.familias.map(f => f.id));
  const famRemoto = remoto.familias.filter(f => meusIds.has(f.id));
  ok(famRemoto.length === s.familias.length, `famílias voltaram (${famRemoto.length}/${s.familias.length})`);

  const local1 = s.familias.find(f => f.id === pAberta.familiaId);
  const remoto1 = famRemoto.find(f => f.id === pAberta.familiaId);
  ok(Number(remoto1?.saldo) === Number(local1.saldo),
    `saldo da família bate: local ${local1.saldo} vs nuvem ${remoto1?.saldo}`);
  ok(remoto1?.resp === undefined, 'a nuvem não devolve nome (porque nunca recebeu)');
  ok(typeof remoto1?.codigo === 'string', `devolve o código pseudônimo (${remoto1?.codigo})`);

  const caixaLocal = Number(s.caixas.fundo.toFixed(2));
  const propRT = remoto.propostas.filter(p => p.id > N);
  const exec = propRT.find(p => p.id === pAberta.id);
  ok(exec?.status === 'executada', 'proposta voltou como executada');
  /* As assinaturas só sobem se o usuário desta sessão for signatário — a trava
     que faz o 2-de-3 valer (policy ass_assinar). Sem signatário no papel, elas
     ficam na fila de recusadas e a proposta volta com zero: comportamento
     correto, e é o que esta asserção mede em cada caso. */
  const nAss = (exec?.assinaturas || []).length;
  ok(SESSAO.papel?.signatario ? nAss >= 1 : nAss === 0,
    SESSAO.papel?.signatario
      ? `voltou com as assinaturas que este papel pode dar (${nAss})`
      : `sem signatário no papel, as assinaturas NÃO subiram (${nAss}) — a policy recusou, como deve`);

  /* assertiva precisa: toda signature local tem de existir na nuvem. Contar por
     prefixo não serve — as transações criadas pelo reducer recebem signature
     derivada do conteúdo, sem prefixo de teste. */
  const sigsRemoto = new Set(remoto.transacoes.map(t => t.signature));
  const faltando = s.transacoes.map(t => t.signature).filter(x => !sigsRemoto.has(x));
  ok(faltando.length === 0,
    `todas as ${s.transacoes.length} transações locais chegaram à nuvem${faltando.length ? ' — faltam ' + faltando.length : ''}`);
  const txRT = remoto.transacoes.filter(t => sigsRemoto.has(t.signature) && s.transacoes.some(l => l.signature === t.signature));
  ok(txRT.every(t => !/Maria de Lourdes|José Raimundo|Ana Cláudia/.test(t.desc)),
    'nenhuma descrição de transação na nuvem contém nome de família');
  ok(txRT.some(t => /RT-\d+/.test(t.desc)), 'as descrições usam o código pseudônimo');

  const colRT = remoto.coletas.filter(c => c.id > N);
  ok(colRT.find(c => c.id === nova.id)?.status === 'validada', 'coleta voltou validada');

  /* merge devolve o nome a partir do cadastro local */
  const mesclado = sinc.mesclar(s, remoto);
  const famMesclada = mesclado.familias.find(f => f.id === pAberta.familiaId);
  ok(famMesclada?.resp === local1.resp, `merge recupera o nome local (${famMesclada?.resp})`);
  ok(Number(famMesclada?.saldo) === Number(local1.saldo), 'e mantém o saldo vindo da nuvem');

  /* reenviar tudo de novo não deve mexer em nada (idempotência de ponta a ponta) */
  const saldoAntes = Number(remoto1?.saldo);
  sinc.enfileirar(sinc.calcularDeltas(antes1, s));
  const r2 = await sinc.escoarFila();
  const remoto2 = await nuvem.carregar();
  const saldoDepois = Number(remoto2.familias.find(f => f.id === pAberta.familiaId)?.saldo);
  ok(saldoDepois === saldoAntes,
    `reenviar a mesma jornada não altera saldo (${saldoAntes} → ${saldoDepois})${r2.erro ? ' · ' + r2.erro : ''}`);
  ok(Number(caixaLocal) >= 0, 'caixa local permanece consistente');
}

console.log('\n' + '─'.repeat(52));
console.log(falhas === 0
  ? `✅ ${total} garantias confirmadas no banco real`
  : `❌ ${falhas} de ${total} falharam`);
process.exit(falhas === 0 ? 0 : 1);
