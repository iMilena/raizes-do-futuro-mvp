/* ---------------------------------------------------------------------------
   Inventário de migrações: o que o banco tem, versus o que o código supõe.

   ── POR QUE ISTO EXISTE ───────────────────────────────────────────────────
   Foram seis migrações ao longo do projeto, aplicadas à mão no SQL Editor em
   momentos diferentes. Uma delas passou batido — a 03, da retenção — e ninguém
   notou por semanas. O efeito não era uma pane, era pior: a TELA passou a dizer
   "consentimento vale até tal data" enquanto o banco não tinha prazo nenhum, e
   `consentida()` só checava revogação. Ou seja, a interface prometia uma regra
   de LGPD que o banco não cumpria.

   Esse tipo de divergência não aparece em teste de comportamento: o app funciona,
   as telas renderizam, nada dá erro. Só aparece se alguém for olhar. Este arquivo
   é esse alguém.

   Sonda por CAPACIDADE, não por número de versão: pergunta ao banco se a coluna
   ou a tabela existe. Não há tabela de controle de migração para ficar
   desatualizada.
--------------------------------------------------------------------------- */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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
  console.log('  ⏭️  sem credenciais do Supabase');
  process.exit(77);
}

const { abrirSessao, avisoSemSessao } = await import('./ajuda/sessao.mjs');
const SESSAO = await abrirSessao(cred);
if (!SESSAO) {
  avisoSemSessao('o inventário de migrações');
  process.exit(77);
}

const BASE = cred.url.replace(/\/$/, '') + '/rest/v1/';
const H = { apikey: cred.anonKey, Authorization: 'Bearer ' + SESSAO.access_token };

/**
 * Cada migração, o que ela cria, e — o que importa — O QUE FICA ERRADO SEM ELA.
 * `mente` marca as que produzem afirmação falsa na tela; essas fazem a suíte
 * falhar, porque tela que promete o que o banco não cumpre é defeito, não
 * pendência.
 */
const MIGRACOES = [
  {
    n: '02', arquivo: 'migracoes/02-auth-papeis-consentimento.sql',
    sonda: 'papeis?select=user_id&limit=1',
    cria: 'papéis, consentimento, RLS por papel',
    semEla: 'a base responderia ao papel anônimo: qualquer um com a URL lê tudo',
    mente: true,
  },
  {
    n: '03', arquivo: 'migracoes/03-retencao.sql',
    sonda: 'consentimentos?select=validade_meses&limit=1',
    cria: 'prazo do consentimento, view retencao_status, expurgo',
    semEla: 'a TELA diz "vale até tal data" e o banco não tem prazo — consentimento vencido continua autorizando, e não há expurgo para rodar',
    mente: true,
  },
  {
    n: '04', arquivo: 'migracoes/04-contestacoes.sql',
    sonda: 'contestacoes?select=id&limit=1',
    cria: 'canal de contestação da família',
    semEla: 'a família reclama e nada sai do aparelho dela',
    mente: true,
  },
  {
    n: '05', arquivo: 'migracoes/05-contestacao-sem-consentimento.sql',
    sonda: null, // é troca de policy: verificada por comportamento em autorizacao.mjs
    cria: 'leitura da contestação sem gate de consentimento',
    semEla: 'família sem consentimento reclama e a operação nunca vê',
    mente: true,
  },
  {
    n: '06', arquivo: 'migracoes/06-vinculo-coleta-familia-e-ciclos.sql',
    sonda: 'coletas?select=familia_id&limit=1',
    cria: 'vínculo coleta↔família e tabela de ciclos',
    semEla: 'o vínculo e os fechamentos de ciclo não atravessam aparelhos (o app tolera: grava sem eles)',
    mente: false,
  },
];

const existe = async sonda => {
  if (!sonda) return null; // não sondável por schema
  const r = await fetch(BASE + sonda, { headers: H });
  if (r.ok) return true;
  const t = await r.text();
  return !/PGRST205|PGRST204|42703|42P01|does not exist|Could not find/i.test(t);
};

console.log('\nMigração  estado        cria');
console.log('─'.repeat(74));

let faltamMentindo = [];
let faltamToleradas = [];

for (const m of MIGRACOES) {
  const ok = await existe(m.sonda);
  const estado = ok === null ? 'não sondável' : ok ? 'aplicada' : 'FALTA';
  console.log(`  ${m.n}      ${estado.padEnd(13)} ${m.cria}`);
  if (ok === false) (m.mente ? faltamMentindo : faltamToleradas).push(m);
}

console.log('');
if (!faltamMentindo.length && !faltamToleradas.length) {
  console.log('✅ todas as migrações sondáveis estão aplicadas');
  process.exit(0);
}

for (const m of faltamToleradas) {
  console.log(`⏭️  migração ${m.n} pendente (o app tolera)`);
  console.log(`    sem ela: ${m.semEla}`);
  console.log(`    rode: supabase/${m.arquivo}`);
}

for (const m of faltamMentindo) {
  console.log(`❌ migração ${m.n} FALTA, e a tela afirma o que o banco não cumpre`);
  console.log(`    sem ela: ${m.semEla}`);
  console.log(`    rode: supabase/${m.arquivo}`);
}

if (faltamMentindo.length) {
  console.log('\nFalha de propósito: interface que promete regra que o banco não aplica é');
  console.log('defeito, não pendência de configuração.');
}
process.exit(faltamMentindo.length ? 1 : 0);
