# Módulo de Validação de Coleta

Este módulo resolve o elo mais frágil da cadeia do Raízes do Futuro: a etapa em
que alguém pesa, alguém anota e alguém confirma. Isso funciona numa ilha onde
todos se conhecem, e não escala para outro território nem sustenta auditoria de
investidor ou de empresa compradora do Relatório de Circularidade. E é
justamente o elo que gera a receita que financia o Fundo Infância.

A divisão de papéis é simples e não se sobrepõe:

- **a IA gera e audita a evidência**: classifica o material na hora, calcula um
  hash perceptual da foto, confere coerência e aponta coincidência suspeita
- **a blockchain torna a evidência imutável**: recebe a raiz de Merkle do lote do
  dia, e nada além disso
- **a pessoa decide**: toda sinalização vira pedido de conferência humana, nunca
  rejeição automática

## O que foi construído

| parte | onde | o que é |
| --- | --- | --- |
| Pipeline do modelo | [`modelo/`](modelo/) | treino, avaliação, calibração e exportação ONNX. Ver [modelo/README.md](modelo/README.md) |
| App de campo (PWA) | [`campo.html`](campo.html), [`src/validacao/campo/`](src/validacao/campo/) | o que o catador usa na praia, sem internet |
| Camada antifraude | [`src/validacao/antifraude/`](src/validacao/antifraude/) | pHash, geohash, detecções, motivos legíveis |
| Evidência e Merkle | [`src/validacao/dominio/`](src/validacao/dominio/), [`src/validacao/ancoragem/`](src/validacao/ancoragem/) | esquema, keccak256, árvore, prova de inclusão, ancoradora |
| Fila offline | [`src/validacao/armazenamento/`](src/validacao/armazenamento/), [`src/validacao/sincronizacao/`](src/validacao/sincronizacao/) | IndexedDB e sincronização idempotente |
| Painel de revisão | aba **Conferência** do painel, e [`revisao.html`](revisao.html) | a tela da coordenação, nos dois lugares |
| Testes | [`testes/validacao/`](testes/validacao/), [`modelo/testes/`](modelo/testes/) | 203 em TypeScript, 19 em Python, mais fumaça de tela |

## Como rodar

```bash
npm install
npm run dev              # painel (/), app de campo (/campo.html), revisão (/revisao.html)
npm run test:validacao   # 203 testes de lógica, em Node, sem navegador
npm run checar-tipos     # TypeScript, sem emitir nada
npm test                 # suíte antiga do MVP, intacta

# com `npm run dev` de pé em outro terminal:
npm run fumaca:telas     # as duas telas novas abrem e funcionam? (Edge headless)
npm run medir:inferencia # quanto demora a classificação, inclusive com CPU estrangulada
```

O app de campo funciona sem o modelo: se o ONNX não estiver exportado ainda, ele
avisa e o catador escolhe o material à mão. Para ter a classificação automática,
siga o [README do modelo](modelo/README.md), que termina gravando
`public/modelo/`.

## Onde a coordenação revisa

A mesma tela vive em dois lugares, e o componente é um só
([PainelRevisao.tsx](src/validacao/revisao/PainelRevisao.tsx)):

- **aba "Conferência"** do painel da operação, ao lado de "Instituto Vivá". É o
  caminho normal: quem revisa já trabalha no painel.
- **[revisao.html](revisao.html)**, página própria, para abrir direto sem o
  painel em volta.

Dentro do painel ela entra por `lazy()`, como as outras telas, então quem não
abre a aba não baixa os 10 kB dela.

O CSS é todo escopado sob `.revisao`, inclusive as variáveis de cor, e tem um
reset de fronteira explícito: o `styles.css` do painel estiliza `h2`, `h3`,
`table`, `input` e `label` por elemento, e é carregado em toda rota. Sem esse
reset, os títulos chegam com a régua do painel e o campo "quem está revisando"
vira um rótulo cinza de 10px em caixa alta. A tela também carrega fundo próprio:
a área clara do painel tem altura de uma tela, e esta aqui passa de três mil
pixels com o exemplo carregado. A fumaça (`npm run fumaca:telas`) mede as três
coisas, em pixel.

