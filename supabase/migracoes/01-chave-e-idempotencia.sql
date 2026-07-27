-- ===========================================================================
-- MIGRAÇÃO 01 — chave natural das transações + idempotência de dinheiro
--
-- Rode no SQL Editor. Projeto novo já vem com isto no schema.sql.
--
-- ⚠️ Recria três tabelas. Só faça isto enquanto os dados forem de teste — hoje
--    são (o piloto ainda não opera). Depois disso, migração de verdade.
--
-- ---------------------------------------------------------------------------
-- PROBLEMA 1 — `seq` não pode ser a chave primária
--
-- `seq` vem do tamanho do array local de transações. Dois aparelhos offline com
-- 20 transações cada criam ambos `seq = 21`, com conteúdos diferentes. Ao
-- sincronizar, o segundo colide na chave primária e o `ignore-duplicates` o
-- descarta em silêncio: a transação daquele aparelho desaparece do registro
-- compartilhado. É exatamente o caso que a sincronização deveria resolver.
--
-- A chave natural é a `signature`: ela é derivada do CONTEÚDO da transação
-- (tipo, descrição, valor e a signature anterior), então dois aparelhos só
-- produzem a mesma se a transação for de fato a mesma. `seq` continua como
-- ordenação local, sem unicidade global.
--
-- PROBLEMA 2 — dinheiro duplicava no reenvio
--
-- `movimentos` e `extrato` tinham id `bigserial` e nenhuma chave natural. Se a
-- fila reenviasse uma operação — e ela reenvia, porque a rede do campo cai no
-- meio de um POST — o saldo dobrava. Testado: dobrou de R$ 90 para R$ 180.
--
-- Agora a chave é (signature da transação, caixa) e (signature, família): cada
-- transação produz no máximo um movimento por caixa e uma linha de extrato por
-- família. Com `Prefer: resolution=ignore-duplicates`, reenviar é inofensivo.
-- ===========================================================================

drop view if exists saldos;
drop view if exists saldo_familia;
drop table if exists movimentos;
drop table if exists extrato;
drop table if exists transacoes;

create table transacoes (
  signature      text primary key,             -- chave natural: derivada do conteúdo
  seq            bigint not null,              -- ordenação local, não é única globalmente
  slot           bigint not null,
  tipo           text   not null,
  descricao      text   not null,
  valor          numeric not null default 0,
  prev_signature text   not null,
  taxa           numeric,
  meta           jsonb,
  ts             timestamptz not null default now()
);

comment on table transacoes is
  'APPEND-ONLY: as policies permitem apenas INSERT. A chave é a signature, '
  'derivada do conteúdo — dois aparelhos só colidem se a transação for a mesma.';

create table movimentos (
  id            bigserial primary key,
  caixa         text not null check (caixa in ('renda','fundo','operacao','fundo_liberado')),
  valor         numeric not null,              -- positivo entra, negativo sai
  motivo        text not null,
  transacao_sig text not null references transacoes(signature),
  criado_em     timestamptz not null default now(),
  constraint movimentos_por_transacao unique (transacao_sig, caixa)
);

create table extrato (
  id            bigserial primary key,
  familia_id    bigint not null references familias(id) on delete cascade,
  descricao     text not null,
  valor         numeric not null,
  transacao_sig text not null references transacoes(signature),
  criado_em     timestamptz not null default now(),
  constraint extrato_por_transacao unique (transacao_sig, familia_id)
);

create view saldos as
  select caixa, sum(valor) as saldo from movimentos group by caixa;

create view saldo_familia as
  select familia_id, sum(valor) as saldo from extrato group by familia_id;

create index if not exists idx_transacoes_slot on transacoes(slot);
create index if not exists idx_transacoes_seq  on transacoes(seq);
create index if not exists idx_extrato_familia on extrato(familia_id);

-- RLS: append-only, como antes (o que não tem policy é negado)
alter table transacoes enable row level security;
alter table movimentos enable row level security;
alter table extrato    enable row level security;

create policy append_ler     on transacoes for select using (true);
create policy append_inserir on transacoes for insert with check (true);
create policy append_ler     on movimentos for select using (true);
create policy append_inserir on movimentos for insert with check (true);
create policy append_ler     on extrato    for select using (true);
create policy append_inserir on extrato    for insert with check (true);
