/* ---------------------------------------------------------------------------
   Cliente do modelo compartilhado (Supabase REST) — tabelas por entidade,
   registro append-only, saldo derivado de soma.

   Ver SUPABASE.md para o raciocínio e supabase/schema.sql para o esquema.

   ── ESTADO ────────────────────────────────────────────────────────────────
   Escrito e revisado, mas o store ainda NÃO usa este módulo: a sincronização
   por blob antiga continua ativa em store.jsx. Não liguei porque não tenho um
   projeto Supabase para exercitar, e sincronização não testada é pior que
   sincronização ausente.

   ── PLANO DE MIGRAÇÃO (na ordem) ──────────────────────────────────────────
   1. `carregar()` no boot: se houver configuração, monta o estado a partir das
      tabelas; se não, segue com a seed local. O app continua local-first.
   2. Para cada action do reducer, chamar o `registrar*` correspondente DEPOIS
      do dispatch local (otimista). Falha de rede não bloqueia a UI: a ação já
      valeu localmente e entra na fila.
   3. Fila de reenvio em localStorage para o modo offline do campo (o service
      worker já cobre o carregamento do app; isto cobre os dados).
   4. Realtime (`supabase.channel`) em vez do polling de 7 s, para o Vivá ver a
      coleta aparecer sem recarregar.
   5. Só então remover o bloco de blob de store.jsx.

   Teste que vale antes de confiar: dois navegadores, um deles offline durante
   uma validação, e conferir que nada se perde quando ele volta.
--------------------------------------------------------------------------- */

let cfg = null;

/** Lê public/supabase.json. Sem o arquivo, tudo aqui vira no-op silencioso. */
export async function configurar() {
  if (cfg !== null) return cfg;
  try {
    const r = await fetch('./supabase.json');
    const j = r.ok ? await r.json() : null;
    cfg = j?.url && j?.anonKey ? j : false;
  } catch {
    cfg = false;
  }
  return cfg;
}

export const ativo = () => Boolean(cfg);

function cabecalhos(extra = {}) {
  return {
    apikey: cfg.anonKey,
    Authorization: 'Bearer ' + cfg.anonKey,
    'content-type': 'application/json',
    ...extra,
  };
}

async function req(caminho, opcoes = {}) {
  if (!(await configurar())) return null;
  const r = await fetch(`${cfg.url}/rest/v1/${caminho}`, { ...opcoes, headers: cabecalhos(opcoes.headers) });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.status === 204 ? null : r.json();
}

const ler = (tabela, query = '') => req(`${tabela}?${query || 'select=*'}`);

/** INSERT que não falha se a linha já existe — usado nas tabelas append-only. */
const inserir = (tabela, linhas) => req(tabela, {
  method: 'POST',
  headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
  body: JSON.stringify(Array.isArray(linhas) ? linhas : [linhas]),
});

/** UPSERT dirigido a uma linha — usado nas entidades operacionais. */
const gravar = (tabela, linhas) => req(tabela, {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify(Array.isArray(linhas) ? linhas : [linhas]),
});

const atualizar = (tabela, filtro, campos) => req(`${tabela}?${filtro}`, {
  method: 'PATCH',
  headers: { Prefer: 'return=minimal' },
  body: JSON.stringify(campos),
});

/* --------------------------------------------------------------- leitura ---- */

/** Monta o estado do app a partir das tabelas. Uma ida por entidade. */
export async function carregar() {
  if (!(await configurar())) return null;

  const [familias, condicoes, coletas, relatorios, vendas, propostas, transacoes, saldos, extrato, saldoFam] =
    await Promise.all([
      ler('familias', 'select=*&order=id'),
      ler('condicoes', 'select=*&order=id'),
      ler('coletas', 'select=*&order=id'),
      ler('relatorios', 'select=*&order=id'),
      ler('vendas', 'select=*&order=id'),
      ler('propostas_com_assinaturas', 'select=*&order=id'),
      ler('transacoes', 'select=*&order=seq'),
      ler('saldos', 'select=*'),
      ler('extrato', 'select=*&order=id'),
      ler('saldo_familia', 'select=*'),
    ]);

  const caixa = c => Number(saldos?.find(s => s.caixa === c)?.saldo ?? 0);

  return {
    coletas: coletas.map(c => ({ ...c, kg: Number(c.kg) })),
    relatorios,
    vendas,
    propostas: propostas.map(p => ({
      ...p,
      valor: Number(p.valor),
      assinaturas: p.quem_assinou ?? [],
    })),
    transacoes: transacoes.map(t => ({
      seq: Number(t.seq), slot: Number(t.slot), tipo: t.tipo, desc: t.descricao,
      valor: Number(t.valor), signature: t.signature, prevSignature: t.prev_signature,
      taxa: t.taxa == null ? undefined : Number(t.taxa),
      ts: new Date(t.ts).getTime(), ...(t.meta || {}),
    })),
    caixas: {
      renda: caixa('renda'),
      fundo: caixa('fundo'),
      operacao: caixa('operacao'),
      fundoLiberado: caixa('fundo_liberado'),
    },
    familias: familias.map(f => ({
      id: Number(f.id),
      codigo: f.codigo,
      criancas: f.criancas,
      carteira: f.carteira_end
        ? { end: f.carteira_end, provider: f.carteira_prov, rede: f.carteira_rede, criadaEm: f.criado_em?.slice(0, 10) }
        : null,
      saldo: Number(saldoFam?.find(s => Number(s.familia_id) === Number(f.id))?.saldo ?? 0),
      condicoes: condicoes.filter(c => Number(c.familia_id) === Number(f.id)),
      extrato: extrato
        .filter(e => Number(e.familia_id) === Number(f.id))
        .map(e => ({ ts: new Date(e.criado_em).getTime(), desc: e.descricao, valor: Number(e.valor) })),
    })),
  };
}

