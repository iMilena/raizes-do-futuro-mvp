-- ===========================================================================
-- MIGRAÇÃO 02 — Autenticação por papel e registro de consentimento
--
-- O QUE ESTA MIGRAÇÃO CONSERTA
--
-- Até aqui as policies eram `using (true)`: a chave anônima está no frontend,
-- portanto qualquer pessoa com o endereço do site lia a base inteira e inseria
-- linhas. Era aceitável para piloto demonstrativo — sem nome, sem CPF, sem dado
-- de criança, dinheiro simulado — e estava escrito em voz alta no schema.sql.
--
-- Não é aceitável com família real. Esta migração troca isso por três coisas:
--
--   1. ANÔNIMO NÃO ACESSA NADA. Nenhuma policy responde a `anon`. Quem abre o
--      site sem entrar continua com o app funcionando 100% local — o aplicativo
--      é local-first e não depende da nuvem para nada.
--   2. PAPEL DECIDE O QUE PODE. `coletor` registra coleta; `validador` valida e
--      assina; `gestor` faz os dois e cuida de cadastro. Sem linha em `papeis`,
--      estar logado não dá acesso.
--   3. CONSENTIMENTO É PRÉ-REQUISITO DE BANCO. Não existe família na nuvem sem
--      registro de consentimento ativo — garantido por policy, não por tela.
--      Revogar o consentimento faz os dados daquela família sumirem da leitura.
--
-- ── A ASSINATURA 2-DE-3 PASSA A SER REAL ──────────────────────────────────
-- Antes, quem tivesse a chave assinava pelas três organizações — o 2-de-3 era
-- só desenho de tela. Agora `papeis.signatario` amarra a pessoa a UMA
-- organização, e a policy recusa assinar em nome de outra. Duas organizações
-- distintas passam a ser realmente necessárias.
--
-- Rode no SQL Editor. Idempotente. Depois dela, LEIA O FIM DO ARQUIVO:
-- há dois passos manuais (criar usuário, dar papel) sem os quais ninguém entra.
-- ===========================================================================

-- ------------------------------------------------------------------- papéis
create table if not exists papeis (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  papel      text not null check (papel in ('coletor','validador','gestor')),
  nome       text not null,                  -- nome de exibição da PESSOA da operação
  organizacao text,                          -- 'Instituto Vivá', 'DeTrash'…
  -- amarra a pessoa a uma das três organizações do cofre. NULL = não assina.
  signatario text check (signatario in ('viva','detrash','comunidade')),
  criado_em  timestamptz not null default now()
);

comment on table papeis is
  'Quem pode o quê. Estar autenticado não basta: sem linha aqui, todas as '
  'policies recusam. Cadastrar por aqui é ato deliberado de administração.';

alter table papeis enable row level security;

-- cada pessoa vê a própria linha (para o app saber o papel e o nome)
drop policy if exists ver_meu_papel on papeis;
create policy ver_meu_papel on papeis for select to authenticated
  using (user_id = auth.uid());

-- funções auxiliares: `stable` para o planner reaproveitar dentro da query
create or replace function meu_papel() returns text
  language sql stable security definer set search_path = public as
$$ select papel from papeis where user_id = auth.uid() $$;

create or replace function meu_signatario() returns text
  language sql stable security definer set search_path = public as
$$ select signatario from papeis where user_id = auth.uid() $$;

comment on function meu_papel() is
  'security definer porque a policy de outras tabelas precisa ler papeis de '
  'quem está chamando, e a policy de papeis limita a leitura à própria linha.';

-- --------------------------------------------------------- consentimento
-- Registro do consentimento do responsável, nos termos da LGPD (art. 8º: o
-- consentimento deve ser específico, informado e demonstrável).
--
-- Não tem FK para `familias` de propósito: o consentimento é registrado ANTES
-- da família existir na nuvem, e é justamente o que autoriza criá-la.
create table if not exists consentimentos (
  id            bigint primary key,
  familia_id    bigint not null,
  versao_termo  text not null,                -- ex.: 'termo-piloto-boipeba-v1'
  finalidades   text[] not null,              -- para que o dado será usado
  base_legal    text not null default 'consentimento do titular (LGPD art. 7º, I)',
  -- COMO o consentimento foi coletado. Não guardamos assinatura digitalizada
  -- nem foto de documento: só a forma e o hash do termo apresentado.
  forma         text not null check (forma in ('presencial-assinado','presencial-verbal','whatsapp','formulario')),
  termo_hash    text not null,                -- SHA-256 do texto exato apresentado
  coletado_por  uuid not null references auth.users(id),
  coletado_em   timestamptz not null default now(),
  revogado_em   timestamptz,
  revogado_motivo text
);

comment on table consentimentos is
  'Demonstrabilidade do consentimento (LGPD art. 8º §1º). Append-only, exceto '
  'a revogação — que é direito do titular e por isso o único UPDATE permitido.';

create index if not exists idx_consent_familia on consentimentos(familia_id);

/**
 * Existe consentimento ativo para esta família?
 * Usada nas policies de todas as tabelas que carregam dado ligado à família.
 */
