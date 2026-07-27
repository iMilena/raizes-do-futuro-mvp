/* ---------------------------------------------------------------------------
   Cliente do modelo compartilhado (Supabase REST) — tabelas por entidade,
   registro append-only, saldo derivado de soma.

   Ver SUPABASE.md para o raciocínio e supabase/schema.sql para o esquema.

   O store usa este módulo desde o commit da sincronização por entidade: o app
   carrega da nuvem no boot, envia deltas a cada ação e reenvia o que ficou preso.
   Sem public/supabase.json nada disto roda e o app é 100% local.
--------------------------------------------------------------------------- */

import * as auth from './auth.js';

let cfg = null;

/* Reexportado para quem usa a nuvem não precisar montar a configuração duas
   vezes: as telas chamam auth pelo módulo, mas os testes e o store pegam daqui. */
export { auth };

/**
 * Lê public/supabase.json. Sem o arquivo, tudo aqui vira no-op silencioso.
 * @param {{url:string, anonKey:string}} [injetada] usado pelos testes, que não
 *        têm um servidor servindo o arquivo.
 */
export async function configurar(injetada) {
  if (injetada?.url && injetada?.anonKey) {
    cfg = { url: injetada.url.replace(/\/$/, ''), anonKey: injetada.anonKey };
    return cfg;
  }
  if (cfg !== null) return cfg;
  try {
    const r = await fetch('./supabase.json');
    const j = r.ok ? await r.json() : null;
    cfg = j?.url && j?.anonKey ? { ...j, url: j.url.replace(/\/$/, '') } : false;
  } catch {
    cfg = false;
  }
  return cfg;
}

/**
 * A nuvem só está ativa com projeto configurado E sessão da operação aberta.
 *
 * Antes bastava o `supabase.json`: a chave anônima lia e escrevia tudo. Desde a
 * migração 02 nenhuma policy responde ao papel anônimo, então falar com a nuvem
 * sem sessão só produziria 401 e fila entupida. Sem sessão, o app é local — que
 * é o modo em que ele foi desenhado para funcionar de qualquer forma.
 */
export const ativo = () => Boolean(cfg) && auth.logado();

/** Configurado, mas ninguém entrou: a interface usa isto para convidar ao login. */
export const configuradoSemSessao = () => Boolean(cfg) && !auth.logado();

export const configuracao = () => cfg;

async function cabecalhos(extra = {}) {
  const t = await auth.token(cfg);
  return {
    apikey: cfg.anonKey,
    // token da pessoa quando há sessão; sem ele o PostgREST trata como `anon`,
    // e desde a migração 02 `anon` não tem policy nenhuma.
    Authorization: 'Bearer ' + (t || cfg.anonKey),
    'content-type': 'application/json',
    ...extra,
  };
}

