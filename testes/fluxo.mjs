/* ---------------------------------------------------------------------------
   Fluxo completo do reducer, sem UI: coleta → validação → relatório → venda →
   split → comprovação → proposta → 2 assinaturas → liberação → saque, mais as
   duas variações da regra de reserva e a integridade da cadeia.

   Roda em segundos e não precisa de navegador — é a rede de segurança que
   pega regressão de regra de negócio.
--------------------------------------------------------------------------- */
import { pathToFileURL } from 'node:url';

/* o store tem JSX; o runner o empacota antes e informa o caminho aqui */
const caminho = process.env.STORE_BUNDLE ?? new URL('./.tmp/store.mjs', import.meta.url).pathname;
const {
  reducer, estadoInicial, disponivelCofre, fmt, trunc,
  BONUS_POR_CRIANCA, SIGNATARIOS, SPLIT, REDE, PROVIDER_CARTEIRA,
} = await import(pathToFileURL(caminho).href);

let falhas = 0, total = 0;
const ok = (cond, msg) => {
  total++;
  if (cond) console.log('  ✓ ' + msg);
  else { falhas++; console.log('  ✗ FALHOU: ' + msg); }
};
const secao = t => console.log('\n' + t);
const d = (s, a) => reducer(s, a);
const perto = (a, b) => Math.abs(a - b) < 0.01;

/* ---------- 1. seed ---------- */
secao('1. Estado inicial (seed)');
let s = estadoInicial();
const LIMIAR = s.cofre.limiar;

ok(LIMIAR === 2 && s.cofre.signatarios !== undefined || LIMIAR === 2, 'cofre com limiar 2');
ok(SIGNATARIOS.map(x => x.nome).join('|') === 'Instituto Vivá|DeTrash|Representante Comunitário',
  'signatários: Instituto Vivá, DeTrash, Representante Comunitário');
ok(SIGNATARIOS.every(x => x.endereco && x.endereco.length === 44), 'cada signatário tem endereço base58 de 44 chars');
ok(s.cofre.endereco.length === 44 && s.cofre.programa.length === 44, 'cofre e programa multisig com endereços de 44 chars');
ok(s.transacoes.length > 5, `${s.transacoes.length} transações na seed`);
ok(s.transacoes.every(t => t.signature.length === 88), 'toda signature tem 88 chars');
ok(!/^0x/.test(s.transacoes[0].signature), 'signature não usa o formato 0x-hex antigo');
ok(/^[1-9A-HJ-NP-Za-km-z]+$/.test(s.transacoes[0].signature), 'signature usa só o alfabeto base58');
ok(s.familias.every(f => !f.carteira || f.carteira.end.length === 44), 'endereços de carteira com 44 chars');
ok(s.familias.every(f => !f.carteira || f.carteira.provider === PROVIDER_CARTEIRA), `carteiras marcadas como ${PROVIDER_CARTEIRA}`);
ok(s.familias.every(f => !f.carteira || f.carteira.rede === REDE), `carteiras na rede ${REDE}`);
ok(trunc(s.cofre.endereco, 4, 4).includes('…'), 'trunc encurta para exibição');

// slots: estritamente crescentes (a rede real avança de forma irregular)
let slotsOk = true;
for (let i = 1; i < s.transacoes.length; i++) {
  if (s.transacoes[i].slot <= s.transacoes[i - 1].slot) slotsOk = false;
}
ok(slotsOk, 'slot é incremental (estritamente crescente) a cada registro');

// cadeia encadeada
let cadeiaOk = true;
for (let i = 1; i < s.transacoes.length; i++) {
  if (s.transacoes[i].prevSignature !== s.transacoes[i - 1].signature) cadeiaOk = false;
}
ok(cadeiaOk, 'cada tx aponta para a signature da anterior');
ok(new Set(s.transacoes.map(t => t.signature)).size === s.transacoes.length, 'nenhuma signature repetida');

