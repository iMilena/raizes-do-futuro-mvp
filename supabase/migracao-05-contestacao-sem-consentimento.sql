-- ===========================================================================
-- MIGRAÇÃO 05 — A reclamação não pode depender de consentimento
--
-- ── O BURACO QUE ISTO FECHA ───────────────────────────────────────────────
-- Na migração 04 eu pus `consentida(familia_id)` na policy de leitura das
-- contestações, por simetria com as outras tabelas de dado de família. Estava
-- errado, e o efeito é grave: o DEPÓSITO não exige consentimento (não pode
-- exigir — o aparelho da família não tem sessão), mas a LEITURA exigia. Então
-- uma família sem consentimento registrado conseguia reclamar e a operação
-- NUNCA VIA a reclamação.
--
-- Isso é pior do que não ter canal nenhum: o app aceita a reclamação, diz à
-- pessoa que o Instituto Vivá vai olhar, e o registro fica invisível. Descoberto
-- rodando a suíte com sessão de verdade — a reclamação depositada pelo celular
-- não chegava ao aparelho de quem valida, e a família sem consentimento é
-- justamente o caso mais provável de haver erro a contestar.
--
-- ── POR QUE A REGRA CERTA É ESTA ──────────────────────────────────────────
-- Consentimento é a base legal para TRATAR os dados do programa. Contestar um
-- registro errado é outra coisa: é o direito de pedir correção de dado
-- inexato (LGPD art. 18, III), e ele existe independentemente do consentimento —
-- inclusive DEPOIS de revogado, porque a pessoa pode precisar corrigir algo que
-- ficou registrado enquanto participava.
--
-- Amarrar o canal de reclamação ao consentimento é justamente inverter isso:
-- quem tem menos vínculo formal fica sem voz.
--
-- Rode no SQL Editor. Idempotente.
-- ===========================================================================

drop policy if exists contest_ler on contestacoes;
create policy contest_ler on contestacoes for select to authenticated
  using (meu_papel() is not null);

comment on policy contest_ler on contestacoes is
  'SEM gate de consentimento, de propósito: reclamação sobre dado inexato é '
  'direito do titular (LGPD art. 18, III) e não depende de consentimento — nem '
  'de o consentimento ainda estar vigente. Ver migracao-05.';

-- O resto da migração 04 continua valendo:
--   · anônimo NÃO tem policy de SELECT (a família lê a própria pelo segredo);
--   · o depósito é restrito por CHECK a reclamação ABERTA e sem resposta;
--   · responder exige validador/gestor;
--   · não há policy de DELETE para ninguém.

-- ---------------------------------------------------------------- conferência
-- Com sessão de papel, deve devolver TODAS as contestações, inclusive de família
-- sem consentimento ativo:
--   select c.id, c.familia_id, c.status,
--          exists (select 1 from consentimentos k
--                   where k.familia_id = c.familia_id and k.revogado_em is null) as tem_consentimento
--     from contestacoes c order by c.criado_em desc limit 10;
--
-- `npm test -- canal` verifica o circuito de ponta a ponta: celular sem sessão
-- deposita, aparelho da operação recebe.
-- ===========================================================================
