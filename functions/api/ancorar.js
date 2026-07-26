/* ---------------------------------------------------------------------------
   Proxy de ancoragem na Rede Recy — Cloudflare Pages Function.

   Por que isto existe: a chave da Recy NUNCA pode ficar no frontend. Qualquer
   valor que entre no bundle do Vite (inclusive VITE_*) é inlinado em
   dist/assets/*.js e fica legível para qualquer visitante. A chave vive só
   aqui, na variável de ambiente do Cloudflare, e o navegador conversa apenas
   com este endpoint.

   Configurar (nunca commitar a chave):
     wrangler pages secret put RECY_API_KEY
   ou no painel: Workers & Pages → seu projeto → Settings → Variables → Secret

   Rodar local:  npx wrangler pages dev -- npm run dev
--------------------------------------------------------------------------- */

const RECY_BASE = 'https://app.crecy.workers.dev/api';

/* origens autorizadas a usar este proxy (evita virar ancorador público) */
const ORIGENS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const origemOk = origem => !origem || ORIGENS.includes(origem) || /\.pages\.dev$/.test(new URL(origem).hostname);

const json = (dados, status = 200, origem = '*') => new Response(JSON.stringify(dados), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origem,
    'cache-control': 'no-store',
  },
});

/* ---------------------------------------------------------------------------
   ÚNICO PONTO A COMPLETAR quando o contrato da Recy estiver em mãos.

   Faltam exatamente três coisas, todas obtidas no painel do cRecy (na mesma
   tela onde a chave foi gerada) ou com a DeTrash:

     1. o caminho da operação        → CAMINHO abaixo
     2. o nome do header de auth     → cabecalhosAuth() abaixo
     3. o formato do corpo aceito    → corpo abaixo

   Enquanto não estiverem preenchidos, o endpoint responde 503 com
   { erro: 'nao-configurado' } e o app segue funcionando em modo simulado.
--------------------------------------------------------------------------- */
const CAMINHO = null; // ex.: '/reports' ou '/credits/issue' — a definir

/** A chave veio no formato `id.segredo`. Ainda não sabemos como a Recy espera recebê-la. */
function cabecalhosAuth(chave) {
  const [id, segredo] = String(chave).split('.');
  if (!id || !segredo) throw new Error('formato-de-chave-inesperado');

  // Hipóteses possíveis — confirmar com a documentação antes de usar:
  //   return { authorization: `Bearer ${chave}` };
  //   return { 'x-api-key': chave };
  //   return { 'x-key-id': id, 'x-key-secret': segredo };
  //   HMAC: assinar corpo+timestamp com `segredo` e enviar id em claro
  return null; // null = ainda não sabemos; não vamos adivinhar com credencial real
}

async function chamarRecy(chave, payload) {
  const cabecalhos = cabecalhosAuth(chave);
  if (!CAMINHO || !cabecalhos) {
    const faltando = [!CAMINHO && 'caminho da operação', !cabecalhos && 'header de autenticação']
      .filter(Boolean);
    return { ok: false, erro: 'contrato-incompleto', faltando };
  }

  const r = await fetch(RECY_BASE + CAMINHO, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...cabecalhos },
    body: JSON.stringify(payload),
  });

  const texto = await r.text();
  let corpo;
  try { corpo = JSON.parse(texto); } catch { corpo = { bruto: texto.slice(0, 400) }; }

  if (!r.ok) return { ok: false, erro: 'recy-recusou', status: r.status, corpo };

  // normalizar o retorno: o app só quer id da transação e link para conferir
  return {
    ok: true,
    txId: corpo.txId || corpo.hash || corpo.id || null,
    url: corpo.explorerUrl || corpo.url || null,
    resposta: corpo,
  };
}

/* --------------------------------------------------------------- handlers ---- */

/** GET → o frontend descobre se a ancoragem está disponível, sem tentar escrever. */
export async function onRequestGet({ request, env }) {
  const origem = request.headers.get('origin');
  if (!origemOk(origem)) return json({ erro: 'origem-nao-autorizada' }, 403, origem || '*');

  const temChave = Boolean(env.RECY_API_KEY);
  const completo = Boolean(CAMINHO && temChave);
  return json({
    disponivel: completo,
    rede: 'Recy Testnet',
    motivo: completo ? null : !temChave ? 'chave-ausente' : 'contrato-incompleto',
  }, 200, origem || '*');
}

export async function onRequestPost({ request, env }) {
  const origem = request.headers.get('origin');
  if (!origemOk(origem)) return json({ erro: 'origem-nao-autorizada' }, 403, origem || '*');

  if (!env.RECY_API_KEY) {
    return json({ erro: 'nao-configurado', detalhe: 'RECY_API_KEY ausente no ambiente' }, 503, origem || '*');
  }

  let corpo;
  try { corpo = await request.json(); } catch { return json({ erro: 'json-invalido' }, 400, origem || '*'); }

  // aceitamos apenas o que é seguro publicar: um hash e metadados agregados.
  // nada de nome, documento ou qualquer dado de família/criança.
  const { hash, periodo, kg, acoes } = corpo || {};
  if (!/^[0-9a-f]{64}$/.test(String(hash || ''))) {
    return json({ erro: 'hash-invalido', detalhe: 'esperado SHA-256 em hex (64 chars)' }, 400, origem || '*');
  }
  if (typeof kg !== 'number' || kg <= 0) {
    return json({ erro: 'kg-invalido' }, 400, origem || '*');
  }

  const resultado = await chamarRecy(env.RECY_API_KEY, {
    tipo: 'relatorio-circularidade',
    hash,
    periodo: String(periodo || '').slice(0, 80),
    kg,
    acoes: Number(acoes) || 0,
    projeto: 'Raizes do Futuro — piloto Boipeba/BA',
  });

  if (!resultado.ok) {
    // erro sem vazar credencial: nada de resultado.erro carregar header ou chave
    return json({ erro: resultado.erro, faltando: resultado.faltando, status: resultado.status }, 502, origem || '*');
  }

  return json({
    ancorado: true,
    rede: 'Recy Testnet',
    txId: resultado.txId,
    url: resultado.url,
    ts: Date.now(),
  }, 200, origem || '*');
}

export async function onRequestOptions({ request }) {
  const origem = request.headers.get('origin');
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': origemOk(origem) ? (origem || '*') : 'null',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    },
  });
}
