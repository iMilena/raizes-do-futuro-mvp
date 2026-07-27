# Implantação do piloto — o que não é código 🔑

Este arquivo existe porque três das garantias do sistema **não podem ser cumpridas por software**. Elas dependem de quem guarda qual credencial e de quem faz o quê no mês. Se ficarem implícitas, o projeto passa a afirmar coisas que não são verdade.

---

## 1. As três credenciais precisam estar com três organizações

O banco garante que uma assinatura vem da organização registrada no papel de quem assina. **Ele não pode garantir que são três pessoas diferentes.** Enquanto as três senhas estiverem com a mesma pessoa, o 2-de-3 é cumprido por ela sozinha — a proteção é técnica contra invasor externo e apenas social contra a própria operação.

Como fechar isso:

| Papel | Organização | `signatario` | Quem cria a senha |
|---|---|---|---|
| `gestor` | Instituto Vivá | `viva` | a pessoa do Vivá |
| `validador` | DeTrash | `detrash` | a pessoa da DeTrash |
| `coletor` | Comunidade | `null` (não assina) | a representante |

**Cada pessoa cria a própria senha e você não a conhece.** O caminho: você cria o usuário no Supabase com uma senha provisória, a pessoa entra e troca. Enquanto não trocar, a garantia não está de pé.

Como conferir que não há credencial duplicada — inclusive os apelidos do Gmail, que enganam porque `maria.silva@gmail.com` e `mariasilva@gmail.com` são **a mesma caixa**:

```sql
-- Normaliza pontos e sufixos +tag antes de comparar.
with normal as (
  select p.nome, p.papel, p.signatario,
         regexp_replace(split_part(lower(u.email), '@', 1), '[.]|\+.*$', '', 'g')
           || '@' || split_part(lower(u.email), '@', 2) as caixa
    from papeis p join auth.users u on u.id = p.user_id
)
select caixa, count(*) as pessoas, string_agg(nome || ' (' || papel || ')', ', ') as quem
  from normal group by caixa having count(*) > 1;
```

Se essa consulta devolver alguma linha, **duas credenciais estão na mesma caixa de e-mail** e a separação de organizações é aparente.

E a checagem óbvia, que também precisa passar:

```sql
select signatario, count(*) from papeis
 where signatario is not null group by signatario having count(*) > 1;
```

---

## 2. Rotina mensal de retenção

A migração 03 cria os prazos e o expurgo, mas **não agenda nada**. Foi decisão consciente: expurgo automático que ninguém acompanha apaga dado em silêncio, e este projeto ainda não tem quem monitore um agendador.

Uma vez por mês, antes da visita de campo, o gestor roda:

```sql
-- 1. o que precisa de atenção
select familia_id, situacao, vence_em::date, expurgar_a_partir_de::date
  from retencao_status
 where situacao in ('vencendo','vencido','revogado')
 order by vence_em;
```

- `vencendo` → renovar o consentimento na visita (a tela da operação tem o botão).
- `vencido` ou `revogado` → a família já saiu da base para leitura; falta o expurgo.

```sql
-- 2. expurgar o que já passou da carência de 30 dias
select * from expurgar_vencidos();
```

O expurgo apaga `familias`, `condicoes`, `extrato` e `propostas` daquela família. **Mantém** `transacoes` e `movimentos` (contabilidade pseudonimizada, base legal distinta do consentimento) e o registro do consentimento marcado com `expurgado_em` — que é a prova de que o ciclo foi cumprido.

---

## 3. O PIN da família

O PIN fica **só no celular da família**, como hash com sal. Ninguém do projeto consegue vê-lo, e ele não vai para a base compartilhada.

Consequência operacional: **não existe recuperação remota.** Se a família esquecer ou travar o celular (5 tentativas erradas), o agente destrava presencialmente na aba *Família (operação)* — e a família escolhe um PIN novo. O agente nunca escolhe nem vê o PIN de ninguém.

Isso é mais trabalho de campo que um "recuperar por SMS", e é de propósito: recuperação automática por SMS é mais um canal para falhar justamente com quem tem menos recurso, e transferiria para a família o custo de um problema nosso.

---

## 4. Antes de abrir para família real — lista de verificação

- [ ] Migração 02 aplicada (`npm test -- autorizacao` verifica)
- [ ] Migração 03 aplicada (prazos e expurgo)
- [ ] Três usuários criados, com `Auto Confirm User`
- [ ] Papéis atribuídos com `signatario` distinto (consulta acima devolve zero linhas)
- [ ] Cada pessoa trocou a senha provisória
- [ ] Nenhuma credencial na mesma caixa de e-mail (consulta de normalização acima)
- [ ] Dados de demonstração limpos (`supabase/limpar-demonstracao.sql`)
- [ ] Termo de consentimento revisado por alguém de direito — o texto está em `src/store.jsx` (`TEXTO_TERMO`), não em documento solto
- [ ] Rotina mensal de retenção com responsável e data definidos
- [ ] Agente de campo treinado no destravamento de PIN

Os itens em código estão feitos e testados. Os de cima desta lista que dependem de pessoas são os que faltam — e são reais.
