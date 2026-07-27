/* ---------------------------------------------------------------------------
   O canal da família atravessa a rede DE VERDADE, a partir do navegador e SEM
   SESSÃO.

   Por que esta suíte existe separada:
     · `autorizacao.mjs` prova o contrato do BANCO com a chave anônima;
     · `navegador.mjs` bloqueia o supabase.json de propósito, para ser
       determinístico;
     · nenhuma das duas exercita o caminho que eu escrevi como EXCEÇÃO: o
       aparelho da família, que não tem sessão, chamando enviarContestacao().
       É o único código do app que fala com a rede sem sessão, e por isso é o
       que mais merece um teste que sai do navegador e volta pelo REST.

   Não precisa de usuário de operação: a metade que estava quebrada é a de ida.
--------------------------------------------------------------------------- */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegador, AJUDANTES, espera, placar } from './ajuda/cdp.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ALVO = process.env.ALVO ?? 'http://localhost:5173';
const { ok, secao, fim } = placar();

function credenciais() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return { url: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY };
  }
  try {
    const j = JSON.parse(readFileSync(join(RAIZ, 'public', 'supabase.json'), 'utf8'));
    if (j.url && j.anonKey) return j;
  } catch { /* sem arquivo */ }
  return null;
}

const cred = credenciais();
if (!cred) {
  console.log('  ⏭️  sem credenciais do Supabase — este teste precisa da nuvem');
  process.exit(77);
}
const BASE = cred.url.replace(/\/$/, '') + '/rest/v1/';
const H = { apikey: cred.anonKey, Authorization: 'Bearer ' + cred.anonKey, 'content-type': 'application/json' };

/* migração 04 aplicada? */
const sonda = await fetch(`${BASE}contestacoes?select=id&limit=1`, { headers: H });
if (sonda.status === 404) {
  console.log('  ⏭️  migração 04 não aplicada — rode supabase/migracao-04-contestacoes.sql');
  process.exit(77);
}

const lerPorChave = async chave => {
  const r = await fetch(`${BASE}rpc/contestacao_por_chave`, {
    method: 'POST', headers: H, body: JSON.stringify({ chave }),
  });
  const j = await r.json().catch(() => []);
  return Array.isArray(j) && j.length ? j[0] : null;
};

