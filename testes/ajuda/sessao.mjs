/* ---------------------------------------------------------------------------
   Sessão da operação para os testes.

   Desde a migração 02 a nuvem só responde a quem entrou: `nuvem.ativo()` exige
   sessão, e o banco não tem policy para o papel anônimo. Então as suítes que
   sincronizam precisam de um usuário de verdade — não há como fingir.

   Credenciais: SUPABASE_TEST_EMAIL + SUPABASE_TEST_SENHA (usuário com linha em
   `papeis`, de preferência papel 'gestor' para poder exercitar tudo).
--------------------------------------------------------------------------- */

export const CHAVE_SESSAO = 'raizes-sessao-v1';

/**
 * Abre sessão e devolve o objeto no MESMO formato que src/lib/auth.js guarda —
 * assim o teste pode injetar direto no localStorage do navegador e o app
 * restaura como se a pessoa tivesse entrado na tela.
 *
 * @returns {Promise<object|null>} null quando não há credenciais de teste
 */
export async function abrirSessao(cred) {
  const email = process.env.SUPABASE_TEST_EMAIL;
  const senha = process.env.SUPABASE_TEST_SENHA;
  if (!email || !senha) return null;

  const raiz = cred.url.replace(/\/$/, '');
  const r = await fetch(`${raiz}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: cred.anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: senha }),
  });
  if (!r.ok) {
    console.log('  ⚠️  login de teste falhou: ' + (await r.text()).slice(0, 140));
    return null;
  }
  const j = await r.json();

  const rp = await fetch(`${raiz}/rest/v1/papeis?select=papel,nome,organizacao,signatario`, {
    headers: { apikey: cred.anonKey, Authorization: 'Bearer ' + j.access_token },
  });
  const papeis = rp.ok ? await rp.json().catch(() => []) : [];

  return {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expira_em: Date.now() + (Number(j.expires_in) || 3600) * 1000,
    usuario: { id: j.user?.id, email: j.user?.email },
    papel: papeis[0] || null,
  };
}

/** A migração 02 já está aplicada neste projeto? */
export async function migracao02Aplicada(cred) {
  const r = await fetch(`${cred.url.replace(/\/$/, '')}/rest/v1/papeis?select=user_id&limit=1`, {
    headers: { apikey: cred.anonKey, Authorization: 'Bearer ' + cred.anonKey },
  });
  return r.status !== 404;
}

/**
 * Mensagem única para as suítes que precisam de sessão e não a têm. Explica o
 * que fazer em vez de só dizer "pulado".
 */
export function avisoSemSessao(nome) {
  console.log(`  ⏭️  ${nome} precisa de sessão da operação.`);
  console.log('     A nuvem não responde mais a anônimo (por desenho). Defina');
  console.log('     SUPABASE_TEST_EMAIL e SUPABASE_TEST_SENHA de um usuário com papel');
  console.log('     e rode de novo. Ver supabase/migracoes/02-auth-papeis-consentimento.sql.');
}
