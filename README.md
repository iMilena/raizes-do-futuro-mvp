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
- **Nenhum dado sensível na rede** — comprovações ficam no ambiente seguro (simulado); só o hash é registrado.
- **Sem barreira digital** — sem seed phrase, sem taxa de rede para a família, com agente humano de apoio.

## Ancoragem real na Rede Recy (opcional)

Todo o resto do MVP é simulado de propósito — roda offline, é repetível e resetável. **Um único ponto fala com uma rede de verdade:** o hash do Relatório de Circularidade pode ser ancorado na **Rede Recy Testnet**, a rede da própria DeTrash onde relatórios auditados sustentam a emissão de cRECY.

Por que só o relatório: é o artefato que tem valor externo (é o que a empresa ESG compra), é **apenas um hash SHA-256** — nenhum dado de família ou criança sai daqui — e uma transação real já sustenta a afirmação de verificabilidade. Os bônus das famílias **não** são registrados numa testnet: envolvem dinheiro de família e continuam no cofre simulado.

### A chave nunca fica no frontend

Este é um app Vite puro: tudo que entra no bundle é público. Variáveis `VITE_*` são **inlinadas literalmente** em `dist/assets/*.js` e ficam legíveis para qualquer visitante. Por isso a chave vive só no servidor:

```
navegador  →  /api/ancorar  (functions/api/ancorar.js, Cloudflare Pages Function)
                    ↓  RECY_API_KEY (secret, só existe aqui)
              app.crecy.workers.dev/api
```

Configurar:

```bash
npx wrangler pages secret put RECY_API_KEY     # produção
# local: crie .dev.vars com RECY_API_KEY=... (já está no .gitignore)
npx wrangler pages dev -- npm run dev          # sobe o app + a função juntos
```

`npm run dev` puro continua funcionando — sem a função, o app só mostra "ancoragem real indisponível" ao lado do relatório e segue normal.

### Estado da integração

O proxy, o cliente, o hash SHA-256, o armazenamento, a UI e os testes estão prontos. Falta **um** trecho: o contrato da API da Recy. Em `functions/api/ancorar.js` há um bloco marcado com as três lacunas — caminho da operação, nome do header de autenticação e formato do corpo. Enquanto não estiverem preenchidas, o endpoint responde `503 {erro:'nao-configurado'}` e nada quebra.

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
  recy.js            cliente da ancoragem real (SHA-256 + chamada ao proxy)
  App.jsx            abas + roteamento por hash (#/familia)
  views/
    Dashboard.jsx  Coleta.jsx  Validacao.jsx  Mercado.jsx
    Fundo.jsx      Carteira.jsx  PaginaFamilia.jsx
functions/
  api/ancorar.js     proxy da Rede Recy — guarda a chave fora do navegador
```

Sem dependências além de React + Vite. O `wrangler` é usado via `npx`, só quando se quer a ancoragem real.
