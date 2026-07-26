import React, { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react';

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
};
export const tipoTx = t => TIPOS_TX[t] || { rot: t, cor: '#6b7a70' };

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
  pushTx(state, 'RECEITA', `${venda.descricao} — ${venda.comprador} (${fmt(venda.valor)}) → split 60/25/15`, venda.valor);
}

/** Executa uma proposta que atingiu o limiar: transfere o bônus para a família. */
function executarProposta(state, p) {
  const f = state.familias.find(f => f.id === p.familiaId);
  const c = f?.condicoes.find(c => c.id === p.condicaoId);
  if (!f || state.caixas.fundo < p.valor) return;
  state.caixas.fundo -= p.valor;
  state.caixas.fundoLiberado += p.valor;
  f.saldo += p.valor;
  f.extrato.push({ ts: Date.now(), desc: `Bônus Fundo Infância — ${c ? `${c.tipo} (${c.mes})` : 'compromisso cumprido'}`, valor: p.valor });
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
      { id: 1, coletor: 'Seu Antônio', material: 'Plástico PET', kg: 45, local: 'Praia de Cueira', data: '2026-07-10', status: 'validada', signature: solSig('coleta-1') },
      { id: 2, coletor: 'Dona Nilza', material: 'Vidro', kg: 60, local: 'Velha Boipeba', data: '2026-07-14', status: 'validada', signature: solSig('coleta-2') },
      { id: 3, coletor: 'Grupo Jovem Moreré', material: 'Plástico misto', kg: 38, local: 'Praia de Moreré', data: '2026-07-22', status: 'pendente', signature: null },
    ],
    relatorios: [
      { id: 1, periodo: 'Julho 2026 — quinzena 1', kg: 105, acoes: 2, signature: solSig('rel-1'), data: '2026-07-15' },
    ],
    vendas: [
      { id: 1, tipo: 'produto', descricao: 'Luminária de vidro reaproveitado', comprador: 'Turista (Pousada Mar Azul)', valor: 80, data: '2026-07-16' },
      { id: 2, tipo: 'esg', descricao: 'Relatório de Circularidade — Julho Q1', comprador: 'Empresa Costa Verde Ltda.', valor: 2500, data: '2026-07-18' },
    ],
    caixas: { renda: 0, fundo: 0, operacao: 0, fundoLiberado: 0 },
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
    nextId: 100,
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
  state.familias[0].extrato.push({ ts: Date.now() - 86400000 * 5, desc: 'Bônus Fundo Infância — Vacinação em dia (Julho)', valor: bonusMaria });
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
      s.coletas.push({ id: s.nextId++, ...action.payload, status: 'pendente', signature: null });
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

    case 'EMITIR_RELATORIO': {
      const validadas = s.coletas.filter(c => c.status === 'validada');
      const kg = validadas.reduce((a, c) => a + Number(c.kg), 0);
      const tx = pushTx(s, 'CIRCULARIDADE', `Relatório de Circularidade emitido: ${kg} kg validados (${action.periodo})`, 0);
      s.relatorios.push({ id: s.nextId++, periodo: action.periodo, kg, acoes: validadas.length, signature: tx.signature, data: new Date().toISOString().slice(0, 10) });
      return s;
    }

    case 'NOVA_VENDA': {
      const venda = { id: s.nextId++, ...action.payload, data: new Date().toISOString().slice(0, 10) };
      s.vendas.push(venda);
      aplicarSplit(s, venda);
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
        c.status = 'comprovada'; // documento fica no ambiente seguro (off-chain)
        if (action.evidHash) { c.evidHash = action.evidHash; c.arquivo = action.arquivo || ''; }
      }
      return s;
    }

    case 'VALIDAR_CONDICAO': {
      const f = s.familias.find(f => f.id === action.familiaId);
      const c = f?.condicoes.find(c => c.id === action.condicaoId);
      if (f && c && c.status === 'comprovada') {
        const valor = BONUS_POR_CRIANCA * f.criancas;
        const p = { id: s.nextId++, familiaId: f.id, condicaoId: c.id, valor, assinaturas: [], status: 'aguardando', signature: null };
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
        f.extrato.push({ ts: Date.now(), desc: 'Retirada via Pix (conversão para reais)', valor: -v });
        pushTx(s, 'SAQUE', `Conversão ${MOEDA}→BRL via Pix — ${fmt(v)} para a família de ${f.resp} (ponte ${PROVIDER_CARTEIRA})`, v);
      }
      return s;
    }

    default:
      return state;
  }
}

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
     Sincronização opcional multi-aparelho (Supabase REST).
     Ativa apenas se public/supabase.json existir com { url, anonKey } —
     ver SUPABASE.md. Sem o arquivo, o app funciona 100% local.
  ------------------------------------------------------------------------ */
  const [cfgSync, setCfgSync] = useState(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    fetch('./supabase.json')
      .then(r => (r.ok ? r.json() : null))
      .then(c => { if (c?.url && c?.anonKey) setCfgSync(c); })
      .catch(() => {});
  }, []);

  // carrega o estado remoto e fica de olho em versões mais novas
  useEffect(() => {
    if (!cfgSync) return;
    const H = { apikey: cfgSync.anonKey, Authorization: 'Bearer ' + cfgSync.anonKey };
    const puxar = async () => {
      try {
        const r = await fetch(`${cfgSync.url}/rest/v1/estado?id=eq.1&select=dados`, { headers: H });
        if (!r.ok) return;
        const linhas = await r.json();
        const remoto = linhas?.[0]?.dados;
        if (remoto?.cofre && (remoto.v || 0) > (stateRef.current.v || 0)) {
          dispatch({ type: 'SUBSTITUIR_ESTADO', estado: remoto });
        }
      } catch (e) { /* offline: segue local */ }
    };
    puxar();
    const id = setInterval(puxar, 7000);
    return () => clearInterval(id);
  }, [cfgSync]);

  // grava alterações locais (com debounce)
  useEffect(() => {
    if (!cfgSync) return;
    const t = setTimeout(() => {
      fetch(`${cfgSync.url}/rest/v1/estado?on_conflict=id`, {
        method: 'POST',
        headers: {
          apikey: cfgSync.anonKey,
          Authorization: 'Bearer ' + cfgSync.anonKey,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({ id: 1, dados: state }),
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [state, cfgSync]);

  return <Ctx.Provider value={{ state, dispatch, sincronizado: !!cfgSync }}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
