-- ===========================================================================
-- LIMPAR OS DADOS DE DEMONSTRAÇÃO
--
-- ⚠️  APAGA DADO. Leia antes de rodar.
--
-- O que há na base hoje foi criado pelos testes automatizados e pela demo:
-- famílias com código `TESTE-*` / `RT-*`, transações com descrição `[teste]`,
-- coletas de coletores fictícios. Nenhuma dessas famílias tem termo de
-- consentimento — e eu não criei registro de consentimento para elas de
-- propósito: consentimento fabricado é pior que consentimento nenhum, porque
-- mente exatamente na prova que a LGPD pede. Por isso elas já não são lidas
-- pelas policies; este script serve para também não ficarem gravadas.
--
-- POR QUE ISTO NÃO RODA PELO APLICATIVO
-- Nenhuma policy permite DELETE nestas tabelas — de propósito. O SQL Editor
-- roda como dono do banco e ignora RLS, então este é o único caminho, e ele
-- exige um ser humano decidindo. É o comportamento certo para uma operação que
-- apaga registro contábil.
--
-- COMO USAR
--   1. rode a PARTE 1 e olhe os números;
--   2. se fizerem sentido, rode a PARTE 2.
-- ===========================================================================

-- ---------------------------------------------------------------- PARTE 1
-- Confira o que vai embora ANTES de apagar. Se algum número surpreender, pare.
select 'familias sem consentimento' as o_que, count(*) as quantas
  from familias f
 where not exists (select 1 from consentimentos c where c.familia_id = f.id)
union all
select 'transacoes marcadas [teste]', count(*)
  from transacoes where descricao like '%[teste]%'
union all
select 'coletas de teste', count(*)
  from coletas where coletor like '%[teste]%' or coletor like 'Nilza-%'
union all
select 'vendas de teste', count(*)
  from vendas where descricao like '%[teste]%' or rastreio like 'RT%'
union all
select 'consentimentos de teste', count(*)
  from consentimentos where versao_termo like '%teste%'
union all
-- a tabela de contestações veio depois deste script; sem esta linha o lixo de
-- teste do canal da família ficaria na base de piloto sem ninguém notar
select 'contestações de teste', count(*)
  from contestacoes
 where coalesce(detalhe, '') like '%[teste]%'
    or coalesce(alvo_desc, '') like '%[teste]%'
    or coalesce(resposta, '') like '%[teste]%'
    or motivo = 'forjada';

-- ---------------------------------------------------------------- PARTE 2
-- A ordem respeita as chaves estrangeiras: filhos antes dos pais.
begin;

-- 1. dado ligado a família sem consentimento
delete from extrato   where familia_id in (
  select f.id from familias f
   where not exists (select 1 from consentimentos c where c.familia_id = f.id));
delete from assinaturas where proposta_id in (
  select p.id from propostas p join familias f on f.id = p.familia_id
   where not exists (select 1 from consentimentos c where c.familia_id = f.id));
delete from propostas where familia_id in (
  select f.id from familias f
   where not exists (select 1 from consentimentos c where c.familia_id = f.id));
delete from condicoes where familia_id in (
  select f.id from familias f
   where not exists (select 1 from consentimentos c where c.familia_id = f.id));
delete from familias f
 where not exists (select 1 from consentimentos c where c.familia_id = f.id);

-- 2. contabilidade e registro das execuções de teste
--    movimentos antes de transacoes: a FK aponta para a signature
delete from movimentos where transacao_sig in (
  select signature from transacoes where descricao like '%[teste]%');
delete from transacoes where descricao like '%[teste]%';

-- 3. coletas, vendas e relatórios fictícios
delete from coletas where coletor like '%[teste]%' or coletor like 'Nilza-%';
delete from vendas  where descricao like '%[teste]%' or rastreio like 'RT%';
delete from relatorios where periodo like '%[teste]%';

-- 4. consentimentos criados pelos testes
delete from consentimentos where versao_termo like '%teste%';

-- 5. contestações de teste.
--    O app NÃO consegue apagar contestação (não há policy de DELETE, e isso é de
--    propósito: reclamação se responde, não se apaga). O SQL Editor roda como
--    dono e ignora RLS — este é o único caminho, e exige um humano decidindo.
delete from contestacoes
 where coalesce(detalhe, '') like '%[teste]%'
    or coalesce(alvo_desc, '') like '%[teste]%'
    or coalesce(resposta, '') like '%[teste]%'
    or motivo = 'forjada';

-- e as contestações de famílias que deixaram de existir no passo 1
delete from contestacoes c
 where not exists (select 1 from familias f where f.id = c.familia_id);

commit;

-- ---------------------------------------------------------------- conferência
-- O esperado depois disso: base vazia ou só com dado real, e nenhuma família
-- sem consentimento.
select 'familias' as tabela, count(*) from familias
union all select 'contestacoes', count(*) from contestacoes
union all select 'consentimentos', count(*) from consentimentos
union all select 'transacoes', count(*) from transacoes
union all select 'movimentos', count(*) from movimentos
union all select 'coletas', count(*) from coletas
union all select 'familias sem consentimento (deve ser 0)',
  (select count(*) from familias f
    where not exists (select 1 from consentimentos c where c.familia_id = f.id));

-- NOTA: rodar os testes de novo recria dado de teste — é o trabalho deles.
-- Rode este script por último, quando a base for virar base de piloto.