### Mostrar o módulo sem ter ido a campo

A tela lê o banco do aparelho. Numa máquina de demonstração esse banco está
vazio, e o módulo apareceria como "nada esperando conferência", que é o pior
jeito possível de mostrar justamente a parte que faz o projeto escalar. Por isso
a tela oferece **Carregar um dia de exemplo**: sete coletas em Boipeba, três
normais e quatro que disparam checagens diferentes.

O que separa isso de encenação: **as sinalizações não são escritas em lugar
nenhum**. Os registros são montados como coletas de verdade, assinados pela chave
do aparelho, e passam por `analisar()`, o mesmo detector que roda no celular do
catador. O texto que aparece no telão é o que o código produz. Se alguém mexer
num limiar, a tela muda junto, e
[testes/validacao/demonstracao.test.ts](testes/validacao/demonstracao.test.ts)
falha antes da apresentação em vez de durante.

O exemplo não se confunde com dado real: vem marcado no envelope (nunca dentro do
conteúdo assinado), o ponto de coleta é `ponto-demonstracao`, uma faixa verde
avisa na tela, e **ele não entra na fila de sincronização**, então não existe
caminho pelo qual suba para a base compartilhada. Um botão o remove inteiro, sem
tocar no que veio de campo.

## O fluxo, do começo ao fim

1. **Foto.** O catador fotografa o material. A foto vai para o IndexedDB do
   aparelho e não sai de lá.
2. **pHash e ocupação.** Da foto saem 64 bits de hash perceptual (DCT) e a
   fração do quadro ocupada por material. Barato, e não depende do modelo.
3. **Classificação.** O ONNX quantizado roda no aparelho e sugere o material com
   a confiança calibrada. Abaixo do limiar, a interface muda de tom e diz que não
   tem certeza.
4. **Confirmação.** A pessoa confirma ou corrige. Correção fica registrada, e é
   dado de retreino.
5. **Peso.** Digitado a partir da balança, em teclado próprio de teclas grandes.
   A balança é a fonte do peso, sempre.
6. **Detecções.** Foto reaproveitada, pilha recontada, sequência improvável,
   coerência entre foto e balança, território, confiança baixa.
7. **Assinatura e gravação.** O conteúdo vira JSON canônico, keccak256, e é
   assinado pela chave do aparelho (ECDSA P-256, privada não exportável).
   Registro, foto e item de fila entram numa transação só.
8. **Fila.** Quando houver rede, sobe. De forma idempotente.

Passos 1 a 7 não tocam a rede. É o desenho, não um modo degradado.

## Números medidos

Modelo treinado nos datasets públicos (4.493 fotos, 3.130 de treino, 695 de
teste), em CPU, em 38 minutos:

| classe | precisão | revocação | F1 | n |
| --- | --- | --- | --- | --- |
| PET | 0,825 | 0,792 | 0,808 | 101 |
| alumínio | 0,861 | 0,798 | 0,829 | 109 |
| vidro | 0,827 | 0,807 | 0,817 | 83 |
| papelão | 0,893 | 0,850 | 0,871 | 206 |
| outros | 0,741 | 0,832 | 0,784 | 196 |

Acurácia 0,823 e F1 macro 0,822. O relatório completo, com matriz de confusão e
curva de calibração, está em `modelo/relatorios/`.

**Calibração**: ECE de 0,019 sem ajuste, o que já é bom (o `label_smoothing` do
treino ajuda). O limiar escolhido foi **0,87**: com ele, 54% das fotos são
classificadas sozinhas com 95,3% de precisão, e 46% vão para conferência humana.
É bastante fila, e é o número honesto de um modelo treinado só em dados públicos.
A tabela de limiares em `metricas.json` mostra o custo de cada escolha, para a
coordenação decidir o ponto entre fila e precisão.