let nav = null;
try {
  secao('1. O celular da família, sem sessão nenhuma');
  nav = await abrirNavegador({ porta: 9355 });
  await nav.cdp('Emulation.setDeviceMetricsOverride', { width: 412, height: 1000, deviceScaleFactor: 1, mobile: true });
  await nav.cdp('Page.navigate', { url: ALVO + '/#/familia' });
  await espera(1200);
  await nav.ev("localStorage.clear(); localStorage.setItem('raizes-tour-v1','visto'); return 1;");
  await nav.cdp('Page.reload', {});
  await espera(2600);
  await nav.ev(AJUDANTES + ' return 1;');

  ok(await nav.ev(`return localStorage.getItem('raizes-sessao-v1') === null`),
    'o aparelho não tem sessão da operação (é o celular da família)');
  ok(await nav.ev('return __t.conta(".fam-tela.standalone") === 1'), 'e o app da família abriu');

  secao('2. Ela entra e confere a própria entrega');
  const fam = await nav.ev(`
    const s = JSON.parse(localStorage.getItem('raizes-mvp-v2'));
    const f = s.familias.find(x => x.carteira && s.coletas.some(c => c.familiaId === x.id));
    const c = s.coletas.find(c => c.familiaId === f.id);
    return { id: f.id, coletaId: c.id, kg: c.kg };
  `);
  ok(fam?.coletaId != null, `há entrega no nome dela para conferir (${fam?.kg} kg)`);

  await nav.ev(`return __t.preencher(".fam-entrada select", ${fam.id})`);
  await espera(500);
  await nav.ev('return __t.preencher(".fam-entrada input[type=password]", "3690", 0)');
  await nav.ev('return __t.preencher(".fam-entrada input[type=password]", "3690", 1)');
  await espera(300);
  await nav.ev('return __t.clicar(".fam-entrada button.acao")');
  await espera(1100);
  await nav.ev(AJUDANTES + ' return 1;');
  ok(await nav.ev('return __t.tem("Suas entregas")'), 'ela vê "Suas entregas"');

  secao('3. Ela reclama — e a reclamação SAI do aparelho');
  const antes = await (await fetch(`${BASE}contestacoes?select=id`, {
    headers: { ...H, Prefer: 'count=exact', Range: '0-0' },
  })).headers.get('content-range');

  ok(await nav.ev('return __t.clicar(".entrega .btn-contestar") === true'), 'abre o formulário');
  await espera(400);
  await nav.ev('return document.querySelector(".contest-opcao input").click(), 1;');
  await espera(250);
  await nav.ev(AJUDANTES + ' return 1;');
  ok(await nav.ev('return __t.clicar(".contest-form button.acao", "Avisar") === true'), 'ela envia');
  await espera(1200);

  const chave = await nav.ev(`
    const s = JSON.parse(localStorage.getItem('raizes-mvp-v2'));
    const c = s.contestacoes[s.contestacoes.length - 1];
    return { chave: c.chaveLeitura, id: c.id, motivo: c.motivo };
  `);
  ok(typeof chave.chave === 'string' && chave.chave.length >= 16,
    `o segredo de leitura nasceu no aparelho (${chave.chave?.length} caracteres)`);
  ok(!(await nav.ev('return document.body.innerText')).includes(chave.chave),
    'e NÃO é exibido em nenhum lugar da tela');

  /* o teste que importa: a reclamação chegou à nuvem, de um aparelho sem sessão */
  let naNuvem = null;
  for (let i = 0; i < 12 && !naNuvem; i++) {
    await espera(1500);
    naNuvem = await lerPorChave(chave.chave);
  }
  ok(Boolean(naNuvem), 'a reclamação CHEGOU À NUVEM a partir do celular sem sessão');
  ok(naNuvem?.status === 'aberta', 'e chegou como aberta, sem resposta');
  ok(naNuvem?.resposta == null, 'sem resposta forjada');
  console.log(`     (antes: ${antes} · id ${chave.id})`);

  secao('4. E o aparelho continua sem poder ler a base');
  /* `ev()` embrulha a expressão numa arrow NÃO-async, então `await` aqui dentro é
     erro de sintaxe. Como o CDP roda com awaitPromise, basta DEVOLVER a promessa
     e encadear com .then(). */
  const lerComoOAparelho = tabela => nav.ev(`
    return fetch('./supabase.json')
      .then(r => r.json())
      .then(cfg => fetch(cfg.url + '/rest/v1/${tabela}?select=id&limit=5', {
        headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey },
      }))
      .then(r => r.json())
      .then(j => Array.isArray(j) ? j.length : -1)
      .catch(() => -2);
  `);

  const vazou = await lerComoOAparelho('familias');
  ok(vazou === 0, `o mesmo aparelho não lê familias (recebeu ${vazou} linhas)`);

  const vazouCt = await lerComoOAparelho('contestacoes');
  ok(vazouCt === 0, 'nem as contestações das outras famílias — depositar não dá leitura');

  /* ------------------------------------------------------------------------
     5. O OUTRO LADO: o aparelho da operação tem de VER a reclamação.
     Precisa de sessão, porque a base não responde a anônimo — é o mesmo motivo
     pelo qual o canal da família precisou de desenho próprio. Sem credencial de
     teste este trecho é pulado, e o resumo diz que foi pulado.
     ------------------------------------------------------------------------ */
  secao('5. O Instituto Vivá, em outro aparelho, vê a reclamação');
  const { abrirSessao, avisoSemSessao, CHAVE_SESSAO } = await import('./ajuda/sessao.mjs');
  const SESSAO = await abrirSessao(cred);
  if (!SESSAO) {
    avisoSemSessao('a metade da operação neste teste');
    console.log('     (a ida — celular → nuvem — já foi verificada acima)');
  } else {
    const op = await abrirNavegador({ porta: 9356 });
    try {
      await op.cdp('Page.navigate', { url: ALVO });
      await espera(900);
      await op.ev(`
        localStorage.clear();
        localStorage.setItem('raizes-tour-v1','visto');
        localStorage.setItem(${JSON.stringify(CHAVE_SESSAO)}, ${JSON.stringify(JSON.stringify(SESSAO))});
        return 1;
      `);
      await op.cdp('Page.reload', {});
      await espera(3000);
      await op.ev(AJUDANTES + ' return 1;');

      /* espera o pull trazer a contestação criada no OUTRO aparelho */
      let viu = false;
      for (let i = 0; i < 14 && !viu; i++) {
        await espera(1500);
        viu = await op.ev(`
          const s = JSON.parse(localStorage.getItem('raizes-mvp-v2'));
          return (s.contestacoes || []).some(c => c.id === ${chave.id});
        `);
      }
      ok(viu, 'a reclamação feita no celular da família CHEGOU ao aparelho da operação');

      if (viu) {
        await op.ev('return __t.clicar("nav.tabs button", "Instituto Vivá")');
        await espera(900);
        await op.ev(AJUDANTES + ' return 1;');
        ok(await op.ev('return __t.tem("Contestações das famílias")'), 'e aparece na tela de quem valida');

        const segredoNaTela = await op.ev(`
          const s = JSON.parse(localStorage.getItem('raizes-mvp-v2'));
          const c = (s.contestacoes || []).find(c => c.id === ${chave.id});
          return { temSegredo: !!c.chaveLeitura, corpo: document.body.innerText.includes(${JSON.stringify(chave.chave)}) };
        `);
        ok(!segredoNaTela.temSegredo && !segredoNaTela.corpo,
          'e o SEGREDO da família não chega nem ao estado nem à tela da operação');
      }
    } finally {
      await op.fechar();
    }
  }

  const erros = nav.erros.filter(e => !/supabase|401|403/i.test(e));
  ok(erros.length === 0, `nenhum erro de console no app (${erros.length})`);
  if (erros.length) erros.slice(0, 5).forEach(e => console.log('    · ' + e.slice(0, 160)));
} catch (e) {
  console.log('  ✗ ' + e.message);
  ok(false, 'o teste chegou ao fim');
} finally {
  if (nav) await nav.fechar();
}

process.exit(fim('verificações do canal da família') ? 0 : 1);
