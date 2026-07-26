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

Vocês tratam saúde e escolaridade de criança. Com a chave anônima no frontend, **qualquer visitante do site consegue ler estas tabelas**. Por isso o esquema foi desenhado para não conter nada que precise de proteção:

- `familias.codigo` é **pseudônimo** (`BOI-014`), não nome. O mapeamento código → pessoa fica fora deste banco, no cadastro do Instituto Vivá.
- Comprovantes existem só como **hash SHA-256**. O arquivo nunca sai do aparelho da família (ver `src/evidencia.js`).
- Não há CPF, endereço, data de nascimento, nome de criança ou diagnóstico em nenhuma coluna.

Se em algum momento um nome for gravado aqui, isso deixa de ser verdade e passa a ser incidente de dados. Vale tratar como regra dura, não como recomendação.

## O que falta para operar com famílias reais

O esquema está pronto; o controle de acesso não. Com a chave anônima, qualquer pessoa insere linhas — inclusive uma "validação" ou uma "assinatura" de signatário. Para o piloto demonstrativo isso é aceitável (dinheiro simulado, zero dado pessoal). Para valor real é obrigatório:

1. **Supabase Auth** com um papel por perfil: `coletor`, `validador`, `familia`
2. Trocar as policies `piloto_tudo` por regras por papel:

```sql
-- só validador credenciado assina, e só em nome de si mesmo
create policy assina_como_si_mesmo on assinaturas for insert
  with check (
    auth.jwt() ->> 'papel' = 'validador'
    and signatario = auth.jwt() ->> 'signatario_id'
  );

-- família lê apenas o próprio extrato
create policy meu_extrato on extrato for select
  using (familia_id = (auth.jwt() ->> 'familia_id')::bigint);
```

3. Registro de **consentimento** por família (quem autorizou, quando, para qual finalidade) e política de retenção — hoje não existe nenhum dos dois.

## Estado da integração

O esquema e o cliente ([`src/nuvem.js`](src/nuvem.js)) estão escritos. **A troca do store para usá-los ainda não foi feita**, por dois motivos:

- não há um projeto Supabase para testar contra; entregar código de sincronização não exercitado seria pior que entregar o desenho revisado;
- a troca transforma o app de local-first em sincronizado, o que muda o carregamento inicial e exige teste de conflito real (dois navegadores simultâneos, um offline voltando).

A sincronização por blob que existe hoje em `store.jsx` continua funcionando para a demo, e está marcada no código como caminho a substituir. O plano de migração está no topo de `src/nuvem.js`.
