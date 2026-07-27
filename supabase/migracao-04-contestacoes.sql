-- ===========================================================================
-- MIGRAÇÃO 04 — Canal de contestação da família (sem conta, sem abrir a base)
--
-- ── O PROBLEMA REAL ───────────────────────────────────────────────────────
-- A família NÃO TEM CONTA — isso é decisão de desenho: dar login e senha para a
-- mãe em Boipeba seria transferir a ela o custo de um problema nosso. Mas desde
-- a migração 02 a base só responde a quem tem sessão. Consequência que só
-- aparece em campo: tudo o que ela faz no celular dela (contestar um peso,
-- enviar o hash do comprovante) fica preso no aparelho. Na demonstração o app da
-- família e o painel rodam no mesmo navegador e parece funcionar. Não funciona.
--
-- ── A SOLUÇÃO: CAIXA DE ENTRADA, NÃO ACESSO ──────────────────────────────
-- O aparelho da família ganha exatamente dois direitos, e nada além:
--
--   1. DEPOSITAR uma contestação (INSERT), sem poder ler nada;
--   2. LER A RESPOSTA DA PRÓPRIA contestação, e só dela, por meio de uma função
--      que exige o SEGREDO gerado no aparelho no momento em que ela reclamou.
--
-- Não é `anon` com SELECT liberado — isso seria a base pública de volta. É
-- capacidade: quem tem o segredo lê aquela linha; quem não tem, não lê nenhuma.
-- O segredo nasce no celular, nunca é exibido e nunca sai de lá exceto nesta
-- chamada.
--
-- ── O QUE ISTO ACEITA COMO RISCO, DITO EM VOZ ALTA ───────────────────────
-- Com INSERT liberado ao papel anônimo, alguém com a URL do site pode inserir
-- contestação FALSA, inclusive no código de outra família, ou encher a tabela.
-- Não há como evitar isso sem dar credencial à família, e dar credencial é o que
-- estamos evitando. O que reduz o dano:
--
--   · o CHECK abaixo impede fabricar contestação já "resolvida" ou com resposta
--     — o papel anônimo só consegue criar reclamação ABERTA e sem resposta;
--   · contestação não move dinheiro. O que ela dispara é conferência humana, e a
--     correção de peso continua limitada a coleta ainda não validada;
--   · a operação confirma com a família antes de agir — está no runbook.
--
-- Contestação falsa gera trabalho. Contestação impossível gera injustiça
-- silenciosa. Preferimos o trabalho.
--
-- Rode no SQL Editor. Idempotente.
-- ===========================================================================

create table if not exists contestacoes (
  id            bigint primary key,
  familia_id    bigint not null,
  tipo          text not null check (tipo in ('coleta','compromisso')),
  alvo_id       bigint,
  alvo_desc     text,
  motivo        text not null,
  detalhe       text,
  -- segredo de leitura: nasce no aparelho da família, nunca é exibido
  chave_leitura text not null,
  criado_em     timestamptz not null default now(),
  status        text not null default 'aberta' check (status in ('aberta','respondida','resolvida')),
  resposta      text,
  respondido_em timestamptz,
  respondido_por uuid references auth.users(id)
);

comment on table contestacoes is
  'Canal de reclamação da família. APPEND-ONLY: não há policy de DELETE para '
  'ninguém. Apagar reclamação é o jeito mais fácil de um programa parecer que '
  'não tem nenhuma.';
comment on column contestacoes.chave_leitura is
  'Segredo gerado no celular da família. É o que permite a ela ler a resposta '
  'sem ter conta — ver contestacao_por_chave().';

create index if not exists idx_contest_familia on contestacoes(familia_id);
create index if not exists idx_contest_status on contestacoes(status);
create index if not exists idx_contest_chave on contestacoes(chave_leitura);

alter table contestacoes enable row level security;

-- ---------------------------------------------------------------- leitura
-- A operação lê tudo (é quem responde), respeitando o consentimento da família.
drop policy if exists contest_ler on contestacoes;
create policy contest_ler on contestacoes for select to authenticated
  using (meu_papel() is not null and consentida(familia_id));

-- O papel anônimo NÃO tem policy de SELECT. Nem uma. A leitura da família passa
-- pela função com segredo, mais abaixo.

-- ---------------------------------------------------------------- depósito
-- O aparelho da família deposita. O CHECK é o que impede forjar uma reclamação
-- que já nasce respondida ou resolvida — sem ele, qualquer um poderia inserir
-- "resolvida: já pagamos" e sujar a prestação de contas.
drop policy if exists contest_depositar on contestacoes;
create policy contest_depositar on contestacoes for insert to anon, authenticated
  with check (
    status = 'aberta'
    and resposta is null
    and respondido_em is null
    and respondido_por is null
    and char_length(motivo) between 3 and 200
    and char_length(coalesce(detalhe, '')) <= 300
    and char_length(chave_leitura) between 16 and 128
  );

-- ---------------------------------------------------------------- resposta
-- Responder é ato da operação, e não pode reabrir nem apagar o que veio.
drop policy if exists contest_responder on contestacoes;
create policy contest_responder on contestacoes for update to authenticated
  using (meu_papel() in ('validador','gestor'))
  with check (
    meu_papel() in ('validador','gestor')
    and resposta is not null
    and status in ('respondida','resolvida')
  );

-- Sem policy de DELETE, de propósito. Sob RLS, o que não tem policy é negado.

-- ===========================================================================
-- LEITURA POR SEGREDO — como a família recebe a resposta sem ter conta
--
-- `security definer` para poder ler a tabela cuja policy nega o anônimo; a
-- proteção não é a policy, é o segredo: sem ele a função não devolve linha. E
-- ela devolve SÓ os campos da resposta — não vaza detalhe de outras famílias
-- nem o próprio segredo.
-- ===========================================================================
create or replace function contestacao_por_chave(chave text)
  returns table (id bigint, status text, resposta text, respondido_em timestamptz)
  language sql stable security definer set search_path = public as
$$
  select c.id, c.status, c.resposta, c.respondido_em
    from contestacoes c
   where c.chave_leitura = chave
     and char_length(chave) >= 16   -- chave curta não consulta nada
   limit 1
$$;

comment on function contestacao_por_chave(text) is
  'Capacidade de leitura: quem tem o segredo lê aquela contestação, quem não '
  'tem não lê nenhuma. É o que permite a família acompanhar a resposta sem ter '
  'credencial no sistema.';

revoke all on function contestacao_por_chave(text) from public;
grant execute on function contestacao_por_chave(text) to anon, authenticated;

-- ===========================================================================
-- CONFERÊNCIA
--
--   -- o anônimo NÃO deve ver linha nenhuma (esperado: 0)
--   set role anon; select count(*) from contestacoes; reset role;
--
--   -- mas consegue depositar, e só aberta:
--   --   INSERT com status='resolvida' tem de FALHAR.
--
--   -- e a leitura por segredo tem de devolver 1 linha para o segredo certo
--   -- e 0 para qualquer outro:
--   select * from contestacao_por_chave('<segredo-de-teste>');
--
-- `npm test -- autorizacao` verifica isso tudo contra o banco.
-- ===========================================================================
