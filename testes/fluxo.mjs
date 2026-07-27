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
/* `store` inteiro além dos nomes soltos: as seções de PIN e retenção usam uma
   dúzia de helpers, e listar todos na desestruturação só cria ruído. */
const store = await import(pathToFileURL(caminho).href);
const {
  reducer, estadoInicial, disponivelCofre, fmt, trunc,
  BONUS_POR_CRIANCA, SIGNATARIOS, SPLIT, REDE, PROVIDER_CARTEIRA,
} = store;

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
/* a RECEITA vem seguida dos creditos de RENDA para quem coletou o material —
   por isso ela nao e mais a ULTIMA transacao, e a ordem importa: primeiro entra
   o dinheiro, depois ele e distribuido */
const ultimas = s.transacoes.slice(-4).map(t => t.tipo);
ok(ultimas.includes('RECEITA'), 'tx tipo RECEITA registrada');
ok(ultimas.indexOf('RECEITA') < ultimas.lastIndexOf('RENDA'), 'e os creditos de RENDA vem depois dela');

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
/* A distincao que o projeto defende, agora testada: sem conta o BONUS fica
   reservado, mas a RENDA do trabalho dela continua sendo dela — ela e
   incondicional, e tratar as duas do mesmo jeito era o erro antigo. */
const bonusAna = ana.extrato.filter(e => e.tipo !== 'renda' && e.valor > 0).reduce((a, e) => a + e.valor, 0);
const rendaAna = ana.extrato.filter(e => e.tipo === 'renda').reduce((a, e) => a + e.valor, 0);
ok(bonusAna === 0, 'sem conta, o BONUS nao e creditado — fica reservado');
ok(rendaAna > 0, 'mas a renda do trabalho dela e registrada de todo jeito (incondicional)');
ok(perto(ana.saldo, rendaAna), 'e o saldo dela e exatamente essa renda');
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
ok(perto(s.familias.find(f => f.id === ana.id).saldo, rendaAna + BONUS_POR_CRIANCA * ana.criancas),
  `Ana Cláudia recebe ${fmt(BONUS_POR_CRIANCA * ana.criancas)} de bônus após as 2 assinaturas, somado à renda dela`);

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
const { calcularDeltas, mesclar, nuvemDifere, remotoUtilizavel } = await import(
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
/* o extrato é dado ligado à família, então também depende de consentimento */
const comConsent = d(comVenda, {
  type: 'REGISTRAR_CONSENTIMENTO', familiaId: p0.familiaId,
  forma: 'presencial-verbal', termoHash: 'e'.repeat(64),
});
const s1 = d(comConsent, { type: 'ASSINAR_PROPOSTA', propostaId: p0.id, signatario: 'detrash' });
const opsAss = calcularDeltas(comConsent, s1);
const assinaturas = opsAss.filter(o => o.tipo === 'assinatura');
ok(assinaturas.length === 1 && assinaturas[0].signatario === 'detrash', 'só a assinatura nova sobe');
ok(opsAss.some(o => o.tipo === 'extrato' && o.valor === p0.valor), 'liberação gera linha de extrato com o valor do bônus');
ok(opsAss.filter(o => o.tipo === 'movimento').length === 2, 'liberação move fundo e fundo_liberado');
ok(opsAss.some(o => o.tipo === 'proposta-atualiza' && o.status === 'executada'), 'proposta muda de status');
ok(opsAss.every(o => o.tipo !== 'extrato' || o.transacaoSig != null), 'todo extrato referencia a signature da transação');

/* nada mudou → nada sobe */
ok(calcularDeltas(s1, s1).length === 0, 'estado igual não gera operação nenhuma');

/* LGPD: consentimento é PRÉ-REQUISITO. Sem ele, nada da família sobe — nem
   condição, nem extrato, nem a própria família. A policy do banco recusa, e a
   fila é FIFO: se deixássemos entrar, uma família sem consentimento travaria
   todo o trabalho atrás dela. */
const semConta = base.familias.find(f => !f.carteira);
const semConsent = d(base, { type: 'CRIAR_CARTEIRA', id: semConta.id, provider: 'Picnic' });
const opsSemConsent = calcularDeltas(base, semConsent);
ok(!opsSemConsent.some(o => o.tipo === 'familia'),
  'família SEM consentimento não gera operação de família');
ok(!opsSemConsent.some(o => ['condicao', 'extrato'].includes(o.tipo)),
  'e nem condição nem extrato dela sobem');

const consentida = d(base, {
  type: 'REGISTRAR_CONSENTIMENTO', familiaId: semConta.id,
  forma: 'presencial-assinado', termoHash: 'f'.repeat(64),
});
const opsConsent = calcularDeltas(base, consentida);
const opCons = opsConsent.find(o => o.tipo === 'consentimento');
ok(Boolean(opCons), 'registrar consentimento gera a operação de consentimento');
ok(opCons.consentimento.termoHash.length === 64, 'com o hash do termo apresentado');
ok(!('resp' in opCons.consentimento), 'e sem o nome da pessoa');

const comConta = d(consentida, { type: 'CRIAR_CARTEIRA', id: semConta.id, provider: 'Picnic' });
const opsFam = calcularDeltas(consentida, comConta);
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

/* ==========================================================================
   14. PIN da família — verificado de verdade, e nunca sai do aparelho
   ========================================================================== */
secao('14. PIN da família');

const salA = store.novoSal();
const salB = store.novoSal();
ok(salA.length === 32 && /^[0-9a-f]+$/.test(salA), `sal é hex de 16 bytes (${salA.length} chars)`);
ok(salA !== salB, 'cada família recebe um sal diferente');

const h1234 = await store.hashPin('1234', salA);
const h9999 = await store.hashPin('9999', salA);
/* Este é O teste que importa: a primeira versão chamava o `hex(str)` errado, que
   recebia um ArrayBuffer e devolvia o hash de "[object ArrayBuffer]" — o MESMO
   valor para qualquer PIN. O build compilava, a tela funcionava, e qualquer PIN
   abriria qualquer conta. */
ok(h1234.length === 64 && /^[0-9a-f]{64}$/.test(h1234), `hash é SHA-256 em hex (${h1234.length} chars)`);
ok(h1234 !== h9999, 'PINs diferentes geram hashes diferentes');
ok(h1234 !== await store.hashPin('1234', salB), 'o mesmo PIN com sal diferente gera hash diferente');

const semPin = base.familias[0];
ok(store.temPin(semPin) === false, 'família da seed começa SEM PIN (define no primeiro acesso)');
ok(await store.conferirPin(semPin, '1234') === false, 'sem PIN definido, nenhum PIN é aceito');

const comPin = d(base, { type: 'DEFINIR_PIN', familiaId: semPin.id, hash: h1234, sal: salA });
const fPin = comPin.familias.find(f => f.id === semPin.id);
ok(store.temPin(fPin), 'DEFINIR_PIN registra o PIN');
ok(await store.conferirPin(fPin, '1234') === true, 'o PIN certo é aceito');
ok(await store.conferirPin(fPin, '4321') === false, 'o PIN errado é recusado');
ok(!('pin' in fPin) || fPin.pin.hash !== '1234', 'o PIN em claro nunca é guardado');

/* bloqueio por tentativa */
let sBloq = comPin;
for (let i = 0; i < store.MAX_TENTATIVAS_PIN; i++) {
  sBloq = d(sBloq, { type: 'PIN_ERRADO', familiaId: semPin.id });
}
const fBloq = sBloq.familias.find(f => f.id === semPin.id);
ok(fBloq.pin.bloqueado === true, `bloqueia após ${store.MAX_TENTATIVAS_PIN} tentativas erradas`);
const sOk = d(sBloq, { type: 'PIN_CERTO', familiaId: semPin.id });
ok(sOk.familias.find(f => f.id === semPin.id).pin.tentativas === 0, 'PIN certo zera o contador');

const sDestravado = d(sBloq, { type: 'DESTRAVAR_PIN', familiaId: semPin.id });
const fDest = sDestravado.familias.find(f => f.id === semPin.id);
ok(fDest.pin === null, 'o agente destrava apagando o PIN (a família escolhe outro)');
ok(sDestravado.transacoes.length > sBloq.transacoes.length, 'destravar deixa registro no histórico');

/* LGPD: o PIN NÃO PODE subir para a nuvem, em nenhuma operação */
const opsPin = calcularDeltas(base, comPin);
const serialPin = JSON.stringify(opsPin);
ok(!/"pin"/.test(serialPin) && !serialPin.includes(h1234) && !serialPin.includes(salA),
  'nenhuma operação de sincronização carrega o PIN, o hash ou o sal');

/* e o pull da nuvem não pode APAGAR o PIN nem os consentimentos locais */
const remotoSemPin = {
  ...comPin,
  familias: comPin.familias.map(f => ({ id: f.id, codigo: 'BOI-' + f.id, criancas: f.criancas, carteira: f.carteira, saldo: 0, condicoes: f.condicoes, extrato: [] })),
};
const depoisPull = mesclar(comPin, remotoSemPin);
ok(store.temPin(depoisPull.familias.find(f => f.id === semPin.id)),
  'o merge da nuvem NÃO apaga o PIN guardado no aparelho');

/* ==========================================================================
   15. Retenção — prazo, vencimento e renovação
   ========================================================================== */
secao('15. Retenção do consentimento');

const fam0 = base.familias[0].id;
const comCons = d(base, { type: 'REGISTRAR_CONSENTIMENTO', familiaId: fam0, termoHash: 'a'.repeat(64) });
const cons = comCons.familias.find(f => f.id === fam0).consentimentos[0];
ok(cons.validadeMeses === store.VALIDADE_MESES, `consentimento nasce com prazo de ${store.VALIDADE_MESES} meses`);
ok(store.situacaoConsentimento(cons) === 'vigente', 'e nasce vigente');

const agora = Date.now();
const dia = 86_400_000;
const venc = store.venceEm(cons).getTime();
ok(venc > agora, 'vence no futuro');
ok(store.situacaoConsentimento(cons, venc + dia) === 'vencido', 'depois do prazo, fica vencido');
ok(store.situacaoConsentimento(cons, venc - 30 * dia) === 'vencendo', '30 dias antes, avisa que está vencendo');

/* vencido = não autoriza mais. É o ponto todo do prazo. */
const famVencida = { ...base.familias[0], consentimentos: [{ ...cons, coletadoEm: new Date(agora - 800 * dia).toISOString() }] };
ok(store.consentimentoAtivo(famVencida) === null, 'consentimento vencido NÃO autoriza mais nada');
ok(calcularDeltas(base, { ...base, familias: [famVencida, ...base.familias.slice(1)] })
  .every(o => o.tipo !== 'familia'), 'e por isso a família vencida não sobe para a nuvem');

/* renovar cria registro novo apontando para o anterior, sem alterar o antigo */
const estadoVencido = { ...comCons, familias: comCons.familias.map(f => f.id === fam0 ? famVencida : f) };
const renovado = d(estadoVencido, { type: 'REGISTRAR_CONSENTIMENTO', familiaId: fam0, termoHash: 'b'.repeat(64) });
const lista = renovado.familias.find(f => f.id === fam0).consentimentos;
ok(lista.length === 2, 'renovar não substitui: cria um segundo registro');
ok(lista[1].renovadoDe === lista[0].id, 'o novo aponta para o anterior (histórico auditável)');
ok(lista[0].coletadoEm !== lista[1].coletadoEm, 'e o registro antigo não foi alterado');
ok(store.consentimentoAtivo(renovado.familias.find(f => f.id === fam0)) !== null, 'a renovação volta a autorizar');

/* revogar continua funcionando junto com o prazo */
const revog = d(comCons, { type: 'REVOGAR_CONSENTIMENTO', familiaId: fam0, motivo: 'pedido da família' });
const cRev = revog.familias.find(f => f.id === fam0).consentimentos[0];
ok(store.situacaoConsentimento(cRev) === 'revogado', 'revogação se sobrepõe ao prazo');
ok(store.consentimentoAtivo(revog.familias.find(f => f.id === fam0)) === null, 'e revogado não autoriza');

/* ==========================================================================
   22. O circuito da contestação fecha entre APARELHOS
   ========================================================================== */
secao('22. Contestação entre aparelhos (merge da nuvem)');

const localCt = estadoInicial();
const ctLocal = {
  id: 111, familiaId: localCt.familias[0].id, tipo: 'coleta', alvoId: 1,
  motivo: 'O peso está errado', detalhe: '', criadoEm: '2026-07-27T10:00:00.000Z',
  status: 'aberta', resposta: null, respondidoEm: null, chaveLeitura: 'a'.repeat(32),
};
const ctSoLocal = {
  ...ctLocal, id: 222, criadoEm: '2026-07-27T11:00:00.000Z', chaveLeitura: 'b'.repeat(32),
};
const comDuas = { ...localCt, contestacoes: [ctLocal, ctSoLocal] };

/* a nuvem trouxe a MESMA contestação, já respondida pela operação — e não
   conhece a segunda, que este aparelho abriu offline */
const daNuvem = {
  ...localCt,
  contestacoes: [{
    ...ctLocal, resposta: 'Conferimos e corrigimos.', status: 'resolvida',
    respondidoEm: '2026-07-27T12:00:00.000Z', chaveLeitura: undefined,
  }],
};

const juntou = mesclar(comDuas, daNuvem);
ok(juntou.contestacoes.length === 2, 'o merge une as duas: a da nuvem e a que só existe aqui');
const j1 = juntou.contestacoes.find(c => c.id === 111);
const j2 = juntou.contestacoes.find(c => c.id === 222);
ok(j1.resposta === 'Conferimos e corrigimos.' && j1.status === 'resolvida',
  'a nuvem manda no status e na resposta (é onde a operação respondeu)');
ok(j1.chaveLeitura === 'a'.repeat(32),
  'mas o SEGREDO fica com o aparelho — ele não volta da nuvem');
ok(Boolean(j2), 'e a contestação aberta offline NÃO é apagada pelo merge');
ok(j2.chaveLeitura === 'b'.repeat(32), 'com o segredo dela preservado');

/* ==========================================================================
   21. A família pode conferir e CONTESTAR o que foi registrado sobre ela
   ========================================================================== */
secao('21. Contestação: a família discorda de um registro');

const b21 = estadoInicial();
ok(Array.isArray(b21.contestacoes) && b21.contestacoes.length === 0, 'estado nasce sem contestações');

/* a família só pode conferir o que está no nome dela — isso é o pré-requisito
   do item: sem coleta vinculada, ela não tem o que auditar */
const minhas21 = b21.coletas.filter(c => c.familiaId === b21.familias[0].id);
ok(minhas21.length >= 1, `a família tem entrega no nome dela para conferir (${minhas21.length})`);

const alvo21 = minhas21[0];
const contestado = d(b21, {
  type: 'ABRIR_CONTESTACAO', familiaId: b21.familias[0].id, tipo: 'coleta',
  alvoId: alvo21.id, alvoDesc: `${alvo21.kg} kg`, motivo: 'O peso está errado',
  detalhe: 'entreguei mais que isso',
});
ok(contestado.contestacoes.length === 1, 'a família abre a contestação');
const ct = contestado.contestacoes[0];
ok(ct.status === 'aberta' && ct.resposta === null, 'ela nasce aberta e sem resposta');
ok(ct.alvoId === alvo21.id, 'ligada ao registro exato que ela contesta');
ok(contestado.transacoes.some(t => t.tipo === 'CONTESTACAO'), 'e entra no registro auditável');

/* LGPD: a transação pública não pode carregar o nome da pessoa */
const txCt = contestado.transacoes.filter(t => t.tipo === 'CONTESTACAO').pop();
ok(!/Maria de Lourdes|José Raimundo|Ana Cláudia/.test(txCt.desc),
  'a transação usa o código da família, não o nome');

/* reclamar duas vezes do mesmo item não acelera nada e polui a fila */
const duas = d(contestado, {
  type: 'ABRIR_CONTESTACAO', familiaId: b21.familias[0].id, tipo: 'coleta',
  alvoId: alvo21.id, motivo: 'O peso está errado',
});
ok(duas.contestacoes.length === 1, 'duas contestações abertas no mesmo item não são criadas');

/* a operação responde, e a família passa a ver a resposta */
const respondido = d(contestado, {
  type: 'RESPONDER_CONTESTACAO', id: ct.id, resposta: 'Conferimos e corrigimos para 62 kg.', resolver: true,
});
const ct2 = respondido.contestacoes[0];
ok(ct2.status === 'resolvida' && /62 kg/.test(ct2.resposta), 'a operação responde e resolve');
ok(ct2.respondidoEm, 'com data da resposta');
ok(respondido.transacoes.filter(t => t.tipo === 'CONTESTACAO').length === 2,
  'a resposta também fica registrada (o ciclo inteiro é auditável)');

/* APPEND-ONLY: não existe ação para apagar contestação */
const acoes = ['REMOVER_CONTESTACAO', 'APAGAR_CONTESTACAO', 'EXCLUIR_CONTESTACAO'];
ok(acoes.every(a => d(respondido, { type: a, id: ct.id }).contestacoes.length === 1),
  'não há como apagar uma contestação — reclamação se responde, não se apaga');

/* correção de peso: só antes da validação */
const pend21 = d(b21, {
  type: 'NOVA_COLETA',
  payload: { coletor: 'Dona Nilza', material: 'Vidro', kg: 10, local: 'Cueira', data: '2026-07-26', familiaId: b21.familias[0].id },
});
const novaColeta = pend21.coletas[pend21.coletas.length - 1];
const corrigida = d(pend21, { type: 'CORRIGIR_COLETA', id: novaColeta.id, kg: 62 });
ok(corrigida.coletas.find(c => c.id === novaColeta.id).kg === 62, 'peso de coleta PENDENTE pode ser corrigido');
ok(corrigida.transacoes.some(t => /corrigido de 10 kg para 62 kg/.test(t.desc)),
  'e a correção fica registrada com o valor antigo e o novo');

const validada21 = d(pend21, { type: 'VALIDAR_COLETA', id: novaColeta.id });
const tentou = d(validada21, { type: 'CORRIGIR_COLETA', id: novaColeta.id, kg: 999 });
ok(tentou.coletas.find(c => c.id === novaColeta.id).kg === 10,
  'peso de coleta JÁ VALIDADA não é editável — ela já entrou em relatório');

/* ==========================================================================
   20. Abrir o mês seguinte (o ciclo mensal não travava mais em um mês)
   ========================================================================== */
secao('20. Compromissos do mês seguinte');

const base20 = estadoInicial();
/* a seed não tem consentimento: sem ele nada é criado, e isso é a regra —
   compromisso é dado de família e exige autorização vigente */
const semCons = d(base20, { type: 'ABRIR_MES', mes: 'Agosto', tipos: ['Vacinação em dia'] });
ok(semCons.familias.every(f => !f.condicoes.some(c => c.mes === 'Agosto')),
  'sem consentimento vigente, nenhum compromisso é criado');

/* com consentimento nas três, o mês abre para todas */
let cons20 = base20;
for (const f of base20.familias) {
  cons20 = d(cons20, {
    type: 'REGISTRAR_CONSENTIMENTO', familiaId: f.id, termoHash: 'd'.repeat(64),
  });
}
const agosto = d(cons20, {
  type: 'ABRIR_MES', mes: 'Agosto', tipos: ['Vacinação em dia', 'Matrícula escolar'],
});
const novosAgosto = agosto.familias.flatMap(f => f.condicoes.filter(c => c.mes === 'Agosto'));
ok(novosAgosto.length === base20.familias.length * 2,
  `abre o mês para todas: ${novosAgosto.length} compromissos`);
ok(novosAgosto.every(c => c.status === 'pendente'), 'todos nascem pendentes');
ok(novosAgosto.every(c => c.id), 'com id próprio');
/* o rótulo leva o número de crianças, para a família reconhecer na tela dela */
const deMaria = agosto.familias[0];
ok(deMaria.condicoes.some(c => c.mes === 'Agosto' && /2 crianças/.test(c.tipo)),
  'o rótulo inclui o número de crianças da família');

/* CLICAR DUAS VEZES NÃO PODE DOBRAR O BÔNUS DO MÊS */
const agostoDeNovo = d(agosto, {
  type: 'ABRIR_MES', mes: 'Agosto', tipos: ['Vacinação em dia', 'Matrícula escolar'],
});
ok(agostoDeNovo.familias.flatMap(f => f.condicoes.filter(c => c.mes === 'Agosto')).length === novosAgosto.length,
  'abrir o mesmo mês de novo NÃO duplica (não dobraria o bônus)');

/* só para quem foi escolhido */
const soUma = d(cons20, {
  type: 'ABRIR_MES', mes: 'Setembro', tipos: ['Vacinação em dia'],
  familiaIds: [base20.familias[1].id],
});
ok(soUma.familias.filter(f => f.condicoes.some(c => c.mes === 'Setembro')).length === 1,
  'com familiaIds, abre só para as escolhidas');

/* remover: pendente sim, comprovado NUNCA */
const pend = novosAgosto[0];
const semPend = d(agosto, { type: 'REMOVER_COMPROMISSO', condicaoId: pend.id });
ok(!semPend.familias.flatMap(f => f.condicoes).some(c => c.id === pend.id),
  'compromisso pendente pode ser removido (erro de digitação se corrige)');

const comprovado = d(agosto, {
  type: 'ENVIAR_COMPROVACAO', familiaId: deMaria.id,
  condicaoId: deMaria.condicoes.find(c => c.mes === 'Agosto').id,
});
const alvoComp = comprovado.familias[0].condicoes.find(c => c.mes === 'Agosto');
ok(alvoComp.status === 'comprovada', 'a família comprovou');
const tentouRemover = d(comprovado, { type: 'REMOVER_COMPROMISSO', condicaoId: alvoComp.id });
ok(tentouRemover.familias[0].condicoes.some(c => c.id === alvoComp.id),
  'compromisso JÁ COMPROVADO não é removível — apagaria a prova que a família enviou');

/* entrada inválida não faz nada */
ok(d(cons20, { type: 'ABRIR_MES', mes: '', tipos: ['x'] }).familias
  .every(f => f.condicoes.length === base20.familias.find(x => x.id === f.id).condicoes.length),
'mês vazio não cria nada');
ok(d(cons20, { type: 'ABRIR_MES', mes: 'Outubro', tipos: [] }).familias
  .every(f => !f.condicoes.some(c => c.mes === 'Outubro')), 'sem tipo escolhido não cria nada');

/* ==========================================================================
   19. Meta de poupança — sem virar tutela
   ========================================================================== */
secao('19. Meta de poupança da família');

const semMeta = estadoInicial();
const fam1 = semMeta.familias[0];
ok(store.progressoMeta(fam1) === null, 'família nasce SEM meta (o projeto não define meta para ninguém)');

const comMeta = d(semMeta, {
  type: 'DEFINIR_META', familiaId: fam1.id, nome: 'consertar o telhado', valor: 1200,
});
const pm = store.progressoMeta(comMeta.familias.find(f => f.id === fam1.id));
ok(pm !== null && pm.nome === 'consertar o telhado', 'a família define a meta com as palavras dela');
ok(pm.alvo === 1200, 'com o valor que ela escolheu');
ok(perto(pm.tem, fam1.saldo), 'o progresso usa o saldo real dela');
ok(pm.falta > 0 && perto(pm.falta, 1200 - fam1.saldo), `mostra quanto falta (${fmt(pm.falta)})`);
ok(pm.pct > 0 && pm.pct < 100, `e a porcentagem (${Math.floor(pm.pct)}%)`);
ok(pm.alcancada === false, 'e que ainda não foi alcançada');

/* A TRAVA PRINCIPAL: meta não pode impedir nem reduzir o saque. O dinheiro é
   dela; meta que dificulta o acesso deixa de ser ferramenta e vira tutela. */
const saldoAntesMeta = comMeta.familias.find(f => f.id === fam1.id).saldo;
const sacouComMeta = d(comMeta, { type: 'SACAR_PIX', id: fam1.id, valor: saldoAntesMeta });
const depoisSaque = sacouComMeta.familias.find(f => f.id === fam1.id);
ok(perto(depoisSaque.saldo, 0), 'com meta ativa, o saque total continua saindo INTEIRO');
ok(depoisSaque.meta !== null && depoisSaque.meta !== undefined,
  'a meta continua lá depois do saque (não é castigo, é lembrete)');
ok(store.progressoMeta(depoisSaque).falta === 1200, 'e o "quanto falta" simplesmente volta ao início');

/* meta alcançada não bloqueia nada nem exige nada */
const rica = { ...comMeta, familias: comMeta.familias.map(f => f.id === fam1.id ? { ...f, saldo: 1500 } : f) };
const pmOk = store.progressoMeta(rica.familias.find(f => f.id === fam1.id));
ok(pmOk.alcancada === true && pmOk.pct === 100, 'meta alcançada é marcada como alcançada');
ok(pmOk.falta === 0, 'e o que falta é zero, não negativo');

/* apagar é imediato, sem pergunta e sem consequência */
const apagada = d(comMeta, { type: 'REMOVER_META', familiaId: fam1.id });
ok(store.progressoMeta(apagada.familias.find(f => f.id === fam1.id)) === null, 'a família apaga a meta quando quiser');

/* entrada inválida não cria meta fantasma */
ok(store.progressoMeta(d(semMeta, { type: 'DEFINIR_META', familiaId: fam1.id, nome: '', valor: 100 })
  .familias.find(f => f.id === fam1.id)) === null, 'meta sem nome não é criada');
ok(store.progressoMeta(d(semMeta, { type: 'DEFINIR_META', familiaId: fam1.id, nome: 'x', valor: 0 })
  .familias.find(f => f.id === fam1.id)) === null, 'meta sem valor não é criada');

/* LGPD: "guardar para o remédio da minha filha" é dado de saúde. A meta é
   escrita livre e por isso NÃO pode subir para a base compartilhada. */
const opsMeta = calcularDeltas(semMeta, d(semMeta, {
  type: 'DEFINIR_META', familiaId: fam1.id, nome: 'remédio da minha filha', valor: 200,
}));
const serialMeta = JSON.stringify(opsMeta);
ok(!serialMeta.includes('remédio') && !serialMeta.includes('meta'),
  'a meta NÃO sobe para a nuvem (texto livre pode conter dado de saúde)');

/* e o pull da nuvem não pode apagar a meta guardada no aparelho */
const remotoSemMeta = {
  ...comMeta,
  familias: comMeta.familias.map(f => ({
    id: f.id, codigo: 'BOI-' + f.id, criancas: f.criancas, carteira: f.carteira,
    saldo: f.saldo, condicoes: f.condicoes, extrato: f.extrato,
  })),
};
ok(store.progressoMeta(mesclar(comMeta, remotoSemMeta).familias.find(f => f.id === fam1.id)) !== null,
  'e o merge da nuvem não apaga a meta do aparelho');

/* ==========================================================================
   18. A nuvem vazia NÃO apaga o trabalho local
   ========================================================================== */
secao('18. Estado remoto vazio nunca substitui dado local');

/* Este é o acidente: desde a migração 02 o papel anônimo não tem policy, e o
   PostgREST responde a isso com 200 e LISTA VAZIA — não com erro. Um aparelho
   sem sessão baixava um estado bem formado com tudo zerado, a impressão digital
   diferia, o merge adotava, e o trabalho de campo era apagado e gravado por
   cima. Aconteceu de verdade num aparelho de teste. */
const vazioDaNuvem = {
  coletas: [], relatorios: [], vendas: [], propostas: [], transacoes: [],
  familias: [], caixas: { renda: 0, fundo: 0, operacao: 0, fundoLiberado: 0 },
};
const comDados = estadoInicial();

ok(comDados.familias.length > 0 && comDados.transacoes.length > 0, 'o local tem dados');
ok(nuvemDifere(comDados, vazioDaNuvem) === false,
  'um remoto VAZIO não é considerado "diferente" (não dispara merge)');

const apos = mesclar(comDados, vazioDaNuvem);
ok(apos.familias.length === comDados.familias.length,
  `mesclar com vazio preserva as famílias (${apos.familias.length})`);
ok(apos.transacoes.length === comDados.transacoes.length, 'e as transações');
ok(apos === comDados, 'na prática devolve o próprio estado local, intacto');

/* nuvem vazia com local vazio é legítima: é o primeiro aparelho a abrir */
ok(remotoUtilizavel(vazioDaNuvem, vazioDaNuvem) === true,
  'local vazio + remoto vazio é situação normal (primeiro aparelho)');

/* e um remoto COM dados continua sendo adotado — a trava não pode virar bloqueio */
const remotoCheio = {
  ...vazioDaNuvem,
  familias: [{ id: 1, codigo: 'BOI-001', criancas: 2, carteira: null, saldo: 5, condicoes: [], extrato: [] }],
  transacoes: comDados.transacoes,
  coletas: comDados.coletas,
};
ok(nuvemDifere(comDados, remotoCheio) === true, 'remoto COM dados continua sendo detectado');
ok(mesclar(comDados, remotoCheio).familias.length === 1, 'e continua sendo adotado');

/* ==========================================================================
   17. Renda do trabalho visível para a família (o que o app escondia)
   ========================================================================== */
secao('17. Renda incondicional na conta da família');

const semSeed = estadoInicial();
const comFam = semSeed.coletas.filter(c => c.familiaId);
ok(comFam.length >= 2, `a seed vincula coletas a famílias (${comFam.length})`);

const rendaTotalSeed = store.rendaCreditada(semSeed);
ok(rendaTotalSeed > 0, `renda creditada em conta de família: ${fmt(rendaTotalSeed)}`);
ok(rendaTotalSeed <= semSeed.caixas.renda + 0.01,
  'nunca credita mais do que os 60% destinados');

/* o rateio é por quilo, e a soma tem de FECHAR — centavo sumido no extrato de
   quem ganha pouco é exatamente o que destrói confiança em dinheiro digital */
const umaVenda = estadoInicial();
const antesR = store.rendaCreditada(umaVenda);
const depoisVenda = d(umaVenda, {
  type: 'NOVA_VENDA',
  payload: { tipo: 'produto', descricao: 'Peça teste', comprador: 'Turista', valor: 100, materiais: ['Vidro'] },
});
const creditadoAgora = Number((store.rendaCreditada(depoisVenda) - antesR).toFixed(2));
ok(perto(creditadoAgora, 60), `a renda de uma venda de R$ 100 credita exatamente R$ 60,00 (${creditadoAgora})`);

/* cada linha de renda é identificável como renda — a tela usa isso para
   separar "seu trabalho" de "bônus" */
const linhas = depoisVenda.familias.flatMap(f => f.extrato).filter(e => e.tipo === 'renda');
ok(linhas.length > 0 && linhas.every(e => e.valor > 0), 'linhas de renda são positivas e marcadas');
ok(linhas.every(e => /renda da sua coleta/i.test(e.desc)), 'e descritas em linguagem de família');
ok(depoisVenda.transacoes.some(t => t.tipo === 'RENDA' && t.valor > 0), 'com transação RENDA no registro');

/* coleta sem família vinculada não credita ninguém — e o valor não desaparece:
   continua no total do projeto, e o painel mostra a diferença nomeada */
const semVinculo = { ...estadoInicial() };
semVinculo.coletas = semVinculo.coletas.map(c => ({ ...c, familiaId: undefined }));
semVinculo.familias = semVinculo.familias.map(f => ({ ...f, extrato: [], saldo: 0 }));
const vendeuSemVinculo = d(semVinculo, {
  type: 'NOVA_VENDA',
  payload: { tipo: 'produto', descricao: 'Sem vínculo', comprador: 'Turista', valor: 100, materiais: ['Vidro'] },
});
ok(store.rendaCreditada(vendeuSemVinculo) === 0, 'coleta sem família vinculada não credita conta nenhuma');
ok(vendeuSemVinculo.caixas.renda > semVinculo.caixas.renda, 'mas o valor entra no total do projeto');

/* aviso no WhatsApp: opt-in, e fica gravado */
const fam0b = estadoInicial().familias[0].id;
const ligado = d(estadoInicial(), { type: 'AVISO_WHATSAPP', familiaId: fam0b, ligar: true });
ok(ligado.familias.find(f => f.id === fam0b).avisarWhatsapp === true, 'aviso de WhatsApp pode ser ligado');
ok(estadoInicial().familias[0].avisarWhatsapp !== true, 'e nasce DESLIGADO (mensagem sobre dinheiro não pedida assusta)');
const desligado = d(ligado, { type: 'AVISO_WHATSAPP', familiaId: fam0b, ligar: false });
ok(desligado.familias.find(f => f.id === fam0b).avisarWhatsapp === false, 'e pode ser desligado');

/* a preferência não é assunto da nuvem */
const opsAviso = calcularDeltas(estadoInicial(), ligado);
ok(!JSON.stringify(opsAviso).includes('avisarWhatsapp'), 'a escolha de aviso não sobe para a base compartilhada');

/* ==========================================================================
   16. Cofre real: comprovante de execução e regra 4 (residual → coletivo)
   ========================================================================== */
secao('16. Execução na devnet e fechamento de ciclo');

const SIG = 'z'.repeat(88);
const propExec = s1.propostas.find(p => p.status === 'executada');
ok(Boolean(propExec), 'há proposta executada no app (simulada)');
ok(!propExec.execucaoOnchain, 'que começa SEM comprovante on-chain — o app não assina sozinho');

const comComprovante = d(s1, { type: 'REGISTRAR_EXECUCAO_ONCHAIN', propostaId: propExec.id, txId: SIG });
const pOn = comComprovante.propostas.find(p => p.id === propExec.id);
ok(pOn.execucaoOnchain?.txId === SIG, 'o comprovante colado pela operação é guardado');
ok(pOn.execucaoOnchain.rede === 'Solana devnet', 'marcado como devnet');
ok(pOn.execucaoOnchain.url.includes(SIG) && pOn.execucaoOnchain.url.includes('cluster=devnet'),
  'com link verificável no explorer');
const txReal = comComprovante.transacoes.filter(t => t.real === true && t.tipo === 'LIBERAÇÃO');
ok(txReal.length === 1, 'gera transação marcada como REAL, distinta das simuladas');

/* regra 4: residual sai do fundo e vira decisão registrada */
const fundoAntes = s1.caixas.fundo;
ok(fundoAntes > 0, `há saldo residual no fundo (${fundoAntes})`);
const fechado = d(s1, {
  type: 'FECHAR_CICLO', acao: 'kit de higiene bucal para a escola',
  valor: 10, comoFoiDecidido: 'assembleia comunitária',
  participantes: '14 famílias', ciclo: '2026-07', hash: 'c'.repeat(64),
});
ok(fechado.ciclos.length === 1, 'fechamento de ciclo registra a destinação');
ok(Math.abs(fechado.caixas.fundo - (fundoAntes - 10)) < 0.01, 'e o valor sai do saldo do fundo');
ok(fechado.ciclos[0].ancoragem === null, 'nasce sem ancoragem (a prova é passo separado)');
ok(!/criança|CPF/i.test(JSON.stringify(fechado.ciclos[0])), 'o registro não carrega dado de criança');

const ancorado = d(fechado, { type: 'ANCORAR_DECISAO', cicloId: fechado.ciclos[0].id, txId: SIG });
ok(ancorado.ciclos[0].ancoragem?.txId === SIG, 'ancoragem da decisão é guardada');
ok(ancorado.transacoes.some(t => t.tipo === 'ANCORAGEM' && t.real === true),
  'e gera transação ANCORAGEM marcada como real');

/* o hash da decisão tem de depender de TODOS os campos, senão não prova nada */
const { hashDecisaoColetiva } = await import(
  pathToFileURL(process.env.ANCORAGEM_BUNDLE ?? new URL('./.tmp/ancoragem.mjs', import.meta.url).pathname).href);
const baseDec = { ciclo: '2026-07', acao: 'kit', valor: 10, comoFoiDecidido: 'assembleia', participantes: '14', data: '2026-07-26' };
const h0 = await hashDecisaoColetiva(baseDec);
ok(/^[0-9a-f]{64}$/.test(h0), 'hash da decisão é SHA-256 em hex');
for (const campo of ['ciclo', 'acao', 'valor', 'comoFoiDecidido', 'participantes', 'data']) {
  const alterado = { ...baseDec, [campo]: campo === 'valor' ? 11 : baseDec[campo] + 'X' };
  ok(await hashDecisaoColetiva(alterado) !== h0, `mudar "${campo}" muda o hash`);
}

console.log(`\n${'='.repeat(52)}`);
console.log(falhas === 0 ? `✅ ${total} verificações, todas passaram` : `❌ ${falhas} de ${total} falharam`);
process.exit(falhas === 0 ? 0 : 1);
