-- ===========================================================================
-- RAÍZES DO FUTURO — esquema compartilhado (Supabase / Postgres)
--
-- Substitui o desenho de "estado inteiro num blob JSON". Aquele modelo tinha
-- dois defeitos que impedem uso real:
--
--   1. last-write-wins: o coletor registra no celular, o Instituto Vivá valida
--      no notebook, e quem gravar por último apaga o trabalho do outro.
--   2. o histórico auditável vivia DENTRO do blob — ou seja, uma gravação
--      atrasada podia apagar transações já registradas. Justamente o oposto
--      do que um registro de auditoria precisa ser.
--
-- Princípios deste esquema:
--
--   · UMA TABELA POR ENTIDADE. Cada ação é um INSERT ou um UPDATE dirigido a
--     uma linha, então dois aparelhos mexendo em coisas diferentes nunca se
--     atropelam.
--   · TRANSAÇÕES SÃO APPEND-ONLY. `transacoes` aceita INSERT e nada mais —
--     sem UPDATE, sem DELETE, garantido por policy, não por convenção.
--   · SALDO NUNCA É CAMPO, É SOMA. Dinheiro se deriva de um livro imutável de
--     movimentos. Não existe "saldo = saldo - 60" para dar errado em corrida.
--   · ASSINATURA É LINHA, NÃO CONTADOR. A chave primária (proposta, signatário)
--     torna o 2-de-3 idempotente e seguro em concorrência de graça.
--
-- Rode no SQL Editor do projeto. É idempotente: pode rodar de novo.
-- ===========================================================================

-- ---------------------------------------------------------------- entidades
create table if not exists familias (
  id            bigint primary key,
  codigo        text not null unique,          -- pseudônimo (ex.: 'BOI-014') — ver nota de LGPD
  criancas      int  not null check (criancas > 0),
  carteira_end  text,
  carteira_prov text,
  carteira_rede text,
  criado_em     timestamptz not null default now()
);

comment on column familias.codigo is
  'Identificador pseudônimo. NOME DA FAMÍLIA NÃO ENTRA AQUI — ver LGPD no SUPABASE.md.';

create table if not exists condicoes (
  id          bigint primary key,
  familia_id  bigint not null references familias(id) on delete cascade,
  mes         text not null,
  tipo        text not null,
  status      text not null default 'pendente'
              check (status in ('pendente','comprovada','aguardando-assinaturas','validada-aguardando','liberada')),
  evid_hash   text,                            -- SHA-256 do comprovante; o arquivo fica no aparelho
  arquivo     text,                            -- nome do arquivo, para a família reconhecer
  atualizado_em timestamptz not null default now()
);

create table if not exists coletas (
  id         bigint primary key,
  coletor    text not null,
  material   text not null,
  kg         numeric not null check (kg > 0),
  local      text not null,
  data       date not null,
  status     text not null default 'pendente' check (status in ('pendente','validada')),
  signature  text,
  geo_lat    numeric,
  geo_lng    numeric,
  evid_hash  text,
  criado_em  timestamptz not null default now()
);

create table if not exists relatorios (
  id        bigint primary key,
  periodo   text not null,
  kg        numeric not null,
  acoes     int not null,
  signature text,
  data      date not null,
  ancoragem jsonb,                             -- { rede, hash, txId, url } quando ancorado
  criado_em timestamptz not null default now()
);

create table if not exists vendas (
  id        bigint primary key,
  tipo      text not null check (tipo in ('produto','esg','credito')),
  descricao text not null,
  comprador text not null,
  valor     numeric not null check (valor > 0),
  data      date not null,
  rastreio  text unique,                       -- código do QR da peça (RF-XXXX)
  origem    bigint[],                          -- coletas que forneceram o material
  criado_em timestamptz not null default now()
);

-- ------------------------------------------------------- cofre 2-de-3
create table if not exists propostas (
  id          bigint primary key,
  familia_id  bigint not null references familias(id) on delete cascade,
  condicao_id bigint not null references condicoes(id) on delete cascade,
  valor       numeric not null check (valor > 0),
  status      text not null default 'aguardando'
              check (status in ('aguardando','executada','reservada')),
  signature   text,
  criada_em   timestamptz not null default now()
);

-- Uma assinatura é uma LINHA. A PK composta faz o trabalho pesado:
-- dois signatários assinando ao mesmo tempo não conflitam, e o mesmo
-- signatário assinar duas vezes é impossível — sem código de aplicação.
create table if not exists assinaturas (
  proposta_id bigint not null references propostas(id) on delete cascade,
  signatario  text   not null check (signatario in ('viva','detrash','comunidade')),
  assinado_em timestamptz not null default now(),
  primary key (proposta_id, signatario)
);

create or replace view propostas_com_assinaturas as
  select p.*,
         coalesce(count(a.signatario), 0) as assinaturas,
         coalesce(array_agg(a.signatario order by a.assinado_em)
                  filter (where a.signatario is not null), '{}') as quem_assinou
  from propostas p
  left join assinaturas a on a.proposta_id = p.id
  group by p.id;

-- ------------------------------------------- registro auditável (append-only)
-- A chave é a signature, derivada do CONTEÚDO da transação — não o seq.
-- seq vem do tamanho do array local: dois aparelhos offline criariam o mesmo
-- seq com conteúdos diferentes, e um seria descartado em silêncio ao sincronizar.
create table if not exists transacoes (
  signature      text primary key,
  seq            bigint not null,              -- ordenação local, sem unicidade global
  slot           bigint not null,
  tipo           text   not null,
  descricao      text   not null,
  valor          numeric not null default 0,
  prev_signature text   not null,
  taxa           numeric,
  meta           jsonb,                        -- propostaId, familiaId, vendaId, real…
  ts             timestamptz not null default now()
);