/* --------------------------------------------------------------- escrita ---- */
/* Cada função corresponde a uma action do reducer. A ordem importa: a
   transação entra antes dos movimentos que a referenciam.                    */

export const registrarColeta = c => gravar('coletas', {
  id: c.id, coletor: c.coletor, material: c.material, kg: c.kg, local: c.local,
  data: c.data, status: c.status, signature: c.signature,
  geo_lat: c.geo?.lat ?? null, geo_lng: c.geo?.lng ?? null, evid_hash: c.evidHash ?? null,
});

export const marcarColetaValidada = (id, signature) =>
  atualizar('coletas', `id=eq.${id}`, { status: 'validada', signature });

export const registrarRelatorio = r => gravar('relatorios', {
  id: r.id, periodo: r.periodo, kg: r.kg, acoes: r.acoes,
  signature: r.signature, data: r.data, ancoragem: r.ancoragem ?? null,
});

export const registrarVenda = v => gravar('vendas', {
  id: v.id, tipo: v.tipo, descricao: v.descricao, comprador: v.comprador,
  valor: v.valor, data: v.data, rastreio: v.rastreio ?? null, origem: v.origem ?? null,
});

export const registrarCondicao = (familiaId, c) => gravar('condicoes', {
  id: c.id, familia_id: familiaId, mes: c.mes, tipo: c.tipo, status: c.status,
  evid_hash: c.evidHash ?? null, arquivo: c.arquivo ?? null,
});

export const atualizarCondicao = (id, campos) =>
  atualizar('condicoes', `id=eq.${id}`, { ...campos, atualizado_em: new Date().toISOString() });

export const registrarCarteira = f => atualizar('familias', `id=eq.${f.id}`, {
  carteira_end: f.carteira.end,
  carteira_prov: f.carteira.provider,
  carteira_rede: f.carteira.rede,
});

export const registrarProposta = p => gravar('propostas', {
  id: p.id, familia_id: p.familiaId, condicao_id: p.condicaoId,
  valor: p.valor, status: p.status, signature: p.signature ?? null,
});

export const atualizarProposta = (id, campos) => atualizar('propostas', `id=eq.${id}`, campos);

/** Append-only: a PK (proposta, signatário) faz a idempotência no banco. */
export const registrarAssinatura = (propostaId, signatario) =>
  inserir('assinaturas', { proposta_id: propostaId, signatario });

/** Append-only: `signature` é unique, então reenvio não duplica. */
export const registrarTransacao = t => inserir('transacoes', {
  seq: t.seq, slot: t.slot, tipo: t.tipo, descricao: t.desc, valor: t.valor,
  signature: t.signature, prev_signature: t.prevSignature, taxa: t.taxa ?? null,
  ts: new Date(t.ts).toISOString(),
  meta: Object.fromEntries(Object.entries(t).filter(([k]) =>
    !['seq', 'slot', 'tipo', 'desc', 'valor', 'signature', 'prevSignature', 'taxa', 'ts'].includes(k))),
});

/** Movimento de caixa. Nunca gravamos saldo — só o que entrou ou saiu. */
export const registrarMovimento = (caixa, valor, motivo, transacaoSeq = null) =>
  inserir('movimentos', { caixa, valor, motivo, transacao_seq: transacaoSeq });

/** Linha do extrato da família. Idem: o saldo dela é a soma disto. */
export const registrarExtrato = (familiaId, descricao, valor, transacaoSeq = null) =>
  inserir('extrato', { familia_id: familiaId, descricao, valor, transacao_seq: transacaoSeq });
