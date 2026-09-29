RAÍZES DO FUTURO — CAMADA DE IA DA VALIDAÇÃO DE COLETA
======================================================

O QUE O PROJETO FAZ

O Raízes do Futuro remunera famílias catadoras de Boipeba (BA) pelo material
reciclável que coletam. A camada de IA roda no celular do catador, sem
internet: um modelo de visão classifica o material pela foto, e seis
detectores antifraude comparam cada coleta com as anteriores. Toda suspeita
vira pedido de conferência humana na tela da coordenação, e nunca rejeição
automática.


REQUISITOS

- Node.js 20 ou mais recente (testado com o 24), com npm
- Um navegador atual: Chrome, Edge ou Firefox
- Não precisa de chave, senha, conta nem .env. A IA roda inteira no navegador,
  e o modelo já vem pronto em public/modelo/.
- Python 3.12 só se quiser RETREINAR o modelo (opcional, ver mais abaixo).


COMO RODAR

    npm install
    npm run dev

Depois abra no navegador:

    http://localhost:5173/campo.html     app de campo (o que o catador usa)
    http://localhost:5173/revisao.html   tela de conferência (a coordenação)

Para rodar os testes automáticos da camada (207 testes, sem navegador):

    npm run test:validacao


ROTEIRO DE TESTE (cerca de 5 minutos)

As fotos estão em exemplos/fotos/. Use o MESMO navegador nas duas páginas: os
registros ficam no banco local do navegador (IndexedDB), não num servidor.

1. Abra http://localhost:5173/campo.html e toque em "Nova coleta".
2. Toque em "Abrir a câmera". No computador, isso abre o seletor de arquivos.
   Escolha exemplos/fotos/1-garrafa-pet.jpg e toque em "Continuar".
3. O modelo classifica a foto no próprio navegador: "Parece Plástico PET 100%".
   Toque em "Continuar com Plástico PET".
4. Digite 2,5 no teclado da tela, toque em "Guardar 2,5 kg" e depois em
   "Guardar coleta". Essa primeira coleta passa limpa.
5. Toque em "Nova coleta" e repita o processo com as outras fotos, na ordem e
   com o peso indicados:

     2-lata-aluminio.jpg          1,5 kg
     3-papelao.jpg                4 kg
     4-copo-vidro.jpg             6 kg
     5-embalagem-duvidosa.jpg     1 kg    o modelo diz "Não tenho certeza"
     6-garrafa-pet-REPETIDA.jpg   2,5 kg  cópia exata da foto 1
     7-lata-com-peso-errado.jpg   40 kg   uma lata só, com 40 kg

   Ao guardar, o próprio app de campo já avisa: "Esta coleta vai passar por
   conferência", e diz o motivo.
