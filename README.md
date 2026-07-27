# Raízes do Futuro — MVP

Protótipo digital do projeto **Raízes do Futuro** (Youth Challenge Blockchain — UNICEF Brasil).

Demonstra o ciclo completo: **Coleta → Validação DeTrash → Relatório de Circularidade → Receita (turistas + empresas) → Cofre multisig 2-de-3 (Fundo Infância) → Conta Picnic da família → Pix**, incluindo o **onboarding gamificado das famílias** — sem seed phrase, sem jargão.

## Como rodar (VS Code)

Pré-requisito: [Node.js 18+](https://nodejs.org)

```bash
npm install
npm run dev
```

Abra http://localhost:5173

Duas telas independentes:

| Endereço | Para quem |
|---|---|
| http://localhost:5173 | painel da operação e dos parceiros (7 abas) |
| http://localhost:5173/#/familia | **app da família**, mobile-first — a tela que a família usa no celular |

## Arquitetura simulada

| Camada | Escolha | Por quê |
|---|---|---|
| Rede | **Solana** (devnet simulada) | taxa de fração de centavo e confirmação em segundos — viável para bônus de R$ 30 |
| Transações | `signature` base58 de 88 chars + `slot` incremental | mesmo formato do explorador da Solana; cada signature carrega a da anterior, formando a cadeia auditável |
| Endereços | pubkey base58 de 44 chars | idem |
| Cofre do Fundo Infância | **multisig 2-de-3 (padrão Squads)** | nenhuma organização move o dinheiro sozinha |
| Signatários | **Instituto Vivá**, **DeTrash**, **Representante Comunitário** | validação social, verificação ambiental e voz da comunidade |
| Stablecoin | **BRZ/cRED** (1 = R$ 1) | a família nunca vê o valor oscilar |
| Carteira da família | **Picnic** (`provider: 'Picnic'`, `rede: 'Solana'`) | custódia simplificada: celular + PIN de 4 números, **sem seed phrase** |

### Fluxo de liberação do bônus

```
comprovação enviada pela família (foto, off-chain)
   → Instituto Vivá valida            → tx VALIDAÇÃO
   → cofre cria uma proposta          → tx PROPOSTA        (status: aguardando)
   → signatário 1 assina              → tx ASSINATURA      (1/2)
   → signatário 2 assina              → tx ASSINATURA      (2/2) → limiar atingido
   → cofre executa automaticamente    → tx LIBERAÇÃO       (debita cofre, credita a conta Picnic)
```

Sem conta Picnic ou sem saldo livre no cofre, a proposta nasce **reservada** (tx `RESERVA`): o valor **nunca é perdido** e a proposta é reaberta sozinha quando a família cria a conta.

Tipos de transação no explorador: `RECEITA`, `VALIDAÇÃO`, `PROPOSTA`, `ASSINATURA`, `LIBERAÇÃO`, `RESERVA`, `CARTEIRA`, `SAQUE` (mais `GÊNESE` e `CIRCULARIDADE`).

## O que cada aba demonstra

| Perfil | O que faz |
|---|---|
| **📊 Dashboard** | Indicadores vs. metas do piloto, gráfico de kg por semana (barras) e receita por fonte (donut) — SVG puro. Botão **▶ Ver o ciclo completo** |
| **🧹 Coletor** | Registra ações de coleta (material, kg, local) |
| **✅ Instituto Vivá** | Valida coletas (metodologia DeTrash), emite Relatórios de Circularidade e valida comprovações — que passam a **criar propostas no cofre** |
| **🛒 Mercado** | Turista compra produto reciclado; empresa compra crédito/relatório ESG. Cada venda dispara a **animação do split 60/25/15** com contadores animados |
| **🔗 Cofre Multisig** | Saldo e endereço do cofre, **painel de propostas** com os 3 signatários e botão "Assinar como […]", animação de execução ao atingir 2/3, e **explorador de transações** (tipo, descrição, signature truncada, slot) com modal de detalhes |
| **👨‍👩‍👧 Família (operação)** | Visão do agente: conectar carteira Picnic, metadados (`rede: Solana · provider: Picnic`), extrato e saque Pix |
| **📱 App da Família** | A tela do celular, dentro de uma moldura — igual à rota `#/familia` |

## App da família (`#/familia`)

Mobile-first e com **zero jargão cripto** — nunca aparece "wallet", "token", "blockchain", "multisig" ou "hash". A linguagem é "conta da família", "dinheiro", "bônus" e "cofre digital".

- **Entrada** por seleção da família + PIN de 4 dígitos (qualquer PIN entra, é demonstração)
- **Saldo em destaque** em reais, com contagem crescente quando o bônus chega
- **Retirar dinheiro** em 2 toques: digitar o valor → confirmação com QR code e comprovante simulado
- **Extrato em linguagem simples**: "Bônus de julho — vacinação em dia · +R$ 60,00"
- **Compromissos do mês** como cards, com "📎 Enviar foto do comprovante"
- **Onboarding gamificado** para família sem conta: a mascote **Tuca, tartaruga de Boipeba 🐢**, com balões de fala, guia 4 missões sequenciais — *Criar minha conta → Guardar meu PIN → Conhecer meus compromissos → Ver como retirar dinheiro* — com barra de progresso, estrela a cada missão, confete em CSS puro e o badge **Família Raízes do Futuro 🏅** no fim. Cada missão explica um conceito em uma frase
- Botão flutuante **💬 Falar com agente do Instituto Vivá** (modal simulando WhatsApp)

## Tour de primeira visita (painel)

Na primeira vez que alguém abre o painel, um **tour de 9 passos** aparece sozinho e apresenta o ciclo do projeto e o que cada uma das 7 abas faz. Ele troca de aba conforme avança e destaca a aba descrita com um anel pulsante.

- Avança no ritmo de quem lê: **Avançar / Voltar**, setas ← →, `Esc` para fechar, ou clique direto num dos pontos de progresso
- **Pular por agora** fecha só nesta visita; **Não mostrar de novo** (e concluir o tour) grava a preferência em `localStorage` (`raizes-tour-v1`)
- Fica sempre disponível no botão **❔ Como funciona**, no topo da página
- Se o modo demo guiado for iniciado, o tour sai da frente automaticamente

## Modo demo guiado (para o vídeo pitch)

No Dashboard, **▶ Ver o ciclo completo** executa a jornada inteira em 13 passos automáticos (~50 s), trocando de aba sozinho, destacando o elemento ativo e narrando cada etapa num card fixo:

> ponto de partida → coleta → verificação DeTrash → relatório → receita → split 60/25/15 → comprovação da família → validação social → multisig 1 de 2 → multisig 2 de 2 (executa) → bônus na conta Picnic → retirada pelo Pix → ciclo completo

O primeiro passo já dá `RESET`, então a gravação pode ser repetida quantas vezes for preciso e sempre parte do mesmo estado.

Há também um **🎥 Modo gravação** no rodapé: esconde os elementos que denunciam a simulação (marcações "(simulação)", "qualquer um na demo" etc.), deixando a tela limpa para o vídeo. Sai pelo botão flutuante no canto.

## Princípios implementados

- **Renda do trabalho é incondicional** — o cofre administra apenas o bônus (Fundo Infância, 25%).
- **Nenhuma organização move o dinheiro sozinha** — 2 de 3 assinaturas por transferência.
- **Bônus reservado, nunca perdido** — condição não cumprida mantém o valor reservado para liberação retroativa.
- **Nenhum dado sensível na rede** — a foto do comprovante não sai do aparelho da família: o app calcula o SHA-256 e só o hash é registrado.
- **Sem barreira digital** — sem seed phrase, sem taxa de rede para a família, com agente humano de apoio.
- **Consentimento é pré-requisito, não formulário** — o banco recusa criar família sem consentimento ativo, e revogar tira os dados da leitura na hora.

## Acesso, papéis e consentimento

O app tem **dois modos, e a tela diz qual está valendo**:

| | sem sessão | com sessão da operação |
|---|---|---|
| App funciona | sim, inteiro, offline | sim |
| Lê a base compartilhada | **não** | sim, conforme o papel |
| Envia para a base | **não** | sim, conforme o papel |

Sem login o app roda 100% local — é o modo da demonstração e do vídeo. Entrar (canto superior direito) serve para sincronizar entre os aparelhos da operação.

**Papéis:** `coletor` registra coleta e não valida; `validador` e `gestor` validam, criam proposta e cadastram. Sem papel atribuído, estar autenticado não dá acesso a nada.

**A família não tem senha.** Ela entra no app dela com PIN, no celular. Quem tem credencial é a operação, no aparelho de trabalho — dar login e senha para a mãe em Boipeba seria transferir a ela o custo de um problema nosso.

**2-de-3 de verdade:** cada pessoa só assina em nome da organização registrada no seu papel. Antes, quem tivesse a chave do frontend produzia as três assinaturas e o multisig não protegia ninguém.

Detalhes, o SQL e os dois passos manuais de configuração: [`SUPABASE.md`](SUPABASE.md).

### Prazo, revogação e expurgo

O consentimento **vale 24 meses** e é renovável em visita de campo. Vencido, os dados daquela família saem da base compartilhada; **30 dias depois** (carência para renovar) podem ser expurgados.

O expurgo apaga o que é pessoal — `familias`, `condicoes`, `extrato`, `propostas` — e **mantém** `transacoes` e `movimentos`, que são contabilidade pseudonimizada sem nome nem código de família, com base legal distinta do consentimento. O registro do consentimento fica, marcado como expurgado: apagar a prova de que houve consentimento, prazo e expurgo destruiria a demonstrabilidade que a LGPD pede.

Não é "apaguei tudo" nem "guardei tudo". Detalhes e comandos: [`supabase/migracao-03-retencao.sql`](supabase/migracao-03-retencao.sql).

**O expurgo não roda sozinho.** Agendador que ninguém monitora apaga dado em silêncio; a rotina mensal está em [`IMPLANTACAO.md`](IMPLANTACAO.md).

## Voz da Tuca 🔊

A tartaruga lê os balões em voz alta (Web Speech, nativo, zero dependência). Não é enfeite: em Boipeba há adultos com pouca leitura fluente, e a tela fala de dinheiro e de saúde de criança — quem não lê bem depende de outra pessoa para entender o próprio saldo, que é a dependência que o projeto quer remover.

Três regras que não se negociam:

- **Nunca fala sozinha.** Som que começa sem pedir assusta, atrapalha quem está no ônibus e gasta bateria. A pessoa liga no botão do balão, e a escolha fica lembrada.
- **Sem voz pt-BR instalada, o botão não aparece** — um botão que promete áudio e entrega voz robótica em inglês é pior que botão nenhum.
- **Números viram palavra antes de falar**: `R$ 90,00` sai como "noventa reais", não "erre cifrão noventa vírgula zero zero", e emoji é removido (a síntese tenta descrever cada um).

## Meta de poupança 🎯

A família define uma meta ("consertar o telhado", R$ 1.500) e a tela mostra quanto falta. Guardar para um objetivo é algo que as pessoas querem e é difícil sem ferramenta — então a ferramenta existe.

As travas contra virar tutela estão no **desenho**, não no discurso, e cada uma tem teste:

- **Quem define é a família**, no app dela, com as palavras dela. O projeto não cria meta para ninguém e não sugere objetivos "corretos".
- **Não bloqueia nem questiona o saque.** Nenhum "tem certeza? sua meta…". O dinheiro é dela; meta que dificulta o acesso deixa de ser ferramenta.
- **Sem ponto, medalha ou sequência por guardar.** Premiar quem poupa é repreender quem precisou gastar. O progresso é fato: quanto falta.
- **Não sobe para a nuvem.** "Guardar para o remédio da minha filha" é dado de saúde — a meta fica no aparelho, como o PIN.
- **Apagar é um toque**, sem confirmação moral.

## Português e inglês 🌐

Seletor PT/EN no cabeçalho. **Português é sempre o padrão** — é um projeto brasileiro, e o inglês é camada de leitura para fora. Nada de adivinhar pelo idioma do navegador: um avaliador brasileiro com Windows em inglês cairia numa tradução parcial sem pedir.

Traduzido por inteiro:

- **A página pública de rastreio** (`#/rastreio/CÓDIGO`) — quem escaneia o QR da peça em Boipeba é turista, e boa parte é estrangeira. É a única tela com leitor em inglês *real*, e o seletor fica nela mesma, porque quem chega pelo QR não passa pelo painel.
- **O casco do painel e o Dashboard** — é o que um avaliador internacional abre primeiro.

**Não traduzido, de propósito:** o app da família (quem usa é a mãe em Boipeba) e as telas de operação (quem opera é a equipe local). Meia tradução silenciosa é pior que tradução nenhuma — o avaliador clica, cai em português no meio do fluxo e conclui que o resto foi feito com o mesmo descuido. Por isso o seletor **avisa na tela** quando a aba aberta só existe em português, em vez de deixar a pessoa descobrir sozinha.

### PIN da família

O PIN é **verificado de verdade** e nunca sai do celular: guarda-se SHA-256 de `sal + pin`, com sal por família. Cinco tentativas erradas travam o aparelho, e só o agente destrava — presencialmente, apagando o PIN para a família escolher outro. Ninguém do projeto consegue ver o PIN de ninguém, nem para ajudar.

Não há recuperação por SMS de propósito: seria mais um canal para falhar justamente com quem tem menos recurso.

### O que ainda falta para campo

Está em [`IMPLANTACAO.md`](IMPLANTACAO.md) — e o que falta agora **não é código**: distribuir as três credenciais entre as três organizações (sem isso o 2-de-3 é cumprido por uma pessoa), definir o responsável pela rotina mensal de retenção, e limpar os dados de demonstração ([`supabase/limpar-demonstracao.sql`](supabase/limpar-demonstracao.sql)).

Os dados de demonstração na base foram criados pelos testes, **sem termo de consentimento** — e não há registro fabricado para eles, porque consentimento inventado é pior que consentimento nenhum: mente exatamente na prova.

## Ancoragem real na Solana devnet

A jornada do app é simulada de propósito — roda offline, é repetível e resetável. **Um único ponto sai da simulação:** o hash do Relatório de Circularidade é gravado numa transação real na Solana devnet, pelo programa Memo.

Por que o relatório: é o artefato que tem valor externo (é o que a empresa ESG compra) e é **apenas um SHA-256** — nenhum dado de família ou criança sai daqui.

### As liberações do cofre também são reais

O cofre é um **multisig nativo do SPL Token, 2-de-3**, e cada liberação pode ser executada de fato na devnet — o app guarda o comprovante e o link para o explorer (aba *Cofre Multisig* → "Liberações no cofre real").

**O app não assina, e isso é proposital.** Assinar exige chave privada: em bundle de navegador ela é pública, e numa função de servidor o *servidor* passa a ser o signatário — o 2-de-3 morre. Então quem assina é a pessoa da organização, na máquina dela:

```bash
cd onchain
node liberar-bonus.mjs preparar --valor 60 --org viva --proposta 42
# a saída é uma transação parcialmente assinada; mande para a outra organização
node liberar-bonus.mjs assinar --org detrash --tx <base64>
```

São duas etapas porque o multisig do SPL Token exige as duas assinaturas **na mesma transação** — não existe "a Vivá assina hoje e a DeTrash amanhã" com estado num servidor nosso. O que viaja entre as organizações é a própria transação. O passo 2 **imprime o que está sendo assinado** antes de enviar: assinar às cegas um blob que chegou por mensagem transforma multisig em teatro.

Verificado na devnet: R$ 30 saíram do cofre (585 → 555) para a conta da família (60 → 90), com `viva` e `detrash` assinando e `comunidade` não — [slot 479156986](https://explorer.solana.com/tx/4vuXwbsTSviC8yNvGYtQ67waArcNAapawwDmZnQQmStJQhsMEx5U5GS4uEGxGmX6FVucK9MdweBom8Ryk6hZfAEX?cluster=devnet).

### Regra 4: saldo residual → ações coletivas

O residual do ciclo vai para ações de saúde e educação **decididas com a comunidade**. A decisão é da assembleia; o que a rede registra é a **prova pública** de qual decisão foi tomada, com qual valor (aba *Cofre Multisig* → "Fechamento de ciclo" → `onchain/ancorar-decisao.mjs`).

Não virou função de contrato de propósito: um contrato que distribuísse o residual sozinho tomaria a decisão no lugar das pessoas. O que precisa ser imutável é o registro da decisão, não a decisão. Por isso [`contracts/FundoInfancia.sol`](contracts/FundoInfancia.sol) está marcado como **não implantado** — ele é EVM, e o piloto ficou só na Solana.

### Por que tem uma etapa humana

Assinar transação exige chave privada, e ela não pode ficar em dois lugares:

- **no navegador** não pode — tudo que entra no bundle Vite é público, inclusive variáveis `VITE_*`, que são inlinadas em `dist/assets/*.js`;
- **em servidor** a gente escolheu não colocar — seria uma chave a mais para vazar, por conveniência.

Então o fluxo é: o app calcula o SHA-256 e mostra o comando pronto → quem opera roda na própria máquina → cola a assinatura de volta no app. Menos cômodo, e o registro fica verificável por qualquer pessoa.

```bash
cd onchain
node ancorar-relatorio.mjs <sha256> "<período>"
```

O script usa a mesma conta pagadora do `implantar-devnet.mjs`, grava o histórico em `onchain/ancoragens.json` e imprime o link do explorer. No app: aba **Instituto Vivá** → relatório → *ancorar na Solana devnet*.

### Exemplo já ancorado

O relatório "Julho 2026 — quinzena 1" (105 kg) está na devnet:

```
hash  3bb13611cde6b9f67cd97964d4b4736a4c6fe86840595e4b16b8049673511d4b
tx    32236oNENMrvKmfp5e62Asi7Uxf7DabAiJynAeLc5JE6hVDWmEeRUYMJjGspJgt9UadUVKiUVzgKicc1F9LqDN6w
slot  479128408
```

Conferível em `explorer.solana.com/tx/<tx>?cluster=devnet` — o log do programa mostra o memo com o hash.

> A integração com a **Rede Recy** foi retirada: sem o contrato da API (endpoint, header de autenticação e formato do corpo), o código só devolvia `503` e era código morto no repositório. Está no histórico do git se a Recy responder.

## Nota técnica

Blockchain é **simulada**: as transações ficam num `localStorage` (chave `raizes-mvp-v2`) com signatures base58 encadeadas e slot incremental, reproduzindo o formato da Solana sem nenhuma dependência web3 — o app roda **100% offline**. Em produção: programa na **Solana** com cofre **Squads** e carteiras **Picnic**, mantendo a mesma lógica de regras demonstrada aqui.

Estado salvo de versões anteriores é descartado automaticamente se não tiver o formato atual, então o app nunca abre quebrado depois de uma atualização.

Para restaurar os dados da demo: botão **Resetar demo** no rodapé (traz também a proposta multisig de exemplo com 1 assinatura já coletada).

## Estrutura

```
src/
  store.jsx          estado + reducer + cadeia de transações (base58/slot) + multisig
  ui.jsx             toasts, modal, contadores animados, badges, estados vazios, confete
  graficos.jsx       barras (kg/semana) e donut (receita por fonte) em SVG puro
  demo.jsx           motor do modo demo guiado e card narrador
  tour.jsx           tour de primeira visita do painel (9 passos)
  qr.js              gerador de QR Code real (Reed-Solomon), sem dependência
  ancoragem.js       hash SHA-256 do relatório + validação da assinatura Solana
  evidencia.js       SHA-256 da foto no aparelho + geolocalização
  nuvem.js           cliente do esquema compartilhado (Supabase)
  App.jsx            abas + rotas por hash (#/familia, #/rastreio/CÓDIGO)
  views/
    Dashboard.jsx  Coleta.jsx  Validacao.jsx  Mercado.jsx
    Fundo.jsx      Carteira.jsx  PaginaFamilia.jsx  Rastreio.jsx
onchain/
  implantar-devnet.mjs   cria o token cRED e o cofre multisig 2-de-3 na devnet
  ancorar-relatorio.mjs  grava o hash do relatório numa transação real
supabase/
  schema.sql             tabelas por entidade, transações append-only
testes/
  executar.mjs           runner do `npm test`
  fluxo.mjs              regras de negócio no reducer (sem navegador)
  navegador.mjs          app inteiro no Edge, via DevTools Protocol
  qr.mjs                 QR gerado é decodificado por leitor independente
  nuvem.mjs              garantias do esquema, contra o Supabase real
  autorizacao.mjs        anônimo barrado, papel, consentimento (Supabase real)
  dois-aparelhos.mjs     dois navegadores, um offline durante uma coleta
  telas.mjs              capturas para conferir o visual com o olho
```

## Testes

```bash
npm test                  # tudo o que o ambiente permitir
npm test -- fluxo         # só o reducer, em segundos
npm test -- navegador     # só o app no navegador
npm test -- autorizacao   # RLS por papel e consentimento, no banco real
npm test -- telas         # grava capturas/ para conferir o visual
```

O runner sobe o servidor de desenvolvimento sozinho e o derruba no fim, e **pula com aviso** — em vez de falhar — quando falta Edge, internet, credencial do Supabase ou usuário de operação.

**Pular não é passar.** Suíte pulada aparece como ⏭️ no resumo e o runner diz explicitamente que aquela garantia não foi verificada — antes ela saía com código 0 e o resumo mostrava ✅ para uma suíte que não conferiu nada, o que é pior que vermelho.

As suítes `nuvem` e `aparelhos` precisam de sessão da operação (`SUPABASE_TEST_EMAIL` / `SUPABASE_TEST_SENHA`), porque a nuvem não responde mais a anônimo — por desenho.

Sem dependências além de React + Vite no app. O `@solana/web3.js` vive num `package.json` separado em `onchain/`, então não entra no bundle do site; o `esbuild` é dependência de desenvolvimento, usada pelos testes.