const aguardando = s.propostas.filter(p => p.status === 'aguardando');
ok(aguardando.length === 1 && aguardando[0].assinaturas.length === 1,
  'seed traz 1 proposta multisig com 1 assinatura já coletada');
ok(s.propostas.some(p => p.status === 'reservada'), 'seed traz um bônus reservado (família sem conta)');

const receitaSeed = s.vendas.reduce((a, v) => a + v.valor, 0);
ok(perto(s.caixas.renda, receitaSeed * SPLIT.renda), `60% da receita em renda direta (${fmt(s.caixas.renda)})`);
ok(perto(s.caixas.fundo + s.caixas.fundoLiberado, receitaSeed * SPLIT.fundo), '25% da receita no Fundo Infância');
ok(perto(s.caixas.operacao, receitaSeed * SPLIT.operacao), '15% da receita na operação');
ok(perto(disponivelCofre(s), s.caixas.fundo - aguardando[0].valor),
  'disponivelCofre desconta o comprometido em propostas pendentes');

/* ---------- 2. coleta → validação → relatório ---------- */
secao('2. Coleta → validação → relatório');
const nTx = s.transacoes.length;
s = d(s, { type: 'NOVA_COLETA', payload: { coletor: 'Dona Nilza', material: 'Vidro', kg: 52, local: 'Cueira', data: '2026-07-26' } });
ok(s.coletas.length === 4, 'coleta registrada');
ok(s.transacoes.length === nTx, 'coleta ainda não gera transação (só após validação)');

const nova = s.coletas[s.coletas.length - 1];
s = d(s, { type: 'VALIDAR_COLETA', id: nova.id });
const cVal = s.coletas.find(c => c.id === nova.id);
ok(cVal.status === 'validada' && cVal.signature?.length === 88, 'coleta validada recebe signature');
ok(s.transacoes[s.transacoes.length - 1].tipo === 'VALIDAÇÃO', 'tx tipo VALIDAÇÃO');

s = d(s, { type: 'EMITIR_RELATORIO', periodo: 'Julho 2026 — quinzena 2' });
const rel = s.relatorios[s.relatorios.length - 1];
const kgValidados = s.coletas.filter(c => c.status === 'validada').reduce((a, c) => a + Number(c.kg), 0);
ok(rel.kg === kgValidados, `relatório soma só as validadas (${rel.kg} kg)`);
ok(rel.signature?.length === 88, 'relatório recebe signature');

/* ---------- 3. venda e split ---------- */
secao('3. Venda com split 60/25/15');
const antes = { ...s.caixas };
s = d(s, { type: 'NOVA_VENDA', payload: { tipo: 'esg', descricao: 'Relatório Q2', comprador: 'Costa Verde', valor: 2500 } });
ok(perto(s.caixas.renda, antes.renda + 1500), '60% → renda direta (R$ 1.500)');
ok(perto(s.caixas.fundo, antes.fundo + 625), '25% → cofre (R$ 625)');
ok(perto(s.caixas.operacao, antes.operacao + 375), '15% → operação (R$ 375)');
ok(s.transacoes[s.transacoes.length - 1].tipo === 'RECEITA', 'tx tipo RECEITA');

/* ---------- 4. fluxo multisig completo ---------- */
secao('4. Fluxo multisig completo (Maria de Lourdes, condição pendente)');
const maria = s.familias[0];
const condPend = maria.condicoes.find(c => c.status === 'pendente');
ok(Boolean(condPend), `condição pendente encontrada: ${condPend?.tipo}`);

s = d(s, { type: 'ENVIAR_COMPROVACAO', familiaId: maria.id, condicaoId: condPend.id });
ok(s.familias[0].condicoes.find(c => c.id === condPend.id).status === 'comprovada', 'comprovação enviada → comprovada');

