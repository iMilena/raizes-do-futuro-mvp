# Dados compartilhados entre aparelhos (Supabase) ☁️

Por padrão o app guarda tudo no navegador de cada pessoa. Isso serve para demonstrar, mas **não serve para operar**: o coletor registra no celular e o Instituto Vivá, no notebook, não vê nada.

## Por que o desenho mudou

A primeira versão salvava o estado inteiro do app como um único JSON numa linha (`create table estado`), versionado por um contador. Dois problemas impediam uso real:

**Um aparelho apagava o trabalho do outro.** O coletor registra uma coleta enquanto o Vivá valida outra. Ambos leram a mesma versão, ambos gravam o estado completo, e quem gravar por último sobrescreve — a coleta do primeiro simplesmente desaparece. Não é caso raro: é o dia normal de dois usuários.

**O registro auditável ficava dentro do blob.** Uma gravação atrasada podia apagar transações já registradas. Um histórico que pode ser sobrescrito não é histórico — e é justamente ele que sustenta a proposta do projeto.

## O modelo atual

Está em [`supabase/schema.sql`](supabase/schema.sql). Quatro decisões carregam o peso:

**Uma tabela por entidade.** Cada ação é um `INSERT` ou um `UPDATE` numa linha específica. Dois aparelhos mexendo em coisas diferentes nunca colidem.

**`transacoes` é append-only, garantido no banco.** As policies concedem apenas `INSERT` e `SELECT`. Sem `UPDATE`, sem `DELETE` — nem para quem tem a chave. Reescrever o histórico quebraria a cadeia de signatures, então é proibido no Postgres, não só no aplicativo.

**Saldo não é campo, é soma.** Dinheiro vive em `movimentos` (caixas) e `extrato` (famílias), ambos imutáveis, e o saldo sai de uma `view` que soma. Elimina a corrida clássica de "ler saldo, subtrair, gravar" — que, com dinheiro de família, é a última coisa que você quer ter.

**Assinatura é linha, não contador.** `assinaturas` tem chave primária `(proposta_id, signatario)`. Dois signatários assinando ao mesmo tempo não conflitam; o mesmo signatário assinar duas vezes é impossível. O 2-de-3 fica correto por construção, sem código de aplicação para errar.

## Como ligar

1. Conta gratuita em https://supabase.com → **New project** (região São Paulo)
2. **SQL Editor** → cole o conteúdo de `supabase/schema.sql` → Run
3. **Project Settings → API** → copie a *URL* e a chave *anon public*
4. Crie `public/supabase.json`:

```json
{ "url": "https://SEUPROJETO.supabase.co", "anonKey": "SUA_ANON_KEY" }
```

Sem esse arquivo, o app funciona 100% local — a sincronização é opcional por design, para a demo nunca depender de rede.

> `public/supabase.json` vai para o navegador de todo visitante. A chave `anon` é pública por natureza: a proteção real vem das policies, nunca de esconder a chave.

## LGPD — o que não pode entrar aqui

Vocês tratam saúde e escolaridade de criança. Por isso o esquema foi desenhado para não conter nada que precise de proteção — mesmo agora que o acesso é autenticado, essa disciplina continua valendo:

- `familias.codigo` é **pseudônimo** (`BOI-014`), não nome. O mapeamento código → pessoa fica fora deste banco, no cadastro do Instituto Vivá.
- Comprovantes existem só como **hash SHA-256**. O arquivo nunca sai do aparelho da família (ver `src/evidencia.js`).
- Não há CPF, endereço, data de nascimento, nome de criança ou diagnóstico em nenhuma coluna.

Se em algum momento um nome for gravado aqui, isso deixa de ser verdade e passa a ser incidente de dados. Vale tratar como regra dura, não como recomendação.

## Autorização por papel e consentimento

Migração: [`supabase/migracao-02-auth-papeis-consentimento.sql`](supabase/migracao-02-auth-papeis-consentimento.sql). Ela troca as policies `piloto_tudo` (`using (true)`, ou seja, leitura pública) por três regras.

