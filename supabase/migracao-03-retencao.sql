-- ===========================================================================
-- MIGRAÇÃO 03 — Política de retenção
--
-- O QUE FALTAVA
-- O consentimento tinha revogação e não tinha PRAZO. Dado sem prazo é dado para
-- sempre: a LGPD (art. 15, I e III; art. 16) exige que o tratamento termine
-- quando a finalidade é alcançada ou o consentimento é retirado, e que o dado
-- seja eliminado depois disso — salvo obrigação legal ou uso anonimizado.
--
-- ── A DECISÃO DIFÍCIL: O QUE APAGAR E O QUE MANTER ───────────────────────
-- `transacoes` é APPEND-ONLY por desenho. Isso colide de frente com "eliminar o
-- dado", e a colisão não se resolve escolhendo um lado e escondendo o outro.
-- Resolve-se assim:
--
--   APAGA (dado ligado à pessoa):
--     familias, condicoes (tipo da condição é dado de saúde/educação), extrato
--
--   FICA (registro contábil pseudonimizado):
--     transacoes, movimentos — não têm nome nem código de família nas colunas,
--     e as descrições já sobem pseudonimizadas (ver fazTradutor em
--     sincronizacao.js). É prestação de contas de dinheiro público-filantrópico,
--     base legal distinta do consentimento, e depois do expurgo não há como
--     religar uma linha dessas a uma pessoa.
--
--   FICA MARCADO (prova do ciclo de vida):
--     consentimentos, com `expurgado_em` preenchido. Apagar a prova de que
--     houve consentimento, prazo e expurgo destruiria justamente a
--     demonstrabilidade que o art. 8º §1º exige.
--
-- Ou seja: o que é pessoal desaparece; o que resta é contabilidade anônima e o
-- histórico do próprio consentimento. Não é "apaguei tudo" nem "guardei tudo".
--
-- Rode no SQL Editor. Idempotente.
-- ===========================================================================

-- ------------------------------------------------------------------- prazo
alter table consentimentos
  add column if not exists validade_meses int not null default 24
    check (validade_meses between 1 and 120),
  add column if not exists expurgado_em timestamptz,
  add column if not exists renovado_de bigint;   -- id do consentimento anterior

comment on column consentimentos.validade_meses is
  '24 meses por padrão: cobre um ciclo de piloto com folga para renovação em '
  'visita de campo, sem virar prazo indeterminado disfarçado.';
comment on column consentimentos.renovado_de is
  'Renovar não altera o registro antigo — cria um novo apontando para ele. '
  'O histórico de prazos fica auditável.';

/** Quando este consentimento vence. */
create or replace function vence_em(c consentimentos) returns timestamptz
  language sql immutable as
$$ select c.coletado_em + (c.validade_meses || ' months')::interval $$;

/**
 * Consentimento vigente: não revogado, não expurgado e dentro do prazo.
 *
 * Substitui a checagem anterior (só `revogado_em is null`) em TODAS as policies
 * — sem isso o prazo seria decoração: venceria e o dado continuaria legível.
 */
create or replace function consentida(fid bigint) returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from consentimentos c
      where c.familia_id = fid
        and c.revogado_em is null
        and c.expurgado_em is null
        and c.coletado_em + (c.validade_meses || ' months')::interval > now()
   ) $$;

-- ------------------------------------------------------- o que está vencendo
-- Serve à operação: renovar em visita de campo é trabalho de agenda, não de
-- emergência. Só quem tem papel vê.
create or replace view retencao_status as
  select c.id,
         c.familia_id,
         c.versao_termo,
         c.coletado_em,
         c.coletado_em + (c.validade_meses || ' months')::interval as vence_em,
         c.revogado_em,
         c.expurgado_em,
         case
           when c.expurgado_em is not null then 'expurgado'
           when c.revogado_em is not null  then 'revogado'
           when c.coletado_em + (c.validade_meses || ' months')::interval <= now() then 'vencido'
           when c.coletado_em + (c.validade_meses || ' months')::interval <= now() + interval '60 days' then 'vencendo'
           else 'vigente'
         end as situacao,
         -- prazo de carência antes do expurgo, contado do fim da autorização
         case
           when c.revogado_em is not null then c.revogado_em + interval '30 days'
           else c.coletado_em + (c.validade_meses || ' months')::interval + interval '30 days'
         end as expurgar_a_partir_de
    from consentimentos c;

alter view retencao_status set (security_invoker = on);