**Inferência no navegador** (`npm run medir:inferencia`, Edge headless):

| condição | mediana | p95 |
| --- | --- | --- |
| notebook | 15 ms | 20 ms |
| CPU 4x mais lenta | 69 ms | 97 ms |
| CPU 6x mais lenta (celular de entrada) | 130 ms | 149 ms |

O alvo era 1 segundo. O modelo tem 6,11 MB, dentro do alvo de 10 MB, **mas não
está quantizado**: a quantização int8 quebra esta rede em silêncio, e o
exportador a descarta por não passar na prova de concordância. O porquê, com a
tabela de tudo o que foi testado, está no [README do modelo](modelo/README.md).

## Decisões que valem entender

### A balança é a fonte do peso

A visão computacional aqui classifica material, confere consistência e detecta
fraude. Ela não estima peso, e `ocupacaoQuadro` não é volume: é a fração da
imagem que difere do fundo, usada só para perguntar se a foto e a balança
conversam na ordem de grandeza. Sem câmera calibrada e sem referência de escala
no quadro, peso por foto não sobrevive a auditoria, e número errado com aparência
de medida é pior que número nenhum.

### Offline vale a partir da segunda abertura

O app precisa de UMA abertura com internet antes de virar offline de verdade. É
nessa primeira vez que o service worker ([public/sw.js](public/sw.js), que o
app já usava) cacheia a página, o WebAssembly do onnxruntime (14 MB) e o modelo
(6 MB). Depois disso, abre e registra coleta sem rede, inclusive no modo avião.

Na prática isso quer dizer que **a instalação do aparelho é feita onde tem sinal,
não na praia**. Vale deixar isso no procedimento de entrega do celular ao
catador, junto com a instalação do ícone na tela inicial.

### A foto tem prazo, a evidência não

A retenção roda na abertura do app
([retencao.ts](src/validacao/armazenamento/retencao.ts)), e não num temporizador:
tarefa de fundo em PWA não tem garantia nenhuma de execução, e o aparelho do
catador passa a maior parte do tempo com o app fechado. Abrir é o único momento
em que se tem certeza de que o código roda.

Passados 30 dias (parâmetro, porque prazo é decisão de operação e de política de
privacidade), a foto é apagada do aparelho. O registro continua com hash,
assinatura, pHash e prova de inclusão intactos: some o dado pessoal, fica a
evidência auditável. A única exceção é foto de registro sinalizado que ainda
espera decisão humana, que é segurada até a coordenação decidir; apagar o que
alguém precisa olhar transformaria a revisão em carimbo.

O prazo conta a partir da COLETA, não da gravação da linha, para registro
reprocessado não ganhar prazo novo.

### Nada pessoal atravessa para a cadeia

O que sobe por dia é isto, e só isto:

```json
{
  "versaoEsquema": "evidencia-coleta-v1",
  "dataLote": "2026-09-14",
  "merkleRoot": "0x…",
  "quantidadeRegistros": 12,
  "pesoTotalKg": 148.5,
  "pesoPorMaterial": { "PET": 60, "aluminio": 12, "vidro": 40, "papelao": 30, "outros": 6.5 },
  "quantidadeSinalizados": 2
}
```

Sem foto, sem nome, sem coordenada, sem pseudônimo, sem id de registro. Isso não
é promessa de README: `exigirPayloadSemDadoPessoal` roda dentro de `montarLote`,
por lista branca de campos mais varredura de conteúdo, e lança em vez de
ancorar. Os testes estão em `testes/validacao/ancoragem.test.ts`, no bloco
"fronteira on-chain".

Imutabilidade e direito ao esquecimento são incompatíveis. Por isso a foto (o
dado pessoal de verdade: pode ter pessoa, casa, placa ao fundo) fica no aparelho
e pode ser apagada sozinha, sem destruir a evidência: o pHash continua no
registro e não reconstrói imagem nenhuma.