const nProp = s.propostas.length;
s = d(s, { type: 'VALIDAR_CONDICAO', familiaId: maria.id, condicaoId: condPend.id });
ok(s.propostas.length === nProp + 1, 'validação cria proposta');
ok(s.familias[0].condicoes.find(c => c.id === condPend.id).status === 'aguardando-assinaturas',
  'condição → aguardando-assinaturas');
const p = s.propostas[s.propostas.length - 1];
ok(p.valor === BONUS_POR_CRIANCA * 2, `proposta de ${fmt(BONUS_POR_CRIANCA * 2)} (2 crianças)`);
ok(p.assinaturas.length === 0, 'proposta nasce sem assinaturas');
ok(s.transacoes[s.transacoes.length - 1].tipo === 'PROPOSTA', 'tx tipo PROPOSTA');

const saldoAntes = s.familias[0].saldo;
const cofreAntes = s.caixas.fundo;

s = d(s, { type: 'ASSINAR_PROPOSTA', propostaId: p.id, signatario: 'viva' });
ok(s.propostas.find(x => x.id === p.id).assinaturas.length === 1, '1ª assinatura registrada');
ok(s.propostas.find(x => x.id === p.id).status === 'aguardando', '1ª assinatura não executa');
ok(s.familias[0].saldo === saldoAntes, 'saldo inalterado com 1/2');
ok(s.transacoes[s.transacoes.length - 1].tipo === 'ASSINATURA', 'tx tipo ASSINATURA');

const nDup = s.transacoes.length;
s = d(s, { type: 'ASSINAR_PROPOSTA', propostaId: p.id, signatario: 'viva' });
ok(s.transacoes.length === nDup && s.propostas.find(x => x.id === p.id).assinaturas.length === 1,
  'assinatura duplicada do mesmo signatário é rejeitada');

s = d(s, { type: 'ASSINAR_PROPOSTA', propostaId: p.id, signatario: 'detrash' });
const pExec = s.propostas.find(x => x.id === p.id);
ok(pExec.status === 'executada', '2ª assinatura executa a proposta');
ok(s.familias[0].condicoes.find(c => c.id === condPend.id).status === 'liberada', 'condição → liberada');
ok(s.familias[0].saldo === saldoAntes + 60, `saldo da família +${fmt(60)}`);
ok(perto(s.caixas.fundo, cofreAntes - 60), 'cofre debitado');
ok(s.transacoes[s.transacoes.length - 1].tipo === 'LIBERAÇÃO', 'tx tipo LIBERAÇÃO');
ok(pExec.signature?.length === 88, 'proposta executada guarda a signature da transferência');

const ext = s.familias[0].extrato[s.familias[0].extrato.length - 1];
ok(/^Bônus de \w+ — /.test(ext.desc) && !/on-chain|token|hash|blockchain|multisig|Fundo Infância/i.test(ext.desc),
  `extrato em linguagem simples: "${ext.desc}"`);

/* ---------- 5. proposta da seed ---------- */
secao('5. Proposta da seed (1 assinatura → a 2ª executa)');
const pSeed = s.propostas.find(x => x.status === 'aguardando' && x.assinaturas.length === 1);
const famSeed = s.familias.find(f => f.id === pSeed.familiaId);
s = d(s, { type: 'ASSINAR_PROPOSTA', propostaId: pSeed.id, signatario: 'comunidade' });
ok(s.propostas.find(x => x.id === pSeed.id).status === 'executada', 'executa com a 2ª assinatura');
ok(s.familias.find(f => f.id === famSeed.id).saldo === pSeed.valor,
  `${famSeed.resp} recebeu ${fmt(pSeed.valor)} (${famSeed.criancas} crianças)`);

