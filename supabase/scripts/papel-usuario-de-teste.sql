-- ===========================================================================
-- PAPEL PARA O USUÁRIO DE TESTES
--
-- Rode DEPOIS de criar o usuário em Authentication → Users com "Auto Confirm User".
--
-- Criar por "signup" (API) NÃO funciona neste projeto: o serviço de e-mail padrão
-- do Supabase só entrega para endereço de MEMBRO do projeto, então o e-mail de
-- confirmação nunca chega e o usuário fica preso em "Email not confirmed".
-- Cole isto inteiro no SQL Editor e execute.
--
-- Por que `signatario = null`: este usuário serve para a suíte abrir sessão, não
-- para assinar no cofre. Dar a ele 'viva' criaria DUAS linhas com o mesmo
-- signatário, e aí o 2-de-3 voltaria a poder ser cumprido por uma organização só
-- — exatamente a falha que a consulta de conferência do IMPLANTACAO.md procura.
-- Com null ele lê e valida, e continua sem poder assinar.
-- ===========================================================================

insert into papeis (user_id, papel, nome, organizacao, signatario)
select id, 'gestor', 'Suite de testes', 'Instituto Vivá', null
  from auth.users
 where email = 'raizes.testes@gmail.com'
on conflict (user_id) do update
  set papel = excluded.papel,
      nome = excluded.nome,
      organizacao = excluded.organizacao,
      signatario = excluded.signatario;

-- ---------------------------------------------------------------- conferência
-- Esperado: uma linha, com email_confirmado = true.
-- Se email_confirmado vier false, volte em Authentication → Users e confirme —
-- sem isso não há sessão, e as suítes continuam pulando.
select p.nome, p.papel, p.organizacao, p.signatario, u.email,
       (u.email_confirmed_at is not null) as email_confirmado
  from papeis p
  join auth.users u on u.id = p.user_id
 where u.email = 'raizes.testes@gmail.com';

-- E a checagem que importa para o 2-de-3 continuar honesto (esperado: 0 linhas):
select signatario, count(*) from papeis
 where signatario is not null group by signatario having count(*) > 1;

-- ---------------------------------------------------------------------------
-- PARA REMOVER o usuário de testes depois (não é obrigatório):
--   delete from papeis where user_id in
--     (select id from auth.users where email = 'raizes.testes@gmail.com');
--   -- e apague o usuário em Authentication → Users.
-- ===========================================================================