### O pseudônimo é HMAC, não hash

Com hash puro, quem tivesse a base e a lista de 30 famílias testaria os 30 nomes
em um segundo. O conjunto de entradas é pequeno demais. Com HMAC e sal fora do
repositório, não há o que testar. Isso é pseudonimização, não anonimização: quem
tem o sal e a lista reverte, e é por isso que o pseudônimo é tratado como dado
pessoal na base da operação e nunca vai para a cadeia.

Defina `VITE_SAL_PSEUDONIMO` antes de operar com dados reais. O painel de revisão
avisa em vermelho enquanto o sal for o de demonstração.

### Sinalizar não é rejeitar

Todo limiar da camada antifraude é um chute informado que ainda não viu um dia de
coleta em Boipeba. Limiar não calibrado que rejeita sozinho tira renda de família
por erro de estatística. E, socialmente, um sistema que acusa sozinho quebra a
confiança que faz o projeto funcionar.

Por isso cada sinalização carrega um `motivo` em português comum e `detalhes` com
os números que o sustentam. Quem revisa precisa entender o que o sistema viu, não
receber um código de erro.

Os limiares estão em `CONFIG_PADRAO`, em
[`src/validacao/antifraude/deteccoes.ts`](src/validacao/antifraude/deteccoes.ts),
e **todos precisam ser calibrados com dados reais**. O de Hamming começa em 8 de
64 bits, como manda a literatura, e vai precisar de ajuste: areia, sol forte e a
mesma parede ao fundo de toda foto empurram fotos legitimamente distintas para
perto.

### A sincronização não pode duplicar

Registro duplicado vira peso duplicado, que vira dinheiro duplicado no cofre
multisig. O id é gerado no aparelho e é a chave de idempotência; o servidor grava
uma vez só e aceita o reenvio. Quando o app morre no meio do envio, o item fica
em "enviando" e a fase de reconciliação do ciclo seguinte pergunta ao servidor o
que ele já tem, em vez de chutar entre duplicar e perder.

## Integrar o contrato de verdade

A camada de ancoragem é uma interface, e a implementação atual é um mock
funcional e testado. Para plugar o contrato:

1. **Implemente `Ancoradora`**
   ([`src/validacao/ancoragem/ancoradora.ts`](src/validacao/ancoragem/ancoradora.ts)):
   três métodos, `ancorar`, `consultar`, `raizAncorada`.

2. **Passe nos testes que já existem.** O bloco "contrato da ancoradora", em
   `testes/validacao/ancoragem.test.ts`, vale para qualquer implementação: troque
   `new AncoradoraMock()` pela sua e rode. Eles cobram idempotência por
   `dataLote`, recusa de mudar a raiz de um dia já fechado, e erro recuperável
   contra erro definitivo.

3. **Do lado do contrato**, a verificação é `MerkleProof.verify` padrão da
   OpenZeppelin. A árvore foi construída para isso:
   - folha = `keccak256(hashConteudo)`, hash duplo, para nó interno não poder se
     passar por folha
   - pares ordenados ao subir, então a prova não carrega o lado de cada irmão
   - nó ímpar sobe inalterado, sem duplicar (duplicar cria folhas idênticas e,
     com par ordenado, abre caminho para prova forjada)

   O contrato guarda `dataLote -> merkleRoot` e nada mais. Recusar sobrescrita de
   um dia já ancorado é regra de contrato, não de cliente.

4. **Chave privada não entra no navegador.** O app já segue esse padrão em
   [`src/lib/ancoragem.js`](src/lib/ancoragem.js), onde o navegador calcula o
   hash e quem assina é um script em [`onchain/`](onchain/), com a chave na
   máquina de quem opera. A implementação real de `Ancoradora` deve falar com
   esse processo, e não carregar carteira dentro do PWA.

O que o comprador do relatório recebe, para verificar sozinho, é uma
`ProvaDeColeta`: o hash do registro, a raiz do dia e o caminho de irmãos. Com a
raiz que está na cadeia, ele confere sem precisar confiar em nós, e sem que a
cadeia jamais tenha visto a coleta.

