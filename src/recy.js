/* ---------------------------------------------------------------------------
   Ancoragem do Relatório de Circularidade na Rede Recy (real).

   O resto do app é simulado de propósito — roda offline, é repetível e
   resetável. Isto aqui é o único ponto que fala com uma rede de verdade, e
   fala com o nosso próprio proxy (functions/api/ancorar.js), nunca direto com
   a Recy: a chave não pode existir no navegador.

   Regra de ouro: se a ancoragem falhar por qualquer motivo — sem rede, proxy
   não configurado, Recy fora do ar — o app continua funcionando normalmente.
   A ancoragem é um bônus verificável, não um pré-requisito.
--------------------------------------------------------------------------- */

const ENDPOINT = '/api/ancorar';
const TEMPO_LIMITE = 12000;

/** SHA-256 real (Web Crypto) do conteúdo canônico do relatório, em hex. */
export async function hashRelatorio(rel) {
  const canonico = [
    'raizes-do-futuro/relatorio-circularidade/v1',
    rel.periodo,
    rel.kg,
    rel.acoes,
    rel.data,
  ].join('|');

  const bytes = new TextEncoder().encode(canonico);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function comLimite(promessa, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await promessa(ctrl.signal); } finally { clearTimeout(t); }
}

/** A ancoragem está disponível? Consulta o proxy sem tentar escrever nada. */
export async function statusAncoragem() {
  try {
    const r = await comLimite(sinal => fetch(ENDPOINT, { signal: sinal }), 5000);
    if (!r.ok) return { disponivel: false, motivo: 'proxy-indisponivel' };
    return await r.json();
  } catch (e) {
    // sem proxy (rodando só `npm run dev`) ou sem rede: modo simulado puro
    return { disponivel: false, motivo: 'offline' };
  }
}

/**
 * Ancora um relatório. Devolve sempre um objeto — nunca lança —
 * para quem chama poder seguir o fluxo mesmo em caso de falha.
 */
export async function ancorarRelatorio(rel) {
  let hash;
  try {
    hash = await hashRelatorio(rel);
  } catch (e) {
    // crypto.subtle exige contexto seguro (https ou localhost)
    return { ok: false, motivo: 'sem-crypto-subtle' };
  }

  try {
    const r = await comLimite(sinal => fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hash, periodo: rel.periodo, kg: rel.kg, acoes: rel.acoes }),
      signal: sinal,
    }), TEMPO_LIMITE);

    const corpo = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, motivo: corpo.erro || 'falhou', faltando: corpo.faltando, hash };

    return { ok: true, hash, txId: corpo.txId, url: corpo.url, rede: corpo.rede, ts: corpo.ts };
  } catch (e) {
    return { ok: false, motivo: 'offline', hash };
  }
}

/** Texto curto para explicar ao usuário por que não ancorou. */
export const motivoLegivel = motivo => ({
  'offline': 'sem conexão com o proxy de ancoragem',
  'proxy-indisponivel': 'proxy de ancoragem não respondeu',
  'nao-configurado': 'chave da Recy não configurada no servidor',
  'contrato-incompleto': 'endpoint da Recy ainda não definido',
  'recy-recusou': 'a Recy recusou o registro',
  'hash-invalido': 'hash do relatório inválido',
  'sem-crypto-subtle': 'navegador sem Web Crypto (use https ou localhost)',
}[motivo] || 'motivo desconhecido');