**1. Quem não entrou não lê nada.** Nenhuma policy responde ao papel `anon`. Quem abre o site sem sessão continua com o app inteiro funcionando — ele é local-first e nunca dependeu da nuvem. Esse é o modo da demonstração: nada é lido, nada é enviado.

**2. Papel decide o que pode.** `coletor` registra coleta e não valida (a policy exige `status = 'pendente'` no insert dele). `validador` e `gestor` validam, criam proposta e cadastram. Sem linha em `papeis`, estar autenticado não dá acesso a nada.

**3. Consentimento é pré-requisito de banco.** Não existe família na nuvem sem consentimento ativo — a policy `fam_criar` recusa. Revogar faz a família, as condições e o extrato dela saírem da leitura no mesmo instante. É o direito de revogação implementado como regra, não como processo manual.

### A assinatura 2-de-3 passou a ser verdadeira

Antes, quem tivesse a chave anônima produzia as três assinaturas: o multisig era desenho de tela. Agora `papeis.signatario` amarra cada pessoa a **uma** organização e a policy recusa assinar por outra. Duas organizações distintas passaram a ser realmente necessárias.

### Consentimento: o que é guardado

O registro guarda **a forma** (presencial assinado, presencial verbal, WhatsApp, formulário) e o **SHA-256 do texto exato** apresentado — nunca foto de documento nem assinatura digitalizada. O texto do termo mora em `src/store.jsx` (`TEXTO_TERMO`), versionado junto com o app: um termo que existisse só no banco poderia ser trocado depois sem ninguém notar, e aí o hash não provaria nada.

`consentimentos` é append-only exceto a revogação — o único `UPDATE` permitido, porque é direito do titular. Não há policy de `DELETE`: o registro da revogação é parte da prova.

### Os dois passos manuais

Nenhum código pode fazer isso por você, e é assim que deve ser:

1. **Crie os usuários da operação** em *Authentication → Users → Add user*, marcando **Auto Confirm User** (sem isso não há sessão até o e-mail ser confirmado).
2. **Dê papel a cada um**, com o UUID da mesma tela:

```sql
insert into papeis (user_id, papel, nome, organizacao, signatario) values
  ('<uuid-1>', 'gestor',    'Nome da pessoa', 'Instituto Vivá', 'viva'),
  ('<uuid-2>', 'validador', 'Nome da pessoa', 'DeTrash',        'detrash'),
  ('<uuid-3>', 'coletor',   'Nome da pessoa', 'Comunidade',      null);
```

Signatários diferentes de propósito: com o mesmo `signatario` em duas linhas, o 2-de-3 volta a poder ser cumprido por uma organização só.

### Verificando que funciona

```bash
npm test -- autorizacao
```

A suíte roda contra o banco de verdade e é escalonada: sem a migração, avisa o que falta; com a migração, confere que anônimo não recebe linha nenhuma — **inclusive nas views de dinheiro**, que é o furo clássico de RLS (view sem `security_invoker` roda com os direitos de quem a criou e devolve linhas que a policy da tabela negaria). Com `SUPABASE_TEST_EMAIL` e `SUPABASE_TEST_SENHA` de um usuário com papel, confere também papel, recusa de assinatura por outra organização e o ciclo completo do consentimento (recusa sem, aceita com, desaparece ao revogar, registro não apagável).

Um detalhe que engana: RLS sem policy devolve **200 com lista vazia**, não 403. O teste afirma "não veio linha", não "veio erro" — confundir os dois é o jeito mais fácil de achar que se está protegido sem estar.

## Estado da integração

O store usa o esquema por entidade desde o commit da sincronização por entidade: carrega no boot, envia deltas a cada ação e reenvia o que ficou preso na fila. Verificado com dois navegadores simultâneos, um offline durante uma coleta (`npm test -- aparelhos`).

**A nuvem agora exige sessão** (`nuvem.ativo()` só é verdadeiro com projeto configurado *e* sessão aberta). Consequência prática: as suítes `nuvem` e `aparelhos` **pulam** enquanto não existir um usuário de operação para testar — e pular aparece como pular no resumo do `npm test`, não como ✅.

O que ainda não existe: **política de retenção** (por quanto tempo o dado fica, e o que acontece com ele ao fim do piloto). É o próximo item da mesma lista.