/* ---------- 6. reserva por falta de conta ---------- */
secao('6. Regra de reserva — família sem conta (Ana Cláudia)');
const ana = s.familias.find(f => !f.carteira);
ok(Boolean(ana), 'existe família sem conta na seed');
const pAna = s.propostas.find(x => x.familiaId === ana.id && x.status === 'reservada');
ok(Boolean(pAna), 'proposta dela está reservada, não perdida');
ok(ana.condicoes[0].status === 'validada-aguardando', 'condição fica em "validada-aguardando"');
ok(ana.saldo === 0, 'sem conta, nada é creditado');
ok(s.transacoes.some(t => t.tipo === 'RESERVA'), 'existe transação tipo RESERVA');

/* ---------- 7. criar conta reprocessa a reserva ---------- */
secao('7. Conectar conta reabre a proposta reservada (retroativo)');
s = d(s, { type: 'CRIAR_CARTEIRA', id: ana.id, provider: 'Picnic', celular: '(75) 99999-0000' });
const ana2 = s.familias.find(f => f.id === ana.id);
ok(ana2.carteira?.end.length === 44, 'endereço de 44 chars gerado');
ok(ana2.carteira.provider === 'Picnic' && ana2.carteira.rede === REDE, `provider Picnic, rede ${REDE}`);
ok(s.transacoes.some(t => t.tipo === 'CARTEIRA'), 'gerou transação tipo CARTEIRA');
const pAna2 = s.propostas.find(x => x.id === pAna.id);
ok(pAna2.status === 'aguardando', 'proposta reservada volta a aguardar assinaturas');
ok(ana2.condicoes[0].status === 'aguardando-assinaturas', 'condição volta a aguardar assinaturas');

s = d(s, { type: 'ASSINAR_PROPOSTA', propostaId: pAna2.id, signatario: 'viva' });
s = d(s, { type: 'ASSINAR_PROPOSTA', propostaId: pAna2.id, signatario: 'comunidade' });
ok(s.familias.find(f => f.id === ana.id).saldo === BONUS_POR_CRIANCA * ana.criancas,
  `Ana Cláudia recebe ${fmt(BONUS_POR_CRIANCA * ana.criancas)} após as 2 assinaturas`);

/* ---------- 8. reserva por falta de saldo ---------- */
secao('8. Regra de reserva — cofre sem saldo livre');
let s2 = estadoInicial();
s2.caixas.fundo = 10;
const m2 = s2.familias[0];
const c2 = m2.condicoes.find(c => c.status === 'pendente');
s2 = d(s2, { type: 'ENVIAR_COMPROVACAO', familiaId: m2.id, condicaoId: c2.id });
const saldoPre2 = s2.familias[0].saldo;
s2 = d(s2, { type: 'VALIDAR_CONDICAO', familiaId: m2.id, condicaoId: c2.id });
ok(s2.familias[0].condicoes.find(c => c.id === c2.id).status === 'validada-aguardando', 'sem saldo livre → reservado');
ok(s2.familias[0].saldo === saldoPre2, 'nada creditado além do que já havia');
ok(s2.propostas.some(x => x.condicaoId === c2.id && x.status === 'reservada'), 'proposta criada como reservada');

/* ---------- 9. salvaguarda na execução ---------- */
secao('9. Salvaguarda: limiar atingido sem saldo volta a reservado');
let s3 = estadoInicial();
const p3 = s3.propostas.find(x => x.status === 'aguardando');
s3.caixas.fundo = 1; // cofre drenado depois da proposta ter sido criada
s3 = d(s3, { type: 'ASSINAR_PROPOSTA', propostaId: p3.id, signatario: 'detrash' });
const p3f = s3.propostas.find(x => x.id === p3.id);
ok(p3f.assinaturas.length === 2, 'as 2 assinaturas ficam registradas');
ok(p3f.status === 'reservada', 'proposta não fica presa em "aguardando": volta a reservada');
ok(s3.familias.find(f => f.id === p3.familiaId).saldo === 0, 'nada é creditado sem saldo');
ok(s3.caixas.fundo === 1, 'cofre não fica negativo');
ok(s3.transacoes[s3.transacoes.length - 1].tipo === 'RESERVA', 'registra RESERVA em vez de LIBERAÇÃO');