## Ligar a fila à base compartilhada

O transporte também é interface
([`src/validacao/sincronizacao/transporte.ts`](src/validacao/sincronizacao/transporte.ts)),
hoje implementada em memória. Para ligar ao Supabase que o projeto já usa
([`src/lib/nuvem.js`](src/lib/nuvem.js), `supabase/migracoes/`):

1. crie a migração da tabela de registros, com `id` (uuid, vindo do aparelho)
   como chave primária, e `upsert` com `ignoreDuplicates`. A idempotência é
   obrigação do servidor, e o esquema atual já trabalha assim, ver
   `supabase/migracoes/01-chave-e-idempotencia.sql`
2. implemente `enviar` (upsert em lote) e `jaRecebidos` (select por lista de ids)
3. troque `new TransporteMemoria()` por ele em
   [`src/validacao/campo/AppCampo.tsx`](src/validacao/campo/AppCampo.tsx). É a
   única linha do app que sabe qual transporte está em uso
4. o servidor deve reconferir o hash e a assinatura antes de gravar. O mock já
   faz a conferência de hash, e o teste que garante isso está na suíte

## Limites conhecidos

Coisas que este módulo não resolve, e que é melhor estarem escritas:

- **Os limiares antifraude não estão calibrados.** Estão em valores de partida,
  documentados um a um. Só as fotos de Boipeba dizem os certos.
- **O modelo foi treinado em datasets públicos.** TrashNet é estúdio, TACO é rua
  de cidade. Nenhum dos dois é praia de Boipeba com sol a pino. O caminho de
  fine-tune está pronto e é a prioridade quando as fotos chegarem. Enquanto isso,
  quase metade dos registros vai para conferência humana, e isso é o limiar
  fazendo o trabalho dele, não um defeito.
- **O modelo não está quantizado.** A quantização pós-treino quebra esta
  arquitetura, e o exportador a descarta automaticamente. Ele cabe no alvo de
  tamanho mesmo assim. Resolver de verdade é treino consciente de quantização.
- **A coordenação não vê a foto no painel.** É consequência direta de a foto
  ficar no aparelho. O painel mostra a evidência (distâncias, minutos, metros,
  quilos) e o motivo; quando não bastar, o caminho é falar com a pessoa.
- **O painel lê o banco local do navegador em que está aberto.** É o suficiente
  para demonstração e para revisar no mesmo aparelho, e vira a base compartilhada
  na mesma troca de uma linha que liga o transporte ao Supabase, descrita acima.
- **Convivem dois caminhos de validação.** A aba "Instituto Vivá" do painel tem o
  botão antigo, de um clique e sem evidência anexada, que é justamente o que este
  módulo substitui. Ele continua lá porque aposentá-lo é decisão de operação, com
  gente treinada nele, e porque enquanto o transporte for em memória os dois não
  compartilham dados. A aba avisa disso em texto, e aponta para a Conferência.
- **Um aparelho, um coletor.** O piloto assume isso, e a identidade do aparelho é
  a chave que assina. Aparelho compartilhado entre coletores exigiria repensar a
  assinatura.
- **O relógio do aparelho pode estar errado.** Por isso existe o carimbo do
  servidor, gravado quando a fila sobe. Os dois ficam no registro, e o do
  aparelho é o que entra no hash, porque é o que existia no momento da coleta.

## O que este módulo não faz, por decisão

Não existe, e não deve ser acrescentado sem uma discussão que envolva a
coordenação e não só a técnica:

- qualquer modelo preditivo sobre dados das crianças. É decisão de desenho do
  projeto, por risco ético e por LGPD: dado sensível de menor (art. 14) e direito
  à revisão de decisão automatizada (art. 20). Não é limitação técnica
- estimativa de peso por foto
- reconhecimento facial, identificação de pessoas, qualquer biometria
- rejeição automática de coleta
