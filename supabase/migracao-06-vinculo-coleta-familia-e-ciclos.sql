-- ===========================================================================
-- MIGRAÇÃO 06 — O vínculo coleta↔família, e os fechamentos de ciclo
--
-- Duas lacunas encontradas auditando o que o app guarda local versus o que a
-- nuvem conhece. As duas são do mesmo tipo: modelo e tela existiam, o fio não.
--
-- ── 1. coletas.familia_id ────────────────────────────────────────────────
-- O app liga cada coleta a uma família (é o que faz os 60% de renda chegarem à
-- conta dela e o que permite a ela conferir a própria entrega). Esse vínculo NÃO
-- existia aqui, e `registrarColeta` não o enviava.
--
-- O efeito não era só "não sincroniza": era PERDER. `mesclar()` substitui as
-- coletas locais pelas da nuvem; sem a coluna, o primeiro pull devolvia coletas
-- sem `familia_id` e o vínculo desaparecia do aparelho. A tela "Suas entregas"
-- esvaziava e a renda parava de ser atribuída — em silêncio.
--
-- Sem FK para `familias`, de propósito: a coleta é registrada em campo, e a
-- família só sobe depois do consentimento. Uma FK faria a coleta ser recusada
-- por ordem de chegada, e a fila é FIFO.
--
-- ── 2. ciclos ───────────────────────────────────────────────────────────
-- A regra 4 (saldo residual → ações coletivas decididas com a comunidade) era
-- registrada e ancorada, mas só localmente: em outro aparelho, a operação não
-- via a decisão nem a prova. Prestação de contas que existe em um computador só
-- não é prestação de contas.
--
-- Rode no SQL Editor. Idempotente.
-- ===========================================================================

-- --------------------------------------------------- 1. vínculo da coleta
alter table coletas add column if not exists familia_id bigint;

comment on column coletas.familia_id is
  'Família de quem coletou. É o que faz os 60% de renda chegarem à conta dela e '
  'o que permite à família conferir a própria entrega no app. Sem FK de '
  'propósito: a coleta é registrada antes de a família subir (que depende de '
  'consentimento), e uma FK a recusaria por ordem de chegada.';

create index if not exists idx_coletas_familia on coletas(familia_id);

-- ------------------------------------------------- 2. fechamento de ciclo
create table if not exists ciclos (
  id                bigint primary key,
  ciclo             text not null,              -- ex.: '2026-07'
  acao              text not null,              -- a ação coletiva decidida
  valor             numeric not null check (valor > 0),
  como_foi_decidido text not null,
  participantes     text,                       -- ex.: '14 famílias, escola municipal'
  data              date not null,
  hash              text,                       -- SHA-256 do registro da decisão
  ancoragem         jsonb,                      -- { rede, hash, txId, url } quando ancorado
  criado_em         timestamptz not null default now()
);

comment on table ciclos is
  'Regra 4 do cofre: saldo residual do ciclo destinado a ações coletivas '
  'definidas com a comunidade. A DECISÃO é da assembleia; o que fica aqui é a '
  'prova de qual decisão foi tomada, com qual valor. Não deve conter nome de '
  'criança — `participantes` é agregado ("14 famílias").';

alter table ciclos enable row level security;

drop policy if exists ciclo_ler on ciclos;
create policy ciclo_ler on ciclos for select to authenticated
  using (meu_papel() is not null);

drop policy if exists ciclo_registrar on ciclos;
create policy ciclo_registrar on ciclos for insert to authenticated
  with check (meu_papel() in ('validador','gestor'));

-- ancorar é preencher a prova depois; nada mais é editável
drop policy if exists ciclo_ancorar on ciclos;
create policy ciclo_ancorar on ciclos for update to authenticated
  using (meu_papel() in ('validador','gestor') and ancoragem is null)
  with check (ancoragem is not null);

-- Sem policy de DELETE: a destinação do residual é prestação de contas.

-- ---------------------------------------------------------------- conferência
--   select count(*) as coletas_com_familia from coletas where familia_id is not null;
--   select ciclo, acao, valor, (ancoragem is not null) as ancorado from ciclos;
--
-- `npm test -- nuvem` verifica o vínculo na ida e na volta.
-- ===========================================================================