comment on view retencao_status is
  'Carência de 30 dias entre o fim da autorização e o expurgo: dá tempo de a '
  'família mudar de ideia ou renovar numa próxima visita, e evita apagar dado '
  'por causa de um atraso de agenda da operação.';

-- ===========================================================================
-- EXPURGO
--
-- Feito por função `security definer`, não por policy de DELETE aberta. Motivo:
-- uma policy "gestor pode apagar familia" seria usada para apagar QUALQUER
-- família, a qualquer momento. Aqui só existe um caminho, e ele exige que o
-- prazo tenha vencido — a condição está dentro da função, não na intenção de
-- quem chama.
-- ===========================================================================

create or replace function expurgar_familia(fid bigint)
  returns table (familia_id bigint, condicoes_apagadas int, extrato_apagado int)
  language plpgsql security definer set search_path = public as
$$
declare
  liberado boolean;
  n_cond int := 0;
  n_ext  int := 0;
begin
  if (select meu_papel() not in ('gestor')) then
    raise exception 'expurgo é ato de gestor';
  end if;

  -- Só expurga o que já passou da carência. Família com consentimento vigente
  -- não é apagável por este caminho — nem por engano, nem de propósito.
  select exists (
    select 1 from retencao_status r
     where r.familia_id = fid
       and r.expurgado_em is null
       and r.expurgar_a_partir_de <= now()
  ) into liberado;

  if not liberado then
    raise exception 'família % não está liberada para expurgo (consentimento vigente ou dentro da carência de 30 dias)', fid;
  end if;

  delete from extrato where extrato.familia_id = fid;
  get diagnostics n_ext = row_count;

  delete from condicoes where condicoes.familia_id = fid;
  get diagnostics n_cond = row_count;

  -- propostas referenciam família; somem com ela (o dinheiro fica em movimentos)
  delete from propostas where propostas.familia_id = fid;
  delete from familias  where familias.id = fid;

  update consentimentos
     set expurgado_em = now()
   where consentimentos.familia_id = fid
     and consentimentos.expurgado_em is null;

  return query select fid, n_cond, n_ext;
end;
$$;

comment on function expurgar_familia(bigint) is
  'Apaga o dado pessoal e MANTÉM transacoes/movimentos (contabilidade '
  'pseudonimizada) e o registro do consentimento marcado como expurgado.';

/** Expurga tudo que já venceu a carência. Uma linha por família tratada. */
create or replace function expurgar_vencidos()
  returns table (familia_id bigint, condicoes_apagadas int, extrato_apagado int)
  language plpgsql security definer set search_path = public as
$$
declare r record;
begin
  if (select meu_papel() not in ('gestor')) then
    raise exception 'expurgo é ato de gestor';
  end if;
  for r in
    select distinct s.familia_id from retencao_status s
     where s.expurgado_em is null and s.expurgar_a_partir_de <= now()
  loop
    return query select * from expurgar_familia(r.familia_id);
  end loop;
end;
$$;

-- ------------------------------------------------------------------ renovação
-- Renovar é registrar consentimento NOVO apontando para o antigo. O antigo não
-- é alterado: o histórico de prazos precisa continuar legível.
drop policy if exists consent_ler on consentimentos;
create policy consent_ler on consentimentos for select to authenticated
  using (meu_papel() is not null);

-- ===========================================================================
-- COMO OPERAR
--
--   -- o que vence nos próximos 60 dias (rodar antes de cada visita de campo)
--   select familia_id, situacao, vence_em::date, expurgar_a_partir_de::date
--     from retencao_status
--    where situacao in ('vencendo','vencido','revogado')
--    order by vence_em;
--
--   -- expurgar o que já passou da carência (gestor)
--   select * from expurgar_vencidos();
--
-- Depois do expurgo, confira que sobrou só contabilidade anônima:
--
--   select count(*) from familias;    -- as expurgadas não estão aqui
--   select count(*) from transacoes;  -- continua íntegro (append-only)
--   select familia_id, expurgado_em from retencao_status where expurgado_em is not null;
--
-- ── O QUE ESTA MIGRAÇÃO NÃO RESOLVE ─────────────────────────────────────
-- O expurgo não roda sozinho. Agendar (pg_cron, ou uma rotina do Instituto
-- Vivá) é decisão de operação, e preferi não instalar agendador escondido num
-- projeto que ainda não tem quem o monitore: expurgo automático que ninguém
-- acompanha apaga dado em silêncio. A consulta acima, numa rotina mensal, é o
-- suficiente para o piloto — e está no runbook de implantação.
-- ===========================================================================
