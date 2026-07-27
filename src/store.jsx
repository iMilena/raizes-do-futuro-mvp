import React, { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react';
import * as nuvem from './nuvem.js';
import * as sinc from './sincronizacao.js';

const KEY = 'raizes-mvp-v2';

/* --------------------------------------------------- constantes públicas ---- */
export const REDE = 'Solana';
export const MOEDA = 'BRZ/cRED';
export const PROVIDER_CARTEIRA = 'Picnic';
export const TAXA_SOLANA = 0.000005; // SOL — patrocinada pela operação
export const BONUS_POR_CRIANCA = 30;
export const SPLIT = { renda: 0.6, fundo: 0.25, operacao: 0.15 };

export const SIGNATARIOS = [
  { id: 'viva', nome: 'Instituto Vivá', papel: 'Mobilização e validação social', emoji: '🌱', endereco: null },
  { id: 'detrash', nome: 'DeTrash', papel: 'Validação ambiental (metodologia)', emoji: '♻️', endereco: null },
  { id: 'comunidade', nome: 'Representante Comunitário', papel: 'Controle social do território', emoji: '🤝', endereco: null },
];
export const signatarioPor = id => SIGNATARIOS.find(s => s.id === id);

export const TIPOS_TX = {
  'GÊNESE': { rot: 'Implantação do cofre multisig', cor: '#8a5cf6' },
  'RECEITA': { rot: 'Venda com split 60/25/15 automático', cor: '#1cabe2' },
  'VALIDAÇÃO': { rot: 'Coleta validada (metodologia DeTrash)', cor: '#1b7a43' },
  'CIRCULARIDADE': { rot: 'Relatório de Circularidade emitido', cor: '#0b7ba8' },
  'PROPOSTA': { rot: 'Proposta de transferência criada no cofre', cor: '#8a5cf6' },
  'ASSINATURA': { rot: 'Assinatura de signatário do cofre', cor: '#b3541e' },
  'LIBERAÇÃO': { rot: 'Bônus executado pelo cofre (limiar atingido)', cor: '#1b7a43' },
  'RESERVA': { rot: 'Bônus reservado — nunca perdido', cor: '#f2c14e' },
  'CARTEIRA': { rot: 'Conta da família conectada', cor: '#1cabe2' },
  'SAQUE': { rot: 'Conversão para reais via Pix', cor: '#b3541e' },
  'ANCORAGEM': { rot: 'Relatório ancorado na Solana devnet (registro real)', cor: '#0f7a6c' },
  'CONSENTIMENTO': { rot: 'Consentimento do responsável registrado ou revogado', cor: '#6d4de8' },
  'RENDA': { rot: 'Renda incondicional da coleta, direto para a família', cor: '#0b7ba8' },
};
export const tipoTx = t => TIPOS_TX[t] || { rot: t, cor: '#6b7a70' };

/* ------------------------------------------------------- consentimento ----- */
/**
 * Termo apresentado ao responsável. Fica no código de propósito: o hash que vai
 * para o registro tem de ser o hash DESTE texto, e um texto que mora só no banco
 * pode ser trocado depois sem ninguém notar. Aqui ele é versionado com o app.
 */
export const VERSAO_TERMO = 'termo-piloto-boipeba-v1';
export const FINALIDADES_PADRAO = [
  'registrar a coleta de resíduos da família',
  'comprovar as condições de saúde e educação das crianças',
  'transferir o bônus para a conta indicada',
  'prestar contas do piloto de forma agregada',
];
export const TEXTO_TERMO = [
  'Autorizo o Instituto Vivá a registrar, no sistema Raízes do Futuro, os dados',
  'necessários para participar do piloto de Boipeba: as coletas realizadas pela',
  'minha família, a comprovação das condições de saúde e educação das crianças e',
  'a conta para receber o bônus.',
  '',
  'Sei que:',
  '· meu nome NÃO é enviado para a base compartilhada — ela usa um código;',
  '· as fotos dos comprovantes ficam no aparelho, e o sistema guarda apenas um',
  '  código de verificação (hash) que prova que a foto não foi trocada;',
  '· posso pedir para sair a qualquer momento, sem perder o que já recebi;',
  '· pedir para sair faz meus dados pararem de ser compartilhados.',
].join('\n');

/* ------------------------------------------------------------------ PIN ----- */
/**
 * PIN da família: verificado de verdade, e NUNCA sai do aparelho.
 *
 * Antes a tela só checava `pin.length === 4` — qualquer quatro dígitos abriam a
 * conta de qualquer família. Na demonstração isso estava escrito na tela, então
 * não mentia; em campo significaria que o celular da família abre a conta dela
 * sem segredo nenhum.
 *
 * Desenho:
 *  · guarda SHA-256 de `sal + pin`, não o PIN. Sal por família, para dois PINs
 *    iguais não terem o mesmo hash (com 4 dígitos, sem sal, uma tabela de 10 mil
 *    entradas resolve tudo de uma vez).
 *  · o hash fica SÓ no localStorage do aparelho: `recorteFamilia()` não o envia,
 *    e há teste garantindo isso. PIN de família não é assunto da base
 *    compartilhada — se subisse, um vazamento da base viraria vazamento de
 *    acesso às contas.
 *  · 4 dígitos são fracos por natureza. O que os torna aceitáveis é o bloqueio
 *    por tentativas (abaixo) e o fato de o app não dar acesso a dinheiro sem o
 *    agente humano no fluxo de saque.
 */
export const MAX_TENTATIVAS_PIN = 5;

/* nome distinto do hex(str) de baixo, que serve a outra coisa (derivar os
   endereços simulados). Dois hex no mesmo módulo derrubavam o build. */
const bytesParaHex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');

/** Sal aleatório por família. Sem crypto disponível, degrada para pseudoaleatório. */
export function novoSal() {
  const c = globalThis.crypto;
  if (c?.getRandomValues) return bytesParaHex(c.getRandomValues(new Uint8Array(16)));
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export async function hashPin(pin, sal) {
  const sub = globalThis.crypto?.subtle;
  if (!sub) return '';
  /* bytesParaHex, NÃO o hex(str) de baixo. Passar um ArrayBuffer para aquele
     devolve o hash de "[object ArrayBuffer]" — idêntico para qualquer PIN, e o
     build compila sem reclamar. É o tipo de erro que só um teste pega. */
  return bytesParaHex(await sub.digest('SHA-256', new TextEncoder().encode(`${sal}:${pin}`)));
}

/** A família já definiu PIN neste aparelho? */
export const temPin = f => Boolean(f?.pin?.hash);

/** Confere o PIN. Devolve false também quando não há PIN definido. */
export async function conferirPin(f, pin) {
  if (!temPin(f)) return false;
  return (await hashPin(pin, f.pin.sal)) === f.pin.hash;
}

/** SHA-256 do termo exato apresentado. Prova qual texto a pessoa aceitou. */
export async function hashTermo(texto = TEXTO_TERMO) {
  const cripto = globalThis.crypto?.subtle;
  if (!cripto) return '';
  const bytes = await cripto.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------- retenção ----- */
/**
 * Prazo padrão do consentimento. Dado sem prazo é dado para sempre — a LGPD
 * (art. 15/16) exige que o tratamento termine quando a finalidade acaba.
 * 24 meses cobrem um ciclo de piloto com folga para renovar em visita de campo.
 */
export const VALIDADE_MESES = 24;
/** Carência entre o fim da autorização e o expurgo, para dar tempo de renovar. */
export const CARENCIA_DIAS = 30;

const maisMeses = (iso, meses) => {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + meses);
  return d;
};

/** Quando este consentimento vence. */
export const venceEm = c => (c ? maisMeses(c.coletadoEm, c.validadeMeses ?? VALIDADE_MESES) : null);

/**
 * Situação do consentimento: 'vigente' | 'vencendo' | 'vencido' | 'revogado'.
 * Espelha a view `retencao_status` da migração 03 — se divergirem, a tela mente
 * sobre o que o banco vai fazer.
 */
export function situacaoConsentimento(c, agora = Date.now()) {
  if (!c) return 'ausente';
  if (c.revogadoEm) return 'revogado';
  const v = venceEm(c).getTime();
  if (v <= agora) return 'vencido';
  if (v <= agora + 60 * 24 * 3600 * 1000) return 'vencendo';
  return 'vigente';
}

/**
 * Consentimento que de fato autoriza tratar o dado: não revogado E no prazo.
 *
 * Antes bastava não estar revogado. Sem a checagem de prazo, a validade seria
 * decoração: venceria e o dado seguiria sendo compartilhado.
 */
export const consentimentoAtivo = f =>
  (f?.consentimentos || []).find(c => ['vigente', 'vencendo'].includes(situacaoConsentimento(c))) || null;

/**
 * Renda que de fato caiu em conta de família — não os 60% destinados.
 *
 * O painel dizia "direto para as famílias" mostrando `caixas.renda`, que é o
 * valor DESTINADO. Se um coletor não está vinculado a família cadastrada, o
 * dinheiro não chega a conta nenhuma, e o número virava afirmação generosa
 * demais. Este é o número honesto; a diferença aparece do lado, nomeada.
 */
export const rendaCreditada = state =>
  (state.familias || []).reduce((a, f) =>
    a + (f.extrato || []).filter(e => e.tipo === 'renda').reduce((b, e) => b + e.valor, 0), 0);

/** O último registro, mesmo vencido/revogado — é o que a tela precisa explicar. */
export const consentimentoMaisRecente = f => {
  const l = f?.consentimentos || [];
  return l.length ? l[l.length - 1] : null;
};

/** Saldo do cofre menos o comprometido em propostas ainda aguardando assinatura. */
export const disponivelCofre = s =>
  s.caixas.fundo - s.propostas.filter(p => p.status === 'aguardando').reduce((a, p) => a + p.valor, 0);

/* ------------------------------------------------ hash / base58 simulados ---- */
function hex(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Endereço estilo Solana (base58 simulado, 44 caracteres por padrão). */
export function solAddr(seed, len = 44) {
  let out = '', h = hex(seed);
  while (out.length < len) {
    for (let i = 0; i < h.length && out.length < len; i += 2) {
      out += B58[parseInt(h.slice(i, i + 2), 16) % 58];
    }
    h = hex(h + seed + out.length);
  }
  return out;
}

/** Signature estilo Solana (~88 caracteres). */
export const solSig = seed => solAddr('sig:' + seed, 88);

/** Trunca endereço/signature: abc123…xyz789 */
export const trunc = (s, a = 6, b = 6) => (!s ? '' : s.length <= a + b + 1 ? s : s.slice(0, a) + '…' + s.slice(-b));

export const fmt = v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

SIGNATARIOS.forEach(s => { s.endereco = solAddr('signatario-' + s.id); });

/* ------------------------------------------------------------- transações ---- */
function pushTx(state, tipo, desc, valor, extra = {}) {
  const prev = state.transacoes.length
    ? state.transacoes[state.transacoes.length - 1].signature
    : solSig('genesis-raizes-do-futuro');
  const seq = state.transacoes.length;
  state.slot += 1 + (seq % 3); // slots avançam de forma irregular, como na rede real
  state.transacoes.push({
    seq,
    slot: state.slot,
    tipo,
    desc,
    valor,
    signature: solSig(seq + tipo + desc + valor + prev),
    prevSignature: prev,
    ts: Date.now(),
    taxa: TAXA_SOLANA,
    ...extra,
  });
  return state.transacoes[state.transacoes.length - 1];
}

function aplicarSplit(state, venda) {
  state.caixas.renda += venda.valor * SPLIT.renda;
  state.caixas.fundo += venda.valor * SPLIT.fundo;
  state.caixas.operacao += venda.valor * SPLIT.operacao;
  // vendaId liga esta transação à peça vendida: é o que a página de rastreio usa
  // para mostrar ao turista em qual registro a compra dele entrou
  pushTx(state, 'RECEITA', `${venda.descricao} — ${venda.comprador} (${fmt(venda.valor)}) → split 60/25/15`, venda.valor, { vendaId: venda.id });
  creditarRenda(state, venda);
}

/**
 * Credita os 60% de renda a QUEM COLETOU o material desta venda.
 *
 * ── POR QUE ISTO PRECISAVA EXISTIR ────────────────────────────────────────
 * O extrato da família recebia só bônus e retirada. Os 60% iam para
 * `caixas.renda`, uma caixa do PROJETO, e nunca apareciam na tela dela.
 *
 * O efeito era o oposto do que o projeto defende. O princípio nº 1 é "a renda do
 * trabalho é incondicional", e a família via na tela apenas a parte
 * CONDICIONAL — o bônus que depende de saúde e escola em dia. A parte que é dela
 * sem condição nenhuma era invisível. A tela contradizia o discurso.
 *
 * Divisão: proporcional aos QUILOS que cada família coletou no lote da venda.
 * Coleta sem família vinculada (coletor que não é de família participante) não
 * gera crédito — o valor fica no total do projeto, como antes, e isso aparece na
 * conferência do Mercado.
 */
function creditarRenda(state, venda) {
  const totalRenda = venda.valor * SPLIT.renda;
  const daOrigem = (venda.origem || [])
    .map(id => state.coletas.find(c => c.id === id))
    .filter(c => c && c.familiaId);

  /* Venda sem `origem` — o caso do Relatório de Circularidade vendido a empresa —
     não sai do material de UMA peça: ela vende o dado construído a partir de
     todos os quilos validados. Então a renda dela se divide entre quem coletou
     esses quilos. Sem este ramo, "direto para as famílias" no painel contaria um
     dinheiro que nenhuma família recebeu — foi o que aconteceu: o painel dizia
     R$ 1.548 e só R$ 48 tinham chegado a uma conta. */
  const coletas = daOrigem.length
    ? daOrigem
    : state.coletas.filter(c => c.familiaId && c.status === 'validada');

  const kgTotal = coletas.reduce((a, c) => a + Number(c.kg), 0);
  if (!coletas.length || kgTotal <= 0) return;

  /* rateio por quilo, com o resto do arredondamento indo para a última família —
     senão a soma dos créditos não fecha com o valor da renda e aparece centavo
     sumido no extrato, que é exatamente o tipo de coisa que destrói confiança */
  let distribuido = 0;
  coletas.forEach((c, i) => {
    const f = state.familias.find(x => x.id === c.familiaId);
    if (!f) return;
    const ultima = i === coletas.length - 1;
    const parte = ultima
      ? Number((totalRenda - distribuido).toFixed(2))
      : Number((totalRenda * (Number(c.kg) / kgTotal)).toFixed(2));
    distribuido = Number((distribuido + parte).toFixed(2));
    if (parte <= 0) return;

    f.saldo = Number((f.saldo + parte).toFixed(2));
    f.extrato.push({
      ts: Date.now(),
      tipo: 'renda',
      desc: daOrigem.length
        ? `Renda da sua coleta — ${c.kg} kg de ${String(c.material).toLowerCase()}`
        : `Renda da sua coleta — sua parte em "${venda.descricao}"`,
      valor: parte,
    });
    pushTx(state, 'RENDA',
      `Renda incondicional de ${fmt(parte)} para ${f.resp} — ${c.kg} kg na venda "${venda.descricao}"`,
      parte, { familiaId: f.id, vendaId: venda.id, coletaId: c.id });
  });
}

/**
 * Id novo, único entre aparelhos.
 *
 * Não pode ser contador local (`nextId++`): dois aparelhos offline alocam o
 * MESMO id para coisas diferentes, e o upsert por chave primária faz um apagar
 * o registro do outro na base compartilhada. Aconteceu no teste de dois
 * aparelhos — uma coleta sobrescreveu outra em silêncio.
 *
 * Milissegundo + sufixo aleatório cabe em bigint e torna a colisão irrelevante
 * na escala do piloto.
 */
function novoId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}
/* ---------------------------- rastreio do produto (QR na etiqueta) ---------- */
/* alfabeto sem O/0/I/1: ninguém erra ao ditar o código por telefone */
const ALFA_CODIGO = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Código curto e legível impresso na etiqueta da peça: RF-XXXX */
export function codigoRastreio(semente) {
  const h = hex(String(semente));
  let out = '';
  for (let i = 0; i < 4; i++) out += ALFA_CODIGO[parseInt(h.slice(i * 2, i * 2 + 2), 16) % 32];
  return 'RF-' + out;
}

/**
 * Coletas validadas que forneceram o material desta peça.
 * Prefere as do mesmo material; se nenhuma casar (lona de vela, rede de pesca),
 * cai para as últimas validadas — o turista sempre vê uma origem concreta, e a
 * página deixa claro quando o vínculo é do lote e não da peça.
 */
function coletasDeOrigem(state, materiais) {
  const validadas = state.coletas.filter(c => c.status === 'validada');
  const lista = Array.isArray(materiais) ? materiais.filter(Boolean) : [];
  const casaMaterial = validadas.filter(c =>
    lista.some(m => c.material.toLowerCase().includes(String(m).toLowerCase().split(' ')[0])));
  return (casaMaterial.length ? casaMaterial : validadas).slice(-2).map(c => c.id);
}

export const vendaPorRastreio = (state, codigo) =>
  state.vendas.find(v => v.rastreio && v.rastreio.toUpperCase() === String(codigo || '').toUpperCase());

/** URL absoluta que vai dentro do QR — precisa ser absoluta para o celular abrir. */
export const urlRastreio = codigo =>
  `${location.origin}${location.pathname}#/rastreio/${codigo}`;

/** "Vacinação em dia (2 crianças)" → "vacinação em dia" (extrato lido pela família). */
function simplificar(tipo) {
  return String(tipo).replace(/\s*\([^)]*\)\s*$/, '').replace(/≥.*$/, 'em dia').trim().toLowerCase();
}

/** Executa uma proposta que atingiu o limiar: transfere o bônus para a família. */
function executarProposta(state, p) {
  const f = state.familias.find(f => f.id === p.familiaId);
  const c = f?.condicoes.find(c => c.id === p.condicaoId);
  if (!f) return;

  // Salvaguarda da regra "nunca perdido": se na hora de executar faltar saldo ou
  // conta, a proposta volta a reservada. Sem isto ela ficaria presa em
  // "aguardando" com as 2 assinaturas já dadas, e o bônus sumiria do radar.
  if (state.caixas.fundo < p.valor || !f.carteira) {
    p.status = 'reservada';
    if (c) c.status = 'validada-aguardando';
    pushTx(state, 'RESERVA',
      `Proposta #${p.id} atingiu o limiar mas não executou — ${fmt(p.valor)} reservado para ${f.resp} (${!f.carteira ? 'sem conta conectada' : 'cofre sem saldo'}); liberação retroativa garantida`,
      0, { propostaId: p.id });
    return;
  }

  state.caixas.fundo -= p.valor;
  state.caixas.fundoLiberado += p.valor;
  f.saldo += p.valor;
  // extrato é lido pela família: linguagem do dia a dia, sem jargão do programa
  f.extrato.push({
    ts: Date.now(),
    desc: c ? `Bônus de ${c.mes.toLowerCase()} — ${simplificar(c.tipo)}` : 'Bônus por compromisso cumprido',
    valor: p.valor,
  });
  if (c) c.status = 'liberada';
  p.status = 'executada';
  const tx = pushTx(state, 'LIBERAÇÃO',
    `Cofre executou proposta #${p.id}: ${fmt(p.valor)} → conta ${PROVIDER_CARTEIRA} de ${f.resp} (${trunc(f.carteira?.end, 4, 4)})`,
    p.valor, { propostaId: p.id });
  p.signature = tx.signature;
}

/* ------------------------------------------------------- estado inicial ---- */
function seed() {
  const state = {
    cofre: {
      endereco: solAddr('cofre-fundo-infancia-boipeba'),
      programa: solAddr('programa-multisig-squads'),
      limiar: 2,
    },
    slot: 4021,
    transacoes: [],
    coletas: [
      { id: 1, coletor: 'Seu Antônio', material: 'Plástico PET', kg: 45, local: 'Praia de Cueira', data: '2026-07-10', status: 'validada', signature: solSig('coleta-1'), familiaId: 3 },
      { id: 2, coletor: 'Dona Nilza', material: 'Vidro', kg: 60, local: 'Velha Boipeba', data: '2026-07-14', status: 'validada', signature: solSig('coleta-2'), familiaId: 1 },
      { id: 3, coletor: 'Grupo Jovem Moreré', material: 'Plástico misto', kg: 38, local: 'Praia de Moreré', data: '2026-07-22', status: 'pendente', signature: null },
    ],
    relatorios: [
      { id: 1, periodo: 'Julho 2026 — quinzena 1', kg: 105, acoes: 2, signature: solSig('rel-1'), data: '2026-07-15' },
    ],
    vendas: [
      { id: 1, tipo: 'produto', descricao: 'Luminária de vidro reaproveitado', comprador: 'Turista (Pousada Mar Azul)', valor: 80, data: '2026-07-16', materiais: ['Vidro'], rastreio: codigoRastreio('rastreio-1-luminaria'), origem: [2] },
      { id: 2, tipo: 'esg', descricao: 'Relatório de Circularidade — Julho Q1', comprador: 'Empresa Costa Verde Ltda.', valor: 2500, data: '2026-07-18' },
    ],
    caixas: { renda: 0, fundo: 0, operacao: 0, fundoLiberado: 0 },
    ciclos: [],   // fechamentos de ciclo (regra 4: residual → ações coletivas)
    familias: [
      {
        id: 1, resp: 'Maria de Lourdes', criancas: 2, saldo: 0,
        carteira: { end: solAddr('familia-1'), provider: 'Picnic', rede: REDE, criadaEm: '2026-07-08', celular: '(75) 9 9124-3311' },
        condicoes: [
          { id: 1, mes: 'Julho', tipo: 'Vacinação em dia (2 crianças)', status: 'liberada' },
          { id: 5, mes: 'Julho', tipo: 'Consulta pediátrica em dia', status: 'pendente' },
        ],
        extrato: [],
      },
      {
        id: 2, resp: 'José Raimundo', criancas: 3, saldo: 0,
        carteira: { end: solAddr('familia-2'), provider: 'Picnic', rede: REDE, criadaEm: '2026-07-09', celular: '(75) 9 8871-0456' },
        condicoes: [
          { id: 3, mes: 'Julho', tipo: 'Matrícula escolar (3 crianças)', status: 'aguardando-assinaturas' },
        ],
        extrato: [],
      },
      {
        id: 3, resp: 'Ana Cláudia', criancas: 1, saldo: 0,
        carteira: null,
        condicoes: [
          { id: 4, mes: 'Julho', tipo: 'Acompanhamento de saúde (1 criança)', status: 'validada-aguardando' },
        ],
        extrato: [],
      },
    ],
    propostas: [
      { id: 1, familiaId: 2, condicaoId: 3, valor: BONUS_POR_CRIANCA * 3, assinaturas: ['viva'], status: 'aguardando', signature: null },
      { id: 2, familiaId: 3, condicaoId: 4, valor: BONUS_POR_CRIANCA * 1, assinaturas: [], status: 'reservada', signature: null },
    ],
    nextId: 100, // mantido só para estados salvos antes de novoId(); não é mais usado
  };

  /* história registrada na cadeia (na ordem em que aconteceu) */
  pushTx(state, 'GÊNESE', `Cofre multisig do Fundo Infância implantado na ${REDE} — limiar 2 de 3 (Instituto Vivá, DeTrash, Representante Comunitário)`, 0);
  pushTx(state, 'CARTEIRA', `Carteira Picnic (${REDE}) conectada para família de Maria de Lourdes — sem dados pessoais on-chain`, 0);
  pushTx(state, 'CARTEIRA', `Carteira Picnic (${REDE}) conectada para família de José Raimundo — sem dados pessoais on-chain`, 0);
  pushTx(state, 'VALIDAÇÃO', 'Coleta validada (DeTrash): 45 kg de Plástico PET — Praia de Cueira', 0);
  pushTx(state, 'VALIDAÇÃO', 'Coleta validada (DeTrash): 60 kg de Vidro — Velha Boipeba', 0);
  pushTx(state, 'CIRCULARIDADE', 'Relatório de Circularidade emitido: 105 kg validados (Julho 2026 — quinzena 1)', 0);
  for (const v of state.vendas) aplicarSplit(state, v);

  // bônus de vacinação da Maria já executado pelo cofre (2 assinaturas colhidas antes)
  const bonusMaria = BONUS_POR_CRIANCA * 2;
  state.caixas.fundo -= bonusMaria;
  state.caixas.fundoLiberado += bonusMaria;
  state.familias[0].saldo += bonusMaria;
  state.familias[0].extrato.push({ ts: Date.now() - 86400000 * 5, desc: 'Bônus de julho — vacinação em dia', valor: bonusMaria });
  pushTx(state, 'LIBERAÇÃO', `Cofre executou proposta: ${fmt(bonusMaria)} → conta Picnic de Maria de Lourdes (assinaturas: Instituto Vivá + DeTrash)`, bonusMaria);

  pushTx(state, 'PROPOSTA', `Proposta #1 criada: ${fmt(BONUS_POR_CRIANCA * 3)} para José Raimundo — Matrícula escolar validada pelo Instituto Vivá`, 0, { propostaId: 1 });
  pushTx(state, 'ASSINATURA', 'Instituto Vivá assinou a proposta #1 (1 de 2 necessárias)', 0, { propostaId: 1, signatario: 'viva' });
  pushTx(state, 'RESERVA', `Comprovação de Ana Cláudia validada — ${fmt(BONUS_POR_CRIANCA)} reservado (família ainda sem conta ${PROVIDER_CARTEIRA}); liberação retroativa garantida`, 0, { propostaId: 2 });

  return state;
}

/* ---------------------------------------------------------------- reducer ---- */
function reducer(state, action) {
  const s = structuredClone(state);
  switch (action.type) {
    case 'RESET':
      return seed();

    case 'NOVA_COLETA': {
      /* familiaId e OPCIONAL: coletor pode nao ser de familia participante. Sem
         ele a renda fica so no total do projeto, e o Mercado mostra isso. */
      s.coletas.push({ id: novoId(), ...action.payload, status: 'pendente', signature: null });
      return s;
    }

    case 'VALIDAR_COLETA': {
      const c = s.coletas.find(c => c.id === action.id);
      if (c && c.status === 'pendente') {
        c.status = 'validada';
        const tx = pushTx(s, 'VALIDAÇÃO', `Coleta validada (DeTrash): ${c.kg} kg de ${c.material} — ${c.local}`, 0);
        c.signature = tx.signature;
      }
      return s;
    }

    case 'ANCORAR_RELATORIO': {
      // Registro REAL na Solana devnet, feito por onchain/ancorar-relatorio.mjs.
      // Guardamos só o que é público: hash do relatório e assinatura da transação.
      const rel = s.relatorios.find(r => r.id === action.id);
      if (rel && action.txId && !rel.ancoragem) {
        rel.ancoragem = {
          rede: 'Solana devnet',
          hash: action.hash,
          txId: action.txId,
          url: `https://explorer.solana.com/tx/${action.txId}?cluster=devnet`,
          em: Date.now(),
        };
        pushTx(s, 'ANCORAGEM',
          `Relatório "${rel.periodo}" ancorado na Solana devnet: ${rel.kg} kg — SHA-256 ${String(action.hash).slice(0, 16)}…`,
          0, { relatorioId: rel.id, real: true, txExterna: action.txId, urlExterna: rel.ancoragem.url });
      }
      return s;
    }

    case 'EMITIR_RELATORIO': {
      const validadas = s.coletas.filter(c => c.status === 'validada');
      const kg = validadas.reduce((a, c) => a + Number(c.kg), 0);
      const tx = pushTx(s, 'CIRCULARIDADE', `Relatório de Circularidade emitido: ${kg} kg validados (${action.periodo})`, 0);
      s.relatorios.push({ id: novoId(), periodo: action.periodo, kg, acoes: validadas.length, signature: tx.signature, data: new Date().toISOString().slice(0, 10) });
      return s;
    }

    case 'NOVA_VENDA': {
      const venda = { id: novoId(), ...action.payload, data: new Date().toISOString().slice(0, 10) };
      // peça física leva etiqueta com QR: o turista escaneia e vê de onde veio o material
      if (venda.tipo === 'produto') {
        venda.rastreio = codigoRastreio('rastreio-' + venda.id + '-' + venda.descricao);
        venda.origem = coletasDeOrigem(s, venda.materiais);
      }
      s.vendas.push(venda);
      aplicarSplit(s, venda);
      return s;
    }

    /* -------------------------------------------- execução no cofre real -- */
    /* Comprovante de que a liberação desta proposta aconteceu de fato na
       devnet, com 2 de 3 organizações assinando. A assinatura vem colada pela
       operação depois de rodar onchain/liberar-bonus.mjs — o app não tem (nem
       pode ter) chave privada para assinar sozinho. */
    case 'REGISTRAR_EXECUCAO_ONCHAIN': {
      const p = s.propostas.find(p => p.id === action.propostaId);
      if (p && action.txId) {
        p.execucaoOnchain = {
          rede: 'Solana devnet',
          txId: action.txId,
          url: `https://explorer.solana.com/tx/${action.txId}?cluster=devnet`,
          em: new Date().toISOString(),
        };
        const f = s.familias.find(f => f.id === p.familiaId);
        pushTx(s, 'LIBERAÇÃO',
          `Liberação de ${fmt(p.valor)}${f ? ` para ${f.resp}` : ''} executada NA REDE pelo cofre 2-de-3 — registro real`,
          0, { propostaId: p.id, familiaId: p.familiaId, real: true });
      }
      return s;
    }

    /* ------------------------------- regra 4: fechamento de ciclo --------- */
    /* Saldo residual → ações coletivas definidas com a comunidade.
       A decisão é da assembleia; o que fica registrado aqui (e ancorado) é a
       PROVA de qual decisão foi tomada, com qual valor. Um contrato que
       distribuísse o residual sozinho tomaria a decisão no lugar das pessoas. */
    case 'FECHAR_CICLO': {
      const valor = Number(action.valor || 0);
      if (valor > 0 && action.acao) {
        s.ciclos = [...(s.ciclos || []), {
          id: novoId(),
          ciclo: action.ciclo || new Date().toISOString().slice(0, 7),
          acao: action.acao,
          valor,
          comoFoiDecidido: action.comoFoiDecidido || 'assembleia comunitária',
          participantes: action.participantes || '',
          data: new Date().toISOString().slice(0, 10),
          hash: action.hash || '',
          ancoragem: null,
        }];
        s.caixas.fundo = Number((s.caixas.fundo - valor).toFixed(2));
        pushTx(s, 'RESERVA',
          `Fechamento de ciclo: ${fmt(valor)} do saldo residual destinado a "${action.acao}" — decidido em ${action.comoFoiDecidido || 'assembleia comunitária'}`,
          valor, { cicloId: s.ciclos[s.ciclos.length - 1].id });
      }
      return s;
    }

    case 'ANCORAR_DECISAO': {
      const c = (s.ciclos || []).find(c => c.id === action.cicloId);
      if (c && action.txId) {
        c.ancoragem = {
          rede: 'Solana devnet',
          hash: c.hash,
          txId: action.txId,
          url: `https://explorer.solana.com/tx/${action.txId}?cluster=devnet`,
        };
        pushTx(s, 'ANCORAGEM',
          `Decisão coletiva do ciclo ${c.ciclo} ancorada na Solana devnet — prova pública de "${c.acao}"`,
          0, { cicloId: c.id, real: true });
      }
      return s;
    }

    /* Aviso no WhatsApp quando o bônus cai. Opt-in, e o registro fica no
       aparelho: antes a família só descobria que o dinheiro chegou abrindo o app
       por acaso — e ninguém abre um app todo dia para conferir. */
    case 'AVISO_WHATSAPP': {
      const f = s.familias.find(f => f.id === action.familiaId);
      if (f) f.avisarWhatsapp = Boolean(action.ligar);
      return s;
    }

    /* ---------------------------------------------------------- PIN ------- */
    /* Define o PIN na primeira entrada. Recebe já o hash e o sal: o reducer é
       sincrono e o hash é assíncrono (Web Crypto), então quem chama calcula. */
    case 'DEFINIR_PIN': {
      const f = s.familias.find(f => f.id === action.familiaId);
      if (f && action.hash && action.sal) {
        f.pin = { hash: action.hash, sal: action.sal, definidoEm: new Date().toISOString(), tentativas: 0, bloqueado: false };
      }
      return s;
    }

    /* Tentativa errada conta; ao chegar no limite, bloqueia. O bloqueio é local
       e só o agente de campo destrava — de propósito: recuperação automática por
       SMS seria mais um canal para falhar em cima de quem tem menos recurso. */
    case 'PIN_ERRADO': {
      const f = s.familias.find(f => f.id === action.familiaId);
      if (f?.pin) {
        f.pin.tentativas = (f.pin.tentativas || 0) + 1;
        if (f.pin.tentativas >= MAX_TENTATIVAS_PIN) f.pin.bloqueado = true;
      }
      return s;
    }

    case 'PIN_CERTO': {
      const f = s.familias.find(f => f.id === action.familiaId);
      if (f?.pin) { f.pin.tentativas = 0; f.pin.bloqueado = false; }
      return s;
    }

    /* Destravar é ato do agente, presencialmente, e apaga o PIN: a família
       escolhe um novo. O agente nunca vê nem escolhe o PIN de ninguém. */
    case 'DESTRAVAR_PIN': {
      const f = s.familias.find(f => f.id === action.familiaId);
      if (f) {
        f.pin = null;
        pushTx(s, 'CONSENTIMENTO',
          `PIN da família de ${f.resp} destravado pelo agente de campo — a família define um novo no próximo acesso`,
          0, { familiaId: f.id });
      }
      return s;
    }

    /* ------------------------------------------------- consentimento ----- */
    /* Registro do consentimento do responsável (LGPD art. 8º: específico,
       informado e DEMONSTRÁVEL). Nada de família vai para a nuvem sem isto —
       ver policies em supabase/migracao-02. Aqui não guardo assinatura
       digitalizada nem documento: guardo a forma e o hash do termo exato. */
    case 'REGISTRAR_CONSENTIMENTO': {
      const f = s.familias.find(f => f.id === action.familiaId);
      /* renovar é permitido: cria registro NOVO apontando para o anterior, sem
         alterar o antigo — o histórico de prazos tem de continuar legível. */
      const anterior = consentimentoMaisRecente(f);
      if (f && !consentimentoAtivo(f)) {
        const validade = action.validadeMeses || VALIDADE_MESES;
        f.consentimentos = [...(f.consentimentos || []), {
          id: novoId(),
          versaoTermo: action.versaoTermo || VERSAO_TERMO,
          finalidades: action.finalidades || FINALIDADES_PADRAO,
          forma: action.forma || 'presencial-assinado',
          termoHash: action.termoHash || '',
          coletadoPor: action.coletadoPor || null,
          coletadoEm: new Date().toISOString(),
          validadeMeses: validade,
          revogadoEm: null,
          renovadoDe: anterior?.id ?? null,
        }];
        const renovacao = anterior ? 'renovado' : 'registrado';
        pushTx(s, 'CONSENTIMENTO',
          `Consentimento ${renovacao} para a família de ${f.resp} (${action.forma || 'presencial-assinado'}) — termo ${action.versaoTermo || VERSAO_TERMO}, válido por ${validade} meses`,
          0, { familiaId: f.id });
      }
      return s;
    }

    /* Revogar é direito do titular, e tem de ser tão fácil quanto conceder.
       Revogado, o dado da família para de subir e sai da leitura na nuvem. */
    case 'REVOGAR_CONSENTIMENTO': {
      const f = s.familias.find(f => f.id === action.familiaId);
      const c = (f?.consentimentos || []).find(c => !c.revogadoEm);
      if (c) {
        c.revogadoEm = new Date().toISOString();
        c.revogadoMotivo = action.motivo || '';
        pushTx(s, 'CONSENTIMENTO',
          `Consentimento REVOGADO pela família de ${f.resp} — dados deixam de ser compartilhados`,
          0, { familiaId: f.id });
      }
      return s;
    }

    case 'CRIAR_CARTEIRA': {
      const f = s.familias.find(f => f.id === action.id);
      if (f && !f.carteira) {
        const provider = action.provider || PROVIDER_CARTEIRA;
        f.carteira = { end: solAddr('familia-' + f.id + '-' + Date.now()), provider, rede: REDE, criadaEm: new Date().toISOString().slice(0, 10), celular: action.celular || '' };
        pushTx(s, 'CARTEIRA', `Carteira ${provider} (${REDE}) conectada para família de ${f.resp} — sem dados pessoais on-chain`, 0);
        // liberação retroativa: propostas reservadas desta família voltam à fila de assinatura
        for (const p of s.propostas.filter(p => p.status === 'reservada' && p.familiaId === f.id)) {
          if (disponivelCofre(s) >= p.valor) {
            p.status = 'aguardando';
            const c = f.condicoes.find(c => c.id === p.condicaoId);
            if (c) c.status = 'aguardando-assinaturas';
            pushTx(s, 'PROPOSTA', `Proposta #${p.id} reativada (retroativa): ${fmt(p.valor)} para ${f.resp} — conta conectada`, 0, { propostaId: p.id });
          }
        }
      }
      return s;
    }

    case 'ENVIAR_COMPROVACAO': {
      const f = s.familias.find(f => f.id === action.familiaId);
      const c = f?.condicoes.find(c => c.id === action.condicaoId);
      if (c && c.status === 'pendente') {
        c.status = 'comprovada'; // só o hash chega aqui; o arquivo fica no aparelho da família
        if (action.evidHash) { c.evidHash = action.evidHash; c.arquivo = action.arquivo || ''; }
      }
      return s;
    }

    case 'VALIDAR_CONDICAO': {
      const f = s.familias.find(f => f.id === action.familiaId);
      const c = f?.condicoes.find(c => c.id === action.condicaoId);
      if (f && c && c.status === 'comprovada') {
        const valor = BONUS_POR_CRIANCA * f.criancas;
        const p = { id: novoId(), familiaId: f.id, condicaoId: c.id, valor, assinaturas: [], status: 'aguardando', signature: null };
        if (f.carteira && disponivelCofre(s) >= valor) {
          c.status = 'aguardando-assinaturas';
          s.propostas.push(p);
          const evid = c.evidHash ? `evidência sha256:${c.evidHash.slice(0, 12)}…` : 'hash off-chain';
          pushTx(s, 'PROPOSTA', `Proposta #${p.id} criada: ${fmt(valor)} para ${f.resp} — ${c.tipo} validada pelo Instituto Vivá (${evid})`, 0, { propostaId: p.id });
        } else {
          c.status = 'validada-aguardando';
          p.status = 'reservada';
          s.propostas.push(p);
          pushTx(s, 'RESERVA', `Comprovação de ${f.resp} validada — ${fmt(valor)} reservado (${!f.carteira ? `sem conta ${PROVIDER_CARTEIRA}` : 'cofre sem saldo livre'}); liberação retroativa garantida`, 0, { propostaId: p.id });
        }
      }
      return s;
    }

    case 'ASSINAR_PROPOSTA': {
      const p = s.propostas.find(p => p.id === action.propostaId);
      if (p && p.status === 'aguardando' && !p.assinaturas.includes(action.signatario)) {
        p.assinaturas.push(action.signatario);
        const sig = signatarioPor(action.signatario);
        pushTx(s, 'ASSINATURA', `${sig?.nome || action.signatario} assinou a proposta #${p.id} (${p.assinaturas.length} de ${s.cofre.limiar} necessárias)`, 0, { propostaId: p.id, signatario: action.signatario });
        if (p.assinaturas.length >= s.cofre.limiar) executarProposta(s, p);
      }
      return s;
    }

    case 'SACAR_PIX': {
      const f = s.familias.find(f => f.id === action.id);
      const v = Math.min(action.valor, f?.saldo ?? 0);
      if (f && v > 0) {
        f.saldo -= v;
        f.extrato.push({ ts: Date.now(), desc: 'Retirada pelo Pix', valor: -v });
        pushTx(s, 'SAQUE', `Conversão ${MOEDA}→BRL via Pix — ${fmt(v)} para a família de ${f.resp} (ponte ${PROVIDER_CARTEIRA})`, v);
      }
      return s;
    }

    default:
      return state;
  }
}

/* seed e reducer são exportados para os testes exercitarem as regras de
   negócio sem subir a UI (ver testes/fluxo.mjs) */
export { seed as estadoInicial, reducer };

/* --------------------------------------------------------------- provider ---- */
const Ctx = createContext(null);

/** Versionamento para a sincronização multi-aparelho: cada ação incrementa v. */
function reducerRaiz(state, action) {
  if (action.type === 'SUBSTITUIR_ESTADO') return action.estado;
  const s = reducer(state, action);
  if (s !== state) s.v = (state?.v || 0) + 1;
  return s;
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducerRaiz, null, () => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const s = JSON.parse(saved);
        if (s && s.cofre && s.transacoes) return s; // ignora estados de versões antigas
      }
    } catch (e) { /* segue com o seed */ }
    return seed();
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* sem persistência */ }
  }, [state]);

  /* ------------------------------------------------------------------------
     Sincronização multi-aparelho — tabelas por entidade, registro append-only.

     Local-first de propósito: o app já renderizou com o estado local antes de
     qualquer rede acontecer. Sem public/supabase.json, nada disto roda e o app
     é 100% offline. Ver SUPABASE.md e src/sincronizacao.js.
  ------------------------------------------------------------------------ */
  const [nuvemAtiva, setNuvemAtiva] = useState(false);
  const [fila, setFila] = useState(0);
  const anteriorRef = useRef(state);
  const stateRef = useRef(state);
  stateRef.current = state;

  /* 1. configura e traz o que já existe na nuvem */
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!(await nuvem.configurar())) return;
      if (!vivo) return;
      setNuvemAtiva(true);
      try {
        const remoto = await nuvem.carregar();
        if (vivo && sinc.nuvemDifere(stateRef.current, remoto)) {
          const mesclado = sinc.mesclar(stateRef.current, remoto);
          anteriorRef.current = mesclado; // não reenviar o que veio de lá
          dispatch({ type: 'SUBSTITUIR_ESTADO', estado: mesclado });
        }
      } catch (e) { /* offline no boot: segue local, a fila resolve depois */ }
    })();
    return () => { vivo = false; };
  }, []);

  /* 2. cada mudança local vira delta na fila e tenta subir (otimista) */
  useEffect(() => {
    if (!nuvemAtiva) return;
    const antes = anteriorRef.current;
    anteriorRef.current = state;
    if (antes === state) return;

    const ops = sinc.calcularDeltas(antes, state);
    if (!ops.length) return;
    sinc.enfileirar(ops);
    setFila(sinc.tamanhoFila());
    sinc.escoarFila().then(r => setFila(r.restantes));
  }, [state, nuvemAtiva]);

  /* 3. de tempo em tempo: reenvia o que ficou preso e busca o que os outros
        aparelhos fizeram. Só substitui quando a fila está vazia, para não
        descartar trabalho local ainda não enviado. */
  useEffect(() => {
    if (!nuvemAtiva) return;
    const bater = async () => {
      const r = await sinc.escoarFila();
      setFila(r.restantes);
      if (r.restantes > 0) return;
      try {
        // sempre baixa e compara por impressão digital: contar transações não
        // servia, porque coleta nova não gera transação (ver sincronizacao.js)
        const remoto = await nuvem.carregar();
        if (sinc.nuvemDifere(stateRef.current, remoto)) {
          const mesclado = sinc.mesclar(stateRef.current, remoto);
          anteriorRef.current = mesclado;
          dispatch({ type: 'SUBSTITUIR_ESTADO', estado: mesclado });
        }
      } catch (e) { /* segue local */ }
    };
    const id = setInterval(bater, 8000);
    return () => clearInterval(id);
  }, [nuvemAtiva]);

  return (
    <Ctx.Provider value={{ state, dispatch, sincronizado: nuvemAtiva, pendentes: fila }}>
      {children}
    </Ctx.Provider>
  );
}

export const useStore = () => useContext(Ctx);