6. Abra http://localhost:5173/revisao.html. Cada coleta sinalizada aparece
   num cartão, com o motivo em português, os números que o detector usou, os
   registros comparados, a verificação de integridade ("hash confere ·
   assinatura confere") e os botões Aprovar e Rejeitar.

O que deve aparecer (resultado conferido num Edge em 29/09/2026):

  foto 5   CONFIANÇA BAIXA        "O aplicativo não teve certeza do material
                                  (37% de confiança em PET)."
  foto 6   FOTO REAPROVEITADA     "A foto é idêntica à de um registro de...".
                                  O pHash das duas fotos é o mesmo (distância 0
                                  em 64 bits).
           PILHA RECONTADA        mesmo material, mesmo peso, mesmo lugar, poucos
                                  minutos depois.
  foto 7   PESO INCOERENTE        "A foto mostra pouco material para 40 kg de
                                  alumínio."
  fotos 2 a 7  SEQUÊNCIA IMPROVÁVEL  menos de 3 minutos desde a coleta anterior
                                  do mesmo coletor. Ao testar em sequência, isso
                                  aparece em quase todas as coletas, e está
                                  certo: ninguém junta, pesa e anota outra pilha
                                  em um minuto.

O sexto detector, FORA DO TERRITÓRIO, depende do GPS. Se o navegador pedir a
localização e você permitir, a coleta vai cair fora da área de Boipeba e será
sinalizada. Se você recusar, o app usa a posição padrão da ilha e o detector
não dispara.

Para repetir o teste do zero, use uma janela anônima ou apague os dados do site
localhost:5173 no navegador.

Atalho, se não quiser registrar as fotos: em revisao.html, o botão "Carregar um
dia de exemplo" monta sete coletas e as passa pelos mesmos detectores. As
sinalizações não ficam gravadas em lugar nenhum: são calculadas pelo código.


ONDE ESTÃO OS ARQUIVOS DA IA

Modelo (classificação do material)
  public/modelo/classificador.onnx     modelo treinado (MobileNetV3 small, 6 MB)
  public/modelo/classificador.json     classes, normalização, limiar de confiança
  src/validacao/ia/classificador.ts    carrega e roda o modelo no navegador
                                       (onnxruntime-web)
  src/validacao/ia/preprocesso.ts      recorte e normalização da foto, iguais aos
                                       do treino

Detectores antifraude
  src/validacao/antifraude/deteccoes.ts  os seis detectores e os limiares
  src/validacao/antifraude/phash.ts      hash perceptual da foto (DCT, 64 bits)
  src/validacao/antifraude/ocupacao.ts   fração da foto ocupada por material
  src/validacao/antifraude/geohash.ts    localização e área de operação

Onde a IA é usada
  src/validacao/campo/registro-de-campo.ts  monta a coleta: foto, pHash,
                                            classificação, detecções, assinatura
  src/validacao/campo/                      app de campo (campo.html)
  src/validacao/revisao/PainelRevisao.tsx   tela de conferência (revisao.html)

Treino do modelo (Python)
  modelo/raizes_modelo/                pipeline de dados, treino, calibração,
                                       avaliação e exportação para ONNX
  modelo/configuracao/treino.yaml      configuração do treino
  modelo/relatorios/metricas.json      métricas do modelo publicado
  modelo/README.md                     como baixar os dados e retreinar

Testes
  testes/validacao/                    207 testes em TypeScript (npm run test:validacao)
  modelo/testes/                       testes do pipeline em Python

Documentação técnica completa: VALIDACAO.md


NÚMEROS DO MODELO

Treinado só com dados públicos (TrashNet e TACO, 4.493 fotos, cinco classes:
PET, alumínio, vidro, papelão, outros). No conjunto de teste (695 fotos que o
modelo não viu): acurácia 0,823, F1 macro 0,822.

Limiar de confiança: 0,87. Abaixo dele, a tela diz "Não tenho certeza" e a
coleta vai para conferência humana. O valor foi escolhido pelo pipeline para
dar 95% de precisão no que passa sozinho: 54% das fotos são classificadas
sem conferência, e 46% vão para uma pessoa.

A inferência leva cerca de 15 ms num notebook e 130 ms com a CPU seis vezes
mais lenta, para simular um celular de entrada.

O modelo não estima peso. O peso vem sempre da balança, e a foto só é usada
para conferir se a balança e a imagem são coerentes.


RETREINAR O MODELO (OPCIONAL)

Não é necessário para o teste. Para reproduzir o treino, com Python 3.12:

    cd modelo
    python -m venv .venv
    .venv\Scripts\python.exe -m pip install -r requisitos.txt

Os passos seguintes (baixar os dados, treinar e exportar) estão em
modelo/README.md. Em CPU, o treino leva de 40 a 90 minutos.


CHAVES E PARTES QUE NÃO SÃO DE IA

Nenhuma chave está incluída. O arquivo .env.exemplo documenta as variáveis
opcionais, e nenhuma delas é necessária para a IA:

- Sem VITE_SAL_PSEUDONIMO, o app usa um sal de demonstração, e a tela de
  conferência mostra um aviso em vermelho. É esperado.
- A ancoragem na blockchain (pasta onchain/, devnet) e a sincronização com o
  Supabase não fazem parte do roteiro. Na tela de conferência, o botão
  "ancorar" aparece como "(simulado)".


O QUE EU FIZ PESSOALMENTE

Sou autora de 95 dos 99 commits do repositório
(github.com/iMilena/raizes-do-futuro-mvp). Pelos commits:

Camada de IA, inteira
- pipeline do modelo em Python (modelo/): montagem dos dados do TrashNet e do
  TACO, mapeamento das categorias deles para as 5 classes do projeto, divisão
  determinística treino/validação/teste, fine-tuning da MobileNetV3-Small,
  calibração, escolha do limiar e exportação para ONNX
- classificação no navegador, offline (src/validacao/ia/)
- os seis detectores antifraude, o pHash, a ocupação do quadro e o geohash
  (src/validacao/antifraude/)
- app de campo, tela de conferência, evidência assinada e lote diário com raiz
  de Merkle (src/validacao/)
- os testes da camada (testes/validacao/ e modelo/testes/)

Backend
- esquema do Supabase e migrações (supabase/): transações append-only, acesso
  por papel, consentimento, retenção com expurgo e contestação pela família
- sincronização entre aparelhos offline (src/lib/nuvem.js, src/lib/sincronizacao.js)
- contrato FundoInfancia.sol, cofre multisig 2-de-3 e ancoragem na Solana
  devnet (contracts/ e onchain/)

Colegas de equipe com commits no repositório: Maria Clara (reorganização das
pastas, landing page e tela de login) e Alessandro Haber (refatoração de UI:
logos, dashboard e gráficos).

Desenvolvi com o apoio de um assistente de programação com IA (Claude Code), o
que está registrado como coautoria em 59 commits.
