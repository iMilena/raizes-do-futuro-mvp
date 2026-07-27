-- ===========================================================================
-- DAR PAPEL ÀS PESSOAS DA OPERAÇÃO — por e-mail, sem copiar UUID
--
-- Rode DEPOIS de:
--   1. migracao-02-auth-papeis-consentimento.sql
--   2. criar os usuários em Authentication → Users (marcando Auto Confirm User)
--
-- COMO USAR: troque os 3 e-mails e os 3 nomes abaixo. Nada mais.
-- O UUID é buscado em auth.users pelo e-mail — copiar UUID na mão é onde isso
-- normalmente dá errado (um caractere trocado e a pessoa entra sem papel, o que
-- na tela parece "o app não funciona").
--
-- Rodar de novo é seguro: atualiza o papel de quem já existe.
-- ===========================================================================

with pessoas (email, papel, nome, organizacao, signatario) as (
  values
    -- e-mail cadastrado no Auth        papel         nome de exibição      organização        assina como
    ('troque-1@exemplo.org',           'gestor',     'Nome da pessoa 1',   'Instituto Vivá',  'viva'),
    ('troque-2@exemplo.org',           'validador',  'Nome da pessoa 2',   'DeTrash',         'detrash'),
    ('troque-3@exemplo.org',           'coletor',    'Nome da pessoa 3',   'Comunidade',      null)
)
insert into papeis (user_id, papel, nome, organizacao, signatario)
select u.id, p.papel, p.nome, p.organizacao, p.signatario
  from pessoas p
  join auth.users u on lower(u.email) = lower(p.email)
on conflict (user_id) do update
  set papel = excluded.papel,
      nome = excluded.nome,
      organizacao = excluded.organizacao,
      signatario = excluded.signatario;

-- ---------------------------------------------------------------- conferência
-- Se alguma linha esperada não aparecer, o e-mail não existe no Auth (confira
-- a grafia na tela Authentication → Users).
select p.nome, p.papel, p.organizacao, p.signatario, u.email,
       (u.email_confirmed_at is not null) as email_confirmado
  from papeis p
  join auth.users u on u.id = p.user_id
 order by p.papel;

-- Duas armadilhas que esta consulta revela:
--
-- · email_confirmado = false → a pessoa NÃO consegue abrir sessão. Volte em
--   Authentication → Users e confirme (ou recrie com Auto Confirm User).
--
-- · dois signatarios iguais → o 2-de-3 volta a poder ser cumprido por UMA
--   organização, que é exatamente o que o multisig existe para impedir.
--   Para checar:
--       select signatario, count(*) from papeis
--        where signatario is not null group by signatario having count(*) > 1;
