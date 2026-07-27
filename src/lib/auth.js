/* ---------------------------------------------------------------------------
   Sessão da operação — Supabase Auth (GoTrue) pela API REST, sem dependência.

   POR QUE SEM O @supabase/supabase-js
   A biblioteca oficial traria realtime, storage e postgrest para usar três
   endpoints. O app é offline-first e o bundle importa: `token`, `user` e
   `logout` são três chamadas HTTP. O resto é gerência de expiração, que é onde
   está o cuidado de verdade.

   O QUE ESTE MÓDULO NÃO FAZ
   Não autentica família. A família entra no app dela com PIN e não tem conta:
   quem tem credencial é a operação (coletor, Instituto Vivá, gestor), no
   aparelho de trabalho. Dar login e senha para a mãe em Boipeba seria transferir
   a ela o custo de um problema nosso.

   SEM SESSÃO, SEM NUVEM
   Não existe modo "lê um pouquinho": desde a migração 02 nenhuma policy responde
   ao papel anônimo. Sem sessão o aplicativo roda inteiro, local, como sempre
   rodou — a nuvem é a camada que aparece quando alguém da operação entra.
--------------------------------------------------------------------------- */

const CHAVE_SESSAO = 'raizes-sessao-v1';
/* renova antes de vencer: um POST de sincronização que sai com token expirado
   volta 401 e a operação acha que perdeu o trabalho. */
const FOLGA_MS = 60_000;

let sessao = null;      // { access_token, refresh_token, expira_em, usuario, papel }
let ouvintes = [];
let renovando = null;   // promessa em voo, para não disparar dois refresh juntos

const armazem = () => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

function guardar(s) {
  sessao = s;
  const a = armazem();
  try {
    if (!a) return;
    if (s) a.setItem(CHAVE_SESSAO, JSON.stringify(s));
    else a.removeItem(CHAVE_SESSAO);
  } catch { /* modo privado sem storage: sessão só na memória */ }
  for (const f of ouvintes) f(s);
}

/** Recupera a sessão gravada. Não valida o token aqui — quem usa chama `token()`. */
export function restaurar() {
  if (sessao) return sessao;
  const a = armazem();
  try {
    const bruto = a?.getItem(CHAVE_SESSAO);
    if (bruto) sessao = JSON.parse(bruto);
  } catch { sessao = null; }
  return sessao;
}

export const atual = () => sessao || restaurar();
export const logado = () => Boolean(atual()?.refresh_token);

export function aoMudar(fn) {
  ouvintes.push(fn);
  return () => { ouvintes = ouvintes.filter(f => f !== fn); };
}

/* ------------------------------------------------------------- chamadas ---- */

async function chamar(cfg, caminho, corpo, cabecalhoExtra = {}) {
  const r = await fetch(`${cfg.url}/auth/v1/${caminho}`, {
    method: 'POST',
    headers: { apikey: cfg.anonKey, 'content-type': 'application/json', ...cabecalhoExtra },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let j = null;
  try { j = texto ? JSON.parse(texto) : null; } catch { /* corpo não-JSON */ }
  if (!r.ok) {
    /* GoTrue devolve `error_description`, `msg` ou `error` dependendo do caso.
       Traduzo o mais comum, porque "Invalid login credentials" na tela de uma
       agente de campo não ajuda ninguém. */
    const bruto = j?.error_description || j?.msg || j?.error || `HTTP ${r.status}`;
    const amigavel = /invalid login credentials/i.test(bruto)
      ? 'E-mail ou senha não conferem.'
      : /email not confirmed/i.test(bruto)
        ? 'Este usuário ainda não confirmou o e-mail. Confirme em Authentication → Users.'
        : bruto;
    const e = new Error(amigavel);
    e.status = r.status;
    throw e;
  }
  return j;
}

/** Busca papel e nome de exibição. Sem linha em `papeis`, a sessão não opera. */
async function buscarPapel(cfg, token) {
  const r = await fetch(`${cfg.url}/rest/v1/papeis?select=papel,nome,organizacao,signatario`, {
    headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + token },
  });
  if (!r.ok) return null;
  const linhas = await r.json().catch(() => null);
  return Array.isArray(linhas) && linhas.length ? linhas[0] : null;
}

function montar(resposta, papel) {
  return {
    access_token: resposta.access_token,
    refresh_token: resposta.refresh_token,
    expira_em: Date.now() + (Number(resposta.expires_in) || 3600) * 1000,
    usuario: { id: resposta.user?.id, email: resposta.user?.email },
    papel: papel || null,
  };
}

/**
 * Entra com e-mail e senha.
 * @throws {Error} mensagem já em português, pronta para a tela
 */
export async function entrar(cfg, email, senha) {
  const r = await chamar(cfg, 'token?grant_type=password', { email, password: senha });
  const papel = await buscarPapel(cfg, r.access_token);
  const s = montar(r, papel);
  guardar(s);
  if (!papel) {
    /* Login válido e sem papel é o caso mais confuso de todos: a pessoa entra e
       nada aparece. Melhor dizer exatamente o que falta e a quem pedir. */
    const e = new Error('Entrou, mas este usuário não tem papel definido. '
      + 'Peça a quem administra o projeto para inserir a linha em `papeis`.');
    e.semPapel = true;
    throw e;
  }
  return s;
}

/** Renova o access_token. Chamadas simultâneas compartilham a mesma promessa. */
async function renovar(cfg) {
  const s = atual();
  if (!s?.refresh_token) return null;
  if (renovando) return renovando;

  renovando = (async () => {
    try {
      const r = await chamar(cfg, 'token?grant_type=refresh_token', { refresh_token: s.refresh_token });
      const nova = montar(r, s.papel);
      /* o papel pode ter mudado no banco desde o login; relê de vez em quando,
         mas sem travar a renovação se a leitura falhar */
      nova.papel = (await buscarPapel(cfg, r.access_token)) || s.papel;
      guardar(nova);
      return nova;
    } catch (e) {
      /* refresh_token inválido/revogado: a sessão morreu, não insista. Guardar
         null aqui é o que faz a interface voltar para "Entrar" sozinha. */
      if (e.status === 400 || e.status === 401) guardar(null);
      return null;
    } finally {
      renovando = null;
    }
  })();

  return renovando;
}

/**
 * Token válido para usar no header, renovando se estiver perto de vencer.
 * Devolve null quando não há sessão — e aí quem chama NÃO deve falar com a nuvem.
 */
export async function token(cfg) {
  const s = atual();
  if (!s?.access_token) return null;
  if (Date.now() < s.expira_em - FOLGA_MS) return s.access_token;
  const nova = await renovar(cfg);
  return nova?.access_token ?? null;
}

export async function sair(cfg) {
  const s = atual();
  guardar(null);
  if (!s?.access_token) return;
  /* revoga do lado do servidor; se falhar (offline), a sessão local já foi
     apagada, que é o que a pessoa pediu ao clicar em Sair. */
  try { await chamar(cfg, 'logout', null, { Authorization: 'Bearer ' + s.access_token }); } catch { /* ok */ }
}

/** Só para os testes: injeta uma sessão sem passar pela rede. */
export function _definirSessao(s) { guardar(s); }