create or replace function consentida(fid bigint) returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from consentimentos
      where familia_id = fid and revogado_em is null
   ) $$;

alter table consentimentos enable row level security;

drop policy if exists consent_ler on consentimentos;
create policy consent_ler on consentimentos for select to authenticated
  using (meu_papel() is not null);

-- Registrar consentimento é ato de campo: coletor não faz, gestor e validador sim.
--
-- `coletado_por` guarda QUEM COLHEU, e por isso NÃO é comparado com auth.uid():
-- quem envia pode ser outro aparelho da operação sincronizando depois. Exigir
-- que coincidissem travaria a fila para sempre — ela é FIFO e para no primeiro
-- erro, então um consentimento colhido pela Ana e sincronizado pelo aparelho do
-- João bloquearia todo o trabalho atrás dele.
drop policy if exists consent_inserir on consentimentos;
create policy consent_inserir on consentimentos for insert to authenticated
  with check (meu_papel() in ('validador','gestor') and coletado_por is not null);

-- revogação: só marca revogado_em/motivo. Não há policy de DELETE — o registro
-- da revogação é parte da prova e não pode desaparecer.
drop policy if exists consent_revogar on consentimentos;
create policy consent_revogar on consentimentos for update to authenticated
  using (meu_papel() in ('validador','gestor') and revogado_em is null)
  with check (revogado_em is not null);

-- ===========================================================================
-- POLICIES POR PAPEL — substituem as `piloto_tudo`
-- ===========================================================================

-- some com o acesso aberto anterior, em todas as tabelas
drop policy if exists piloto_tudo on familias;
drop policy if exists piloto_tudo on condicoes;
drop policy if exists piloto_tudo on coletas;
drop policy if exists piloto_tudo on relatorios;
drop policy if exists piloto_tudo on vendas;
drop policy if exists piloto_tudo on propostas;
drop policy if exists append_ler on transacoes;
drop policy if exists append_inserir on transacoes;
drop policy if exists append_ler on assinaturas;
drop policy if exists append_inserir on assinaturas;
drop policy if exists append_ler on movimentos;
drop policy if exists append_inserir on movimentos;
drop policy if exists append_ler on extrato;
drop policy if exists append_inserir on extrato;

-- ------------------------------------------------------------------ famílias
-- Ler: qualquer papel, MAS só família com consentimento ativo. Revogar o
-- consentimento remove a família da leitura no mesmo instante.
drop policy if exists fam_ler on familias;
create policy fam_ler on familias for select to authenticated
  using (meu_papel() is not null and consentida(id));

-- Criar: exige consentimento já registrado. Esta é a trava principal da LGPD
-- neste sistema — no banco, não na tela.
drop policy if exists fam_criar on familias;
create policy fam_criar on familias for insert to authenticated
  with check (meu_papel() in ('validador','gestor') and consentida(id));

drop policy if exists fam_atualizar on familias;
create policy fam_atualizar on familias for update to authenticated
  using (meu_papel() in ('validador','gestor') and consentida(id))
  with check (consentida(id));

-- ------------------------------------------------------------------ condições
drop policy if exists cond_ler on condicoes;
create policy cond_ler on condicoes for select to authenticated
  using (meu_papel() is not null and consentida(familia_id));

drop policy if exists cond_escrever on condicoes;
create policy cond_escrever on condicoes for insert to authenticated
  with check (meu_papel() in ('validador','gestor') and consentida(familia_id));

drop policy if exists cond_atualizar on condicoes;
create policy cond_atualizar on condicoes for update to authenticated
  using (meu_papel() in ('validador','gestor') and consentida(familia_id))
  with check (consentida(familia_id));

-- ------------------------------------------------------------------- coletas
-- Coletor registra, mas não valida: `status` só pode nascer 'pendente'.
drop policy if exists col_ler on coletas;
create policy col_ler on coletas for select to authenticated
  using (meu_papel() is not null);

drop policy if exists col_registrar on coletas;
create policy col_registrar on coletas for insert to authenticated
  with check (
    meu_papel() in ('coletor','validador','gestor')
    and (meu_papel() <> 'coletor' or status = 'pendente')
  );

-- Validar é ato de validador/gestor. Coletor não muda status de nada.
drop policy if exists col_validar on coletas;
create policy col_validar on coletas for update to authenticated
  using (meu_papel() in ('validador','gestor'))
  with check (meu_papel() in ('validador','gestor'));

-- --------------------------------------------------- relatórios e vendas
drop policy if exists rel_ler on relatorios;
create policy rel_ler on relatorios for select to authenticated
  using (meu_papel() is not null);
drop policy if exists rel_escrever on relatorios;
create policy rel_escrever on relatorios for insert to authenticated
  with check (meu_papel() in ('validador','gestor'));
drop policy if exists rel_atualizar on relatorios;
create policy rel_atualizar on relatorios for update to authenticated
  using (meu_papel() in ('validador','gestor'))
  with check (meu_papel() in ('validador','gestor'));