comment on table transacoes is
  'APPEND-ONLY: as policies permitem apenas INSERT. Alterar ou apagar linha aqui '
  'quebraria a cadeia de signatures e a auditoria — por isso é proibido no banco, '
  'não apenas no aplicativo.';

-- ------------------------------------------------- dinheiro (livro imutável)
-- Saldo não é campo: é a soma dos movimentos. Elimina a corrida clássica de
-- "ler saldo, subtrair, gravar" entre dois aparelhos.
-- (transacao_sig, caixa) é chave natural: cada transação produz no máximo um
-- movimento por caixa. Sem ela, o reenvio da fila de sincronização duplicaria
-- dinheiro — id `bigserial` não protege contra reenvio.
create table if not exists movimentos (
  id            bigserial primary key,
  caixa         text not null check (caixa in ('renda','fundo','operacao','fundo_liberado')),
  valor         numeric not null,              -- positivo entra, negativo sai
  motivo        text not null,
  transacao_sig text not null references transacoes(signature),
  criado_em     timestamptz not null default now(),
  constraint movimentos_por_transacao unique (transacao_sig, caixa)
);

create or replace view saldos as
  select caixa, sum(valor) as saldo from movimentos group by caixa;

-- Extrato da família: mesma ideia. O saldo dela é a soma do que entrou e saiu.
-- Mesma razão do movimentos: (transacao_sig, familia_id) é a chave natural.
create table if not exists extrato (
  id            bigserial primary key,
  familia_id    bigint not null references familias(id) on delete cascade,
  descricao     text not null,
  valor         numeric not null,
  transacao_sig text not null references transacoes(signature),
  criado_em     timestamptz not null default now(),
  constraint extrato_por_transacao unique (transacao_sig, familia_id)
);

create or replace view saldo_familia as
  select familia_id, sum(valor) as saldo from extrato group by familia_id;

create index if not exists idx_condicoes_familia on condicoes(familia_id);
create index if not exists idx_extrato_familia  on extrato(familia_id);
create index if not exists idx_transacoes_slot  on transacoes(slot);
create index if not exists idx_transacoes_seq   on transacoes(seq);
create index if not exists idx_propostas_status on propostas(status);

-- ===========================================================================
-- RLS — Row Level Security
--
-- ⚠️ LEIA ANTES DE USAR COM DADO REAL.
--
-- As policies abaixo servem ao PILOTO DEMONSTRATIVO: a chave anônima está no
-- frontend, portanto qualquer pessoa com a URL do site consegue ler estas
-- tabelas e inserir linhas. Isso é aceitável só porque:
--
--   · não há nome, CPF, endereço nem dado de criança em nenhuma coluna
--     (familias.codigo é pseudônimo; comprovantes existem só como hash);
--   · `transacoes` não aceita UPDATE nem DELETE, então o registro de auditoria
--     não pode ser reescrito nem por quem tem a chave;
--   · o dinheiro é simulado.
--
-- Para operar com famílias reais é OBRIGATÓRIO trocar por Supabase Auth com
-- papéis (coletor, validador, família) — o esboço está no fim do SUPABASE.md.
-- ===========================================================================

alter table familias   enable row level security;
alter table condicoes  enable row level security;
alter table coletas    enable row level security;
alter table relatorios enable row level security;
alter table vendas     enable row level security;
alter table propostas  enable row level security;
alter table assinaturas enable row level security;
alter table transacoes enable row level security;
alter table movimentos enable row level security;
alter table extrato    enable row level security;

-- Tabelas operacionais: leitura e escrita liberadas no piloto.
drop policy if exists piloto_tudo on familias;
create policy piloto_tudo on familias   for all using (true) with check (true);
drop policy if exists piloto_tudo on condicoes;
create policy piloto_tudo on condicoes  for all using (true) with check (true);
drop policy if exists piloto_tudo on coletas;
create policy piloto_tudo on coletas    for all using (true) with check (true);
drop policy if exists piloto_tudo on relatorios;
create policy piloto_tudo on relatorios for all using (true) with check (true);
drop policy if exists piloto_tudo on vendas;
create policy piloto_tudo on vendas     for all using (true) with check (true);
drop policy if exists piloto_tudo on propostas;
create policy piloto_tudo on propostas  for all using (true) with check (true);

-- Append-only: só INSERT e SELECT. A ausência de policy de UPDATE/DELETE já
-- basta — sob RLS, o que não tem policy é negado. Explicitado aqui para quem lê.
drop policy if exists append_ler on transacoes;
drop policy if exists append_inserir on transacoes;
create policy append_ler     on transacoes for select using (true);
create policy append_inserir on transacoes for insert with check (true);

drop policy if exists append_ler on assinaturas;
drop policy if exists append_inserir on assinaturas;
create policy append_ler     on assinaturas for select using (true);
create policy append_inserir on assinaturas for insert with check (true);

drop policy if exists append_ler on movimentos;
drop policy if exists append_inserir on movimentos;
create policy append_ler     on movimentos for select using (true);
create policy append_inserir on movimentos for insert with check (true);

drop policy if exists append_ler on extrato;
drop policy if exists append_inserir on extrato;
create policy append_ler     on extrato for select using (true);
create policy append_inserir on extrato for insert with check (true);
