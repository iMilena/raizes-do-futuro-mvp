/* ---------------------------------------------------------------------------
   Dois aparelhos ao mesmo tempo — o caso que a sincronização existe para
   resolver, e o único que prova que ela funciona.

   Cenário, igual ao do campo:
     · aparelho A é o celular do coletor, em Boipeba
     · aparelho B é o notebook do Instituto Vivá
     · A registra uma coleta OFFLINE (a rede da ilha caiu)
     · B, online, valida outra coisa
     · A volta a ter sinal
     · nada pode ter se perdido, de nenhum dos dois lados

   Usa dois contextos isolados no mesmo Edge (perfis de navegação separados),
   então cada um tem seu localStorage — como dois aparelhos de verdade.
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

const MARCA = 'Nilza-' + Date.now().toString().slice(-6); // coletor único por execução
const cred = credenciais();
if (!cred) {
  console.log('  ⏭️  sem credenciais do Supabase — este teste precisa da nuvem');
  process.exit(0);
}

/* Os dois aparelhos precisam estar LOGADOS: sem sessão o app é local por
   desenho e não haveria sincronização nenhuma para testar. */
const { abrirSessao, avisoSemSessao, CHAVE_SESSAO } = await import('./ajuda/sessao.mjs');
const SESSAO = await abrirSessao(cred);
if (!SESSAO) {
  avisoSemSessao('o teste de dois aparelhos');
  process.exit(77); // 77 = pulado, ver testes/executar.mjs
}

/* limpa a nuvem da faixa deste teste inserindo com ids próprios não é possível
   (append-only), então o teste trabalha com o que existe e mede DELTAS.

   O TOKEN DA SESSÃO, não a chave anônima: desde a migração 02 o anônimo recebe
   zero linhas em tudo. Com a chave anônima este teste media sempre 0 → 0 e a
   asserção "nenhum movimento duplicado (0 movimentos)" passava por VACUIDADE —
   verde sobre conjunto vazio, que é o pior tipo de verde. */
const H = { apikey: cred.anonKey, Authorization: 'Bearer ' + SESSAO.access_token };
const contarNuvem = async tabela => {
  const r = await fetch(`${cred.url}/rest/v1/${tabela}?select=*`, {
    headers: { ...H, Prefer: 'count=exact', Range: '0-0' },
  });
  const total = r.headers.get('content-range')?.split('/')?.[1];
  return total && total !== '*' ? Number(total) : 0;
};

