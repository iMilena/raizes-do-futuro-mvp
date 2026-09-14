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

Rode primeiro **`npm test -- migracoes`**: ele sonda o banco e diz quais migrações estão aplicadas. Não confie em memória — foram seis, aplicadas à mão em momentos diferentes, e **uma passou batido sem ninguém notar**.

### No banco — verificável por `npm test`

- [x] **02** papéis e consentimento — `npm test -- autorizacao`, 44 verificações
- [x] **03** prazos e expurgo — aplicada. A tela e o banco agora concordam sobre a data de vencimento, e `expurgar_vencidos()` existe para a rotina mensal.
- [x] **04** canal de contestação — `npm test -- canal`, 17 verificações
- [x] **05** contestação sem gate de consentimento
- [x] **06** vínculo coleta↔família e ciclos — aplicada. As coletas que subiram antes dela estão na nuvem com vínculo nulo; o app repara sozinho no próximo pull, reenviando o vínculo de quem o tem.
- [ ] Dados de demonstração limpos (`supabase/scripts/limpar-demonstracao.sql`) — a base tem bastante lixo de teste, inclusive famílias `TESTE-*` e contestações `[teste]`
- [ ] Usuário `raizes.testes@gmail.com` removido, quando não for mais rodar a suíte

### Com pessoas — não verificável por código

- [ ] Três usuários criados com `Auto Confirm User`
- [ ] Papéis atribuídos com `signatario` distinto
- [ ] Cada pessoa escolheu a própria senha, e você não a conhece
- [ ] Nenhuma credencial na mesma caixa de e-mail
- [ ] Termo de consentimento revisado por alguém de direito — o texto está em `src/estado/store.jsx` (`TEXTO_TERMO`), versionado com o app, não em documento solto
- [ ] Rotina mensal de retenção com responsável e data definidos
- [ ] Agente de campo treinado no destravamento de PIN

### Por que a auditoria dos papéis só roda no SQL Editor

A policy `ver_meu_papel` limita a leitura de `papeis` à **própria linha**. Com uma sessão de operação, a suíte vê uma linha: a dela. Isso é bom — um token comprometido não enumera a equipe inteira — e tem o custo de que a conferência das três credenciais precisa ser feita como dono do banco.

As duas consultas estão nas seções 1 e 2. A de normalização de e-mail é a que importa: pega o caso em que duas credenciais moram na mesma caixa, que é como a separação entre organizações fica só aparente.

### O que essa lista aprendeu

Ela começou dizendo "os itens em código estão feitos e testados; o que falta depende de pessoas". Estava errada nos dois lados: faltavam duas migrações no banco, e o que depende de pessoas não tem como ser conferido por quem escreve o código. Marcar caixinha de memória é o que fez a 03 sumir — por isso agora há um teste que sonda o banco em vez de perguntar a alguém.

---

## 5. App de campo (módulo de Validação de Coleta)

O módulo tem documentação própria em [VALIDACAO.md](VALIDACAO.md). O que entra
aqui é só o que precisa acontecer **antes de um catador usar em campo**, que é
justamente o que nenhum teste consegue conferir.

### Antes de entregar o celular

- [ ] **`VITE_SAL_PSEUDONIMO` definido** no ambiente de build. Sem ele, o app usa
      um sal de demonstração que é público, e com a lista de 30 famílias o
      pseudônimo do coletor é revertido por força bruta em um segundo. O painel
      de revisão mostra um aviso vermelho enquanto isso não for feito.
- [ ] **`VITE_COLETOR_ID` e `VITE_PONTO_COLETA`** ajustados por aparelho. O
      piloto assume um aparelho por coletor.
- [ ] **Publicado em HTTPS.** Sem isso o navegador não oferece a instalação na
      tela inicial e não registra o service worker, e o app deixa de funcionar
      offline. `npm run build` gera `campo.html` e `revisao.html` junto com o
      resto; os dois são arquivos novos no `dist/`.
- [ ] **Primeira abertura feita onde tem sinal**, com o ícone instalado na tela
      inicial ali mesmo. É nessa abertura que o service worker guarda o app, o
      WebAssembly (14 MB) e o modelo (6 MB). Antes disso, o app não abre sem
      rede. Entregar o celular sem esse passo é entregar um app que não funciona
      na praia, que é onde ele precisa funcionar.
- [ ] **Modelo exportado e publicado** em `public/modelo/`. Ele é gitignorado por
      ser artefato de build: quem publica roda `python -m raizes_modelo.exportar`
      (ver [modelo/README.md](modelo/README.md)) ou versiona o arquivo. Sem o
      modelo o app continua funcionando, com o catador escolhendo o material à
      mão, e é assim que ele deve se comportar.

### Com pessoas

- [ ] **Quem revisa a fila, e com que frequência.** Com o modelo atual, treinado
      só em dados públicos, cerca de **46% dos registros vão para conferência
      humana**. Isso encolhe quando houver fine-tune com as fotos de Boipeba, e
      até lá é trabalho real de alguém, todo dia.
- [ ] **Combinado com os catadores sobre a sinalização.** O sistema aponta
      coincidência, não acusa ninguém, e a tela foi escrita assim. Mas quem vai
      receber a mensagem precisa ouvir isso de uma pessoa antes de ver na tela.
- [ ] **Prazo de retenção das fotos definido e escrito na política de
      privacidade.** O padrão é 30 dias, contados da coleta, e a limpeza roda
      sozinha na abertura do app. Foto de registro sinalizado que ainda espera
      decisão fica guardada até alguém decidir.
- [ ] **Primeira semana com conferência manual em paralelo**, comparando o
      caderno com o app. É o que vai dizer se os limiares antifraude estão perto
      do certo: todos estão em valores de partida, nenhum foi calibrado com dado
      de Boipeba.

### O que ainda não está ligado

- A fila sobe para um transporte **em memória**, não para o Supabase. O adaptador
  é uma troca de uma linha, descrita em VALIDACAO.md, e precisa de uma migração
  nova com a tabela de registros.
- A ancoragem usa uma **ancoradora simulada**. A interface e os testes de
  contrato estão prontos para a equipe de blockchain plugar o contrato real.
- O painel de revisão lê o **banco local do navegador** em que está aberto. Vira
  base compartilhada na mesma troca do transporte.