async function req(caminho, opcoes = {}) {
  if (!(await configurar())) return null;
  const r = await fetch(`${cfg.url}/rest/v1/${caminho}`, { ...opcoes, headers: await cabecalhos(opcoes.headers) });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${texto.slice(0, 160)}`);
  // `Prefer: return=minimal` devolve 201 com corpo VAZIO — não é só o 204.
  if (!texto) return null;
  try { return JSON.parse(texto); } catch { return null; }
}

const ler = (tabela, query = '') => req(`${tabela}?${query || 'select=*'}`);

/**
 * INSERT que não falha se a linha já existe — usado nas tabelas append-only.
 *
 * Duas armadilhas aprendidas na prática:
 *
 * 1. `resolution=ignore-duplicates` só resolve conflito na CHAVE PRIMÁRIA. Para
 *    uma constraint unique (as de idempotência de dinheiro) é preciso declarar
 *    as colunas em `on_conflict`, senão o PostgREST devolve 409.
 * 2. Mesmo assim tratamos 23505 como sucesso: a linha já está lá, que é o
 *    estado desejado. Sem isso, um 409 travaria a fila reenviando para sempre.
 */
const inserir = async (tabela, linhas, onConflict) => {
  const caminho = onConflict ? `${tabela}?on_conflict=${onConflict}` : tabela;
  try {
    return await req(caminho, {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(Array.isArray(linhas) ? linhas : [linhas]),
    });
  } catch (e) {
    if (/23505|duplicate key/i.test(String(e.message))) return null; // já registrado
    throw e;
  }
};

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

/**
 * Cria ou atualiza a família na nuvem. Recebe só o recorte publicável — nome
 * da pessoa não entra aqui (ver LGPD no SUPABASE.md); o que sobe é o `codigo`.
 */
export const registrarFamilia = f => gravar('familias', {
  id: f.id,
  codigo: f.codigo,
  criancas: f.criancas,
  carteira_end: f.carteira?.end ?? null,
  carteira_prov: f.carteira?.provider ?? null,
  carteira_rede: f.carteira?.rede ?? null,
});

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

/** Estado da nuvem só para comparação rápida — evita baixar tudo a cada poll. */
export async function contarTransacoes() {
  if (!(await configurar())) return null;
  const r = await fetch(`${cfg.url}/rest/v1/transacoes?select=seq`, {
    headers: { ...(await cabecalhos()), Prefer: 'count=exact', Range: '0-0' },
  });
  const faixa = r.headers.get('content-range'); // ex.: "0-0/42"
  const total = faixa?.split('/')?.[1];
  return total === '*' || total == null ? null : Number(total);
}

export const registrarProposta = p => gravar('propostas', {
  id: p.id, familia_id: p.familiaId, condicao_id: p.condicaoId,
  valor: p.valor, status: p.status, signature: p.signature ?? null,
});

export const atualizarProposta = (id, campos) => atualizar('propostas', `id=eq.${id}`, campos);

/** Append-only: a PK (proposta, signatário) faz a idempotência no banco. */
export const registrarAssinatura = (propostaId, signatario) =>
  inserir('assinaturas', { proposta_id: propostaId, signatario }, 'proposta_id,signatario');

/**
 * Registro de consentimento do responsável. Vai ANTES da família — a policy
 * `fam_criar` recusa criar família sem consentimento ativo, então esta é
 * literalmente a porta de entrada de qualquer dado de família na nuvem.
 */
export const registrarConsentimento = c => inserir('consentimentos', {
  id: c.id,
  familia_id: c.familiaId,
  versao_termo: c.versaoTermo,
  finalidades: c.finalidades,
  forma: c.forma,
  termo_hash: c.termoHash,
  coletado_por: c.coletadoPor,
});

/** Revogação: direito do titular. Único UPDATE que a policy permite na tabela. */
export const revogarConsentimento = (id, motivo) =>
  atualizar('consentimentos', `id=eq.${id}`, {
    revogado_em: new Date().toISOString(),
    revogado_motivo: motivo || null,
  });

/** Quem sou eu para a nuvem: papel, organização e se assino pelo cofre. */
export async function meuPapel() {
  if (!(await configurar()) || !auth.logado()) return null;
  const r = await req('papeis?select=papel,nome,organizacao,signatario');
  return Array.isArray(r) && r.length ? r[0] : null;
}

/** Append-only: `signature` é unique, então reenvio não duplica. */
export const registrarTransacao = t => inserir('transacoes', {
  seq: t.seq, slot: t.slot, tipo: t.tipo, descricao: t.desc, valor: t.valor,
  signature: t.signature, prev_signature: t.prevSignature, taxa: t.taxa ?? null,
  ts: new Date(t.ts).toISOString(),
  meta: Object.fromEntries(Object.entries(t).filter(([k]) =>
    !['seq', 'slot', 'tipo', 'desc', 'valor', 'signature', 'prevSignature', 'taxa', 'ts'].includes(k))),
});

/** Movimento de caixa. Nunca gravamos saldo — só o que entrou ou saiu. */
export const registrarMovimento = (caixa, valor, motivo, transacaoSig) =>
  inserir('movimentos', { caixa, valor, motivo, transacao_sig: transacaoSig }, 'transacao_sig,caixa');

/** Linha do extrato da família. Idem: o saldo dela é a soma disto. */
export const registrarExtrato = (familiaId, descricao, valor, transacaoSig) =>
  inserir('extrato', { familia_id: familiaId, descricao, valor, transacao_sig: transacaoSig }, 'transacao_sig,familia_id');