drop policy if exists venda_ler on vendas;
create policy venda_ler on vendas for select to authenticated
  using (meu_papel() is not null);
drop policy if exists venda_escrever on vendas;
create policy venda_escrever on vendas for insert to authenticated
  with check (meu_papel() in ('validador','gestor'));

-- ------------------------------------------------------- cofre 2-de-3
drop policy if exists prop_ler on propostas;
create policy prop_ler on propostas for select to authenticated
  using (meu_papel() is not null);
drop policy if exists prop_criar on propostas;
create policy prop_criar on propostas for insert to authenticated
  with check (meu_papel() in ('validador','gestor') and consentida(familia_id));
drop policy if exists prop_atualizar on propostas;
create policy prop_atualizar on propostas for update to authenticated
  using (meu_papel() in ('validador','gestor'))
  with check (meu_papel() in ('validador','gestor'));

-- A trava que torna o 2-de-3 verdadeiro: você só assina pela SUA organização.
-- Sem isto, uma pessoa com a chave produzia as duas assinaturas necessárias e o
-- multisig não protegia ninguém.
drop policy if exists ass_ler on assinaturas;
create policy ass_ler on assinaturas for select to authenticated
  using (meu_papel() is not null);

drop policy if exists ass_assinar on assinaturas;
create policy ass_assinar on assinaturas for insert to authenticated
  with check (
    meu_signatario() is not null
    and signatario = meu_signatario()
  );

comment on policy ass_assinar on assinaturas is
  'Cada pessoa assina apenas em nome da organização registrada no seu papel. '
  'O 2-de-3 exige, de fato, duas organizações distintas.';

-- ------------------------------------------------- registro auditável
-- Continua append-only: não há policy de UPDATE nem de DELETE, e sob RLS o que
-- não tem policy é negado. Agora exige, além disso, papel.
drop policy if exists tx_ler on transacoes;
create policy tx_ler on transacoes for select to authenticated
  using (meu_papel() is not null);
drop policy if exists tx_inserir on transacoes;
create policy tx_inserir on transacoes for insert to authenticated
  with check (meu_papel() is not null);

drop policy if exists mov_ler on movimentos;
create policy mov_ler on movimentos for select to authenticated
  using (meu_papel() is not null);
drop policy if exists mov_inserir on movimentos;
create policy mov_inserir on movimentos for insert to authenticated
  with check (meu_papel() in ('validador','gestor'));

-- Extrato é dado ligado à família: segue o consentimento.
drop policy if exists ext_ler on extrato;
create policy ext_ler on extrato for select to authenticated
  using (meu_papel() is not null and consentida(familia_id));
drop policy if exists ext_inserir on extrato;
create policy ext_inserir on extrato for insert to authenticated
  with check (meu_papel() in ('validador','gestor') and consentida(familia_id));

-- ------------------------------------------------------------------- views
-- Views herdam a RLS das tabelas de base quando são `security_invoker`.
-- SEM ISSO A VIEW VAZA: ela roda com os direitos de quem a criou (o dono do
-- projeto) e devolve linhas que a policy da tabela negaria. É o furo clássico
-- de RLS com view, e aqui atinge exatamente as views de dinheiro.
alter view propostas_com_assinaturas set (security_invoker = on);
alter view saldos                    set (security_invoker = on);
alter view saldo_familia             set (security_invoker = on);

-- ===========================================================================
-- DOIS PASSOS MANUAIS — sem eles, ninguém entra
--
-- 1) Crie os usuários da operação em Authentication → Users → "Add user"
--    (marque "Auto Confirm User", senão não há sessão até confirmar e-mail).
--
-- 2) Dê papel a cada um. Pegue o UUID na mesma tela e rode:
--
--      insert into papeis (user_id, papel, nome, organizacao, signatario) values
--        ('<uuid-1>', 'gestor',    'Nome da pessoa', 'Instituto Vivá', 'viva'),
--        ('<uuid-2>', 'validador', 'Nome da pessoa', 'DeTrash',        'detrash'),
--        ('<uuid-3>', 'coletor',   'Nome da pessoa', 'Comunidade',      null);
--
--    Signatários diferentes de propósito: com o mesmo signatario em duas linhas,
--    o 2-de-3 volta a poder ser cumprido por uma organização só.
--
-- ── DADOS DE DEMONSTRAÇÃO JÁ EXISTENTES ──────────────────────────────────
-- As famílias que já estão na base foram criadas pelos testes, sem termo de
-- consentimento — e não vou inventar registro de consentimento para elas: um
-- consentimento fabricado é pior que consentimento nenhum, porque mente na
-- prova. Elas simplesmente deixam de ser lidas pela policy.
--
-- Para limpar a base de demonstração, rode este bloco DE PROPÓSITO:
--
--      delete from extrato;
--      delete from movimentos;
--      delete from assinaturas;
--      delete from propostas;
--      delete from condicoes;
--      delete from familias;
--      -- transacoes é append-only por policy; para limpar, use o SQL Editor
--      -- (que roda como dono e ignora RLS):
--      delete from transacoes;
--
-- ===========================================================================