/* ---------- 10. saque Pix ---------- */
secao('10. Saque via Pix');
const saldoPre = s.familias[0].saldo;
s = d(s, { type: 'SACAR_PIX', id: 1, valor: 50 });
ok(s.familias[0].saldo === saldoPre - 50, 'saque parcial debita o valor');
ok(s.transacoes[s.transacoes.length - 1].tipo === 'SAQUE', 'tx tipo SAQUE');
ok(s.familias[0].extrato[s.familias[0].extrato.length - 1].desc === 'Retirada pelo Pix',
  'extrato do saque em linguagem simples');
s = d(s, { type: 'SACAR_PIX', id: 1, valor: 99999 });
ok(s.familias[0].saldo === 0, 'saque acima do saldo é limitado ao saldo');
const nZero = s.transacoes.length;
s = d(s, { type: 'SACAR_PIX', id: 1, valor: 100 });
ok(s.transacoes.length === nZero, 'saque com saldo zero não gera transação');

/* ---------- 11. reset ---------- */
secao('11. Resetar demo');
const sr = d(s, { type: 'RESET' });
const agR = sr.propostas.filter(x => x.status === 'aguardando');
ok(agR.length === 1 && agR[0].assinaturas.length === 1, 'reset traz a proposta de exemplo com 1 assinatura');
ok(sr.familias.some(f => !f.carteira), 'reset devolve a família sem conta');
ok(typeof sr.slot === 'number' && sr.cofre && Array.isArray(sr.transacoes) && Array.isArray(sr.propostas),
  'reset traz todos os campos novos do estado');

/* ---------- 12. integridade final ---------- */
secao('12. Integridade final da cadeia');
let integro = true, cresce = true;
for (let i = 1; i < s.transacoes.length; i++) {
  if (s.transacoes[i].prevSignature !== s.transacoes[i - 1].signature) integro = false;
  if (s.transacoes[i].slot <= s.transacoes[i - 1].slot) cresce = false;
}
ok(integro, `cadeia íntegra em ${s.transacoes.length} transações`);
ok(cresce, 'slots sempre crescentes');
ok(new Set(s.transacoes.map(t => t.signature)).size === s.transacoes.length, 'nenhuma signature repetida');
const tipos = [...new Set(s.transacoes.map(t => t.tipo))];
ok(['RECEITA', 'VALIDAÇÃO', 'PROPOSTA', 'ASSINATURA', 'LIBERAÇÃO', 'RESERVA', 'CARTEIRA', 'SAQUE']
  .every(t => tipos.includes(t)), `todos os 8 tipos exercitados (${tipos.length} tipos vistos)`);
ok(s.transacoes.every(t => t.taxa > 0 && t.taxa < 0.001), 'toda tx tem taxa em SOL (fração de centavo)');

/* ---------- 13. deltas de sincronização ---------- */
secao('13. Deltas de sincronização (o que sobe para a nuvem)');
const { calcularDeltas, mesclar, nuvemDifere } = await import(
  pathToFileURL(process.env.SYNC_BUNDLE ?? new URL('./.tmp/sinc.mjs', import.meta.url).pathname).href);

const base = estadoInicial();
const tiposDe = ops => ops.map(o => o.tipo);