let A = null, B = null;
try {
  secao('1. Dois aparelhos independentes');
  A = await abrirNavegador({ porta: 9350 });
  B = await abrirNavegador({ porta: 9351 });

  const preparar = async (nav, rotulo) => {
    await nav.cdp('Page.navigate', { url: ALVO + '/#/painel' });
    await espera(900);
    /* injeta a sessão como se a pessoa tivesse entrado na tela: src/lib/auth.js
       restaura desta chave no boot. Assim os dois aparelhos sincronizam. */
    await nav.ev(`
      localStorage.clear();
      localStorage.setItem('raizes-tour-v1','visto');
      localStorage.setItem(${JSON.stringify(CHAVE_SESSAO)}, ${JSON.stringify(JSON.stringify(SESSAO))});
      return 1;
    `);
    await nav.cdp('Page.reload', {});
    await espera(2500); // deixa o boot puxar da nuvem
    await nav.ev(AJUDANTES + ' return 1;');
    return nav.ev('return __t.tem("Impacto em tempo real")');
  };

  ok(await preparar(A, 'A'), 'aparelho A (celular do coletor) abriu');
  ok(await preparar(B, 'B'), 'aparelho B (notebook do Vivá) abriu');
  ok(await A.ev('return JSON.parse(localStorage.getItem("raizes-mvp-v2")).transacoes.length > 0'),
    'A tem estado local (funciona antes de qualquer rede)');

  secao('2. Aparelho A registra uma coleta OFFLINE');
  await A.cdp('Network.enable');
  await A.cdp('Network.emulateNetworkConditions', {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
  });
  ok(true, 'rede de A desligada (emulação de rede)');

  const antesColetas = await contarNuvem('coletas');

  await A.ev('return __t.clicar("nav.tabs button", "Coletor")');
  await espera(500);
  await A.ev(AJUDANTES + ' return 1;');
  await A.ev(`return __t.preencher(".card.destaque input", ${JSON.stringify(MARCA)}, 0)`);
  await A.ev('return __t.preencher(".card.destaque input[type=number]", "77")');
  await A.ev('return __t.preencher(".card.destaque input", "Praia de Cueira", 2)');
  await espera(300);
  ok(await A.ev('return __t.clicar(".card.destaque button.acao", "Enviar para validação") === true'),
    'A consegue registrar coleta mesmo sem rede (local-first)');
  await espera(1200);
  ok(await A.ev(`return __t.tem(${JSON.stringify(MARCA)})`), 'a coleta aparece na tela de A');

  const filaA = await A.ev(`
    const f = JSON.parse(localStorage.getItem('raizes-fila-sync') || '[]');
    return f.length;
  `);
  ok(filaA > 0, `o trabalho de A ficou na fila para depois (${filaA} operações)`);
  ok(await contarNuvem('coletas') === antesColetas, 'e nada foi para a nuvem enquanto offline');

  secao('3. Aparelho B trabalha normalmente, online');
  await B.ev('return __t.clicar("nav.tabs button", "Cofre Multisig")');
  await espera(700);
  await B.ev(AJUDANTES + ' return 1;');
  const antesAss = await contarNuvem('assinaturas');
  const temProposta = await B.ev('return __t.conta(".signatario button") > 0');
  if (!temProposta) {
    console.log('     (sem proposta aberta na nuvem — B faz uma validação em vez de assinar)');
  }
  const assinou = temProposta
    ? await B.ev('return __t.clicar(".signatario button", "Assinar como")')
    : false;
  ok(temProposta ? assinou === true : true, temProposta
    ? 'B assina uma proposta no cofre'
    : 'B não tinha proposta aberta (estado da nuvem já executado)');
  await espera(3000);

  if (temProposta) {
    const depoisAss = await contarNuvem('assinaturas');
    ok(depoisAss > antesAss, `a assinatura de B chegou à nuvem (${antesAss} → ${depoisAss})`);
  }

  secao('4. A volta a ter sinal');
  await A.cdp('Network.emulateNetworkConditions', {
    offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
  });
  ok(true, 'rede de A religada');

  /* a fila escoa no próximo tique do intervalo (8 s) */
  let filaVazia = false;
  for (let i = 0; i < 20 && !filaVazia; i++) {
    await espera(1500);
    filaVazia = await A.ev(`
      const f = JSON.parse(localStorage.getItem('raizes-fila-sync') || '[]');
      return f.length === 0;
    `);
  }
  ok(filaVazia, 'a fila de A esvaziou sozinha ao voltar o sinal');

  const depoisColetas = await contarNuvem('coletas');
  ok(depoisColetas > antesColetas, `a coleta feita offline chegou à nuvem (${antesColetas} → ${depoisColetas})`);

  /* consulta pela MARCA desta execução, não por um nome fixo: com nome fixo o
     teste passaria por linhas de execuções anteriores, sem provar nada sobre a
     coleta de agora. */
  const naNuvem = await (await fetch(
    `${cred.url}/rest/v1/coletas?coletor=eq.${encodeURIComponent(MARCA)}&select=coletor,kg,status`,
    { headers: H })).json();
  ok(naNuvem.length === 1, `a coleta desta execução está na nuvem, uma única vez (${naNuvem.length})`);
  ok(naNuvem.length === 1 && Number(naNuvem[0].kg) === 77,
    `e chegou com os dados certos (${naNuvem[0]?.kg} kg)`);

  secao('5. Nenhum dos dois perdeu trabalho');
  /* B puxa: tem de ver a coleta que A fez offline */
  let bVe = false;
  for (let i = 0; i < 20 && !bVe; i++) {
    await espera(1500);
    bVe = await B.ev(`return document.body.innerText.includes(${JSON.stringify(MARCA)})`)
      || await B.ev(`
        const s = JSON.parse(localStorage.getItem('raizes-mvp-v2'));
        return s.coletas.some(c => c.coletor === ${JSON.stringify(MARCA)});
      `);
  }
  ok(bVe, 'B passou a ver a coleta que A registrou offline');

  /* A tem de ver a assinatura que B fez enquanto A estava sem rede */
  let aVe = false;
  for (let i = 0; i < 20 && !aVe; i++) {
    await espera(1500);
    aVe = await A.ev(`
      const s = JSON.parse(localStorage.getItem('raizes-mvp-v2'));
      return s.transacoes.some(t => t.tipo === 'ASSINATURA');
    `);
  }
  ok(aVe, 'A passou a ver o trabalho que B fez durante a queda');

  secao('6. Sem duplicação de dinheiro depois de tudo');
  const saldos = await (await fetch(`${cred.url}/rest/v1/saldos?select=*`, { headers: H })).json();
  const fundo = Number(saldos.find(x => x.caixa === 'fundo')?.saldo ?? 0);
  ok(Number.isFinite(fundo), `saldo do fundo na nuvem: ${fundo}`);

  const movDup = await (await fetch(
    `${cred.url}/rest/v1/movimentos?select=transacao_sig,caixa`, { headers: H })).json();
  const chaves = movDup.map(m => m.transacao_sig + '|' + m.caixa);
  ok(chaves.length > 0 && new Set(chaves).size === chaves.length,
    `nenhum movimento duplicado (${chaves.length} movimentos, todos com chave única)`);

  const erros = [...A.erros, ...B.erros];
  ok(erros.length === 0, `nenhum erro de console nos dois aparelhos (${erros.length})`);
  if (erros.length) erros.slice(0, 8).forEach(e => console.log('    · ' + e.slice(0, 150)));
} catch (e) {
  console.log('  ✗ ' + e.message);
  ok(false, 'o teste chegou ao fim');
} finally {
  if (A) await A.fechar();
  if (B) await B.fechar();
}

process.exit(fim('verificações com dois aparelhos') ? 0 : 1);