/* venda: entra receita e o split precisa virar 3 movimentos, não 1 saldo */
const comVenda = d(base, { type: 'NOVA_VENDA', payload: { tipo: 'esg', descricao: 'Rel Q2', comprador: 'X', valor: 2500 } });
const opsVenda = calcularDeltas(base, comVenda);
ok(tiposDe(opsVenda).includes('transacao'), 'venda gera operação de transação');
ok(tiposDe(opsVenda).includes('venda'), 'venda gera operação de venda');
const movs = opsVenda.filter(o => o.tipo === 'movimento');
ok(movs.length === 3, `split vira 3 movimentos, um por caixa (${movs.length})`);
ok(movs.every(m => m.transacaoSig != null), 'todo movimento referencia a signature da transação (idempotência)');
const somaMov = movs.reduce((a, m) => a + m.valor, 0);
ok(Math.abs(somaMov - 2500) < 0.01, `movimentos somam o valor da venda (${somaMov})`);
ok(movs.find(m => m.caixa === 'fundo').valor === 625, 'delta do fundo é 625 (25% de 2500), não o saldo total');
ok(opsVenda[0].tipo === 'transacao', 'transação vem primeiro: movimento referencia ela');

/* assinatura é linha, e a segunda executa e mexe em dinheiro */
const p0 = comVenda.propostas.find(p => p.status === 'aguardando');
const s1 = d(comVenda, { type: 'ASSINAR_PROPOSTA', propostaId: p0.id, signatario: 'detrash' });
const opsAss = calcularDeltas(comVenda, s1);
const assinaturas = opsAss.filter(o => o.tipo === 'assinatura');
ok(assinaturas.length === 1 && assinaturas[0].signatario === 'detrash', 'só a assinatura nova sobe');
ok(opsAss.some(o => o.tipo === 'extrato' && o.valor === p0.valor), 'liberação gera linha de extrato com o valor do bônus');
ok(opsAss.filter(o => o.tipo === 'movimento').length === 2, 'liberação move fundo e fundo_liberado');
ok(opsAss.some(o => o.tipo === 'proposta-atualiza' && o.status === 'executada'), 'proposta muda de status');
ok(opsAss.every(o => o.tipo !== 'extrato' || o.transacaoSig != null), 'todo extrato referencia a signature da transação');

/* nada mudou → nada sobe */
ok(calcularDeltas(s1, s1).length === 0, 'estado igual não gera operação nenhuma');

/* LGPD: o nome da família não pode sair daqui */
const semConta = base.familias.find(f => !f.carteira);
const comConta = d(base, { type: 'CRIAR_CARTEIRA', id: semConta.id, provider: 'Picnic' });
const opsFam = calcularDeltas(base, comConta);
const opFamilia = opsFam.find(o => o.tipo === 'familia');
ok(Boolean(opFamilia), 'criar conta gera operação de família');
ok(!('resp' in opFamilia.familia), 'a operação NÃO carrega o nome da pessoa');
ok(typeof opFamilia.familia.codigo === 'string' && opFamilia.familia.codigo.length > 0, 'carrega código pseudônimo');
const serializado = JSON.stringify(opsFam);
ok(!/Maria de Lourdes|José Raimundo|Ana Cláudia/.test(serializado),
  'nenhum nome de família aparece no que sobe');

/* merge: dado vem da nuvem, nome vem do cadastro local */
const remoto = {
  ...base,
  familias: base.familias.map(f => ({ id: f.id, codigo: 'BOI-00' + f.id, criancas: f.criancas, carteira: f.carteira, saldo: 7, condicoes: f.condicoes, extrato: [] })),
  transacoes: [...base.transacoes, { ...base.transacoes[0], seq: 999, slot: 99999, signature: 'outra' }],
};
const mesclado = mesclar(base, remoto);
ok(mesclado.familias[0].resp === base.familias[0].resp, 'merge recupera o nome do cadastro local');
ok(mesclado.familias[0].saldo === 7, 'merge usa o saldo que veio da nuvem');
ok(nuvemDifere(base, remoto) === true, 'detecta que a nuvem difere do local');
ok(nuvemDifere(base, base) === false, 'e que estados iguais não disparam merge');

console.log(`\n${'='.repeat(52)}`);
console.log(falhas === 0 ? `✅ ${total} verificações, todas passaram` : `❌ ${falhas} de ${total} falharam`);
process.exit(falhas === 0 ? 0 : 1);
