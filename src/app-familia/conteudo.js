/* ---------------------------------------------------------------------------
   Os textos da página "App da família" (#/app), copiados do modelo aprovado
   (`modelo-raizes-app.html`).

   Foram escritos para famílias com pouca leitura: frases curtas e nenhum termo
   técnico. Mudar uma frase é mudar aqui, e vale a mesma regra: se uma palavra
   precisar de explicação, troque a palavra.
--------------------------------------------------------------------------- */

export const topo = {
  selo: { destaque: 'Grátis', texto: 'App das famílias · Boipeba' },
  titulo: ['O Raízes na palma da ', 'mão.'],
  sub: 'No Raízes Família, cada família vê o dinheiro das suas entregas, acompanha o bônus dos filhos e fala com a agente do Instituto Vivá. É simples, tem letra grande e lê as informações em voz alta.',
  primario: 'Abrir e instalar o app',
  secundario: 'Como instalar',
  chips: [
    { icone: 'check', texto: 'Android e iPhone' },
    { icone: 'semSinal', texto: 'Funciona sem internet' },
    { icone: 'som', texto: 'Lê em voz alta' },
  ],
  aviso: ['Fase de teste.', ' Nesta versão os valores são de exemplo e nenhum dinheiro de verdade é movimentado.'],
  qr: ['Aponte a câmera do celular', 'para abrir o app direto no telefone.'],
};

export const recursos = {
  eyebrow: 'O que a família faz no app',
  titulo: ['Tudo o que é da família, ', 'num lugar só.'],
  lede: 'O app foi pensado para quem tem celular simples e internet fraca. As informações aparecem em frases curtas, com letra grande e um botão para ouvir.',
  cartoes: [
    { icone: 'sacola', titulo: 'O dinheiro de cada entrega', texto: 'Peso, material, local, a foto de prova e quem validou. O que é trabalho aparece separado do bônus.' },
    { icone: 'filhos', titulo: 'O bônus dos filhos', texto: 'Vacina, matrícula e frequência em dia. Quando algo atrasa, o valor fica guardado, sem se perder.' },
    { icone: 'conversa', titulo: 'Ajuda de perto', texto: 'Fala com a agente do Instituto Vivá, pede saque assistido e tira dúvidas sem sair de casa.' },
    { icone: 'camera', titulo: 'Registrar entrega com foto', texto: 'Tira a foto mesmo sem sinal. O app guarda e envia sozinho quando a internet voltar.' },
    { icone: 'escudo', titulo: 'Pedir revisão', texto: 'Não concorda com uma entrega? Toca em "Não concordo" e uma pessoa da equipe olha de novo.' },
    { icone: 'extrato', titulo: 'Extrato para comprovar renda', texto: 'O extrato do mês sai em PDF ou em áudio. Além disso: agenda de mutirões e ouvidoria independente.' },
  ],
};

export const instalar = {
  eyebrow: 'Como instalar',
  titulo: ['Leva um minuto. ', 'E não custa nada.'],
  lede: 'O app abre pelo navegador e fica na tela inicial, com ícone, como qualquer aplicativo. Não precisa de loja nem de conta do Google.',
  rotuloAbas: 'Escolha o seu celular',
  /* Cada passo: [título, texto]. No texto, [[assim]] vira a "tecla" em
     destaque, que é o nome exato do botão que a pessoa vai procurar. */
  abas: [
    {
      id: 'android',
      rotulo: 'Android',
      passos: [
        ['Abra o link', 'Toque em [[Abrir o app]] nesta página, pelo navegador Chrome.'],
        ['Toque nos 3 pontinhos', 'No canto de cima, à direita do endereço.'],
        ['Instalar app', 'Escolha [[Instalar app]] ou [[Adicionar à tela inicial]] e confirme.'],
        ['Pronto', 'O ícone do Raízes aparece junto dos seus apps. Entre com o código da agente.'],
      ],
    },
    {
      id: 'iphone',
      rotulo: 'iPhone',
      passos: [
        ['Abra no Safari', 'Toque em [[Abrir o app]]. No iPhone, a instalação funciona pelo Safari.'],
        ['Compartilhar', 'Toque no quadrado com a seta para cima, embaixo da tela.'],
        ['Adicionar à Tela de Início', 'Role a lista, toque em [[Adicionar à Tela de Início]] e depois em [[Adicionar]].'],
        ['Pronto', 'O ícone do Raízes aparece na tela inicial. Entre com o código da agente.'],
      ],
    },
    {
      id: 'agente',
      rotulo: 'Com a agente',
      passos: [
        ['Leve o celular', 'No encontro ou na visita, a agente do Instituto Vivá instala com você.'],
        ['Receba o código', 'Ela gera um código de entrada que vale só uma vez, na hora.'],
        ['Crie o seu PIN', 'São 4 números que só você sabe. Ninguém do projeto pede esse número.'],
        ['Sem celular?', 'A agente atende a família pelo app dela e entrega o extrato em mãos.'],
      ],
    },
  ],
  botao: 'Abrir o app agora',
  rotuloEndereco: 'Endereço do app:',
};

export const privacidade = {
  eyebrow: 'Privacidade',
  titulo: ['O que é da família ', 'fica com a família.'],
  lede: 'O projeto conhece cada família só por um código. Nome, fotos e documentos não saem do celular.',
  celular: {
    titulo: 'Fica no seu celular',
    itens: ['O seu nome, o seu telefone e o nome dos seus filhos', 'As fotos das entregas e das revisões', 'O PIN, que só você sabe'],
  },
  projeto: {
    titulo: 'Vai para o projeto',
    itens: [
      'O código da família e quantas crianças participam',
      'As entregas, com a impressão digital da foto (não a foto)',
      'Se vacina, matrícula e frequência estão em dia, sem documentos',
    ],
  },
  golpe: ['Cuidado com golpe.', ' Ninguém do Raízes do Futuro ou do Instituto Vivá pede o seu PIN, senha ou código por mensagem. Na dúvida, fale com a agente pessoalmente.'],
};

export const agentes = {
  legenda: 'A agente do Instituto Vivá usa o mesmo app para atender quem não tem celular.',
  eyebrow: 'Para a equipe do Vivá',
  titulo: ['Um modo agente, ', 'para o trabalho de campo.'],
  itens: [
    { icone: 'cadastrar', texto: 'Cadastrar família, com o termo de consentimento lido em voz alta' },
    { icone: 'sacola', texto: 'Registrar entrega para quem não tem celular' },
    { icone: 'nota', texto: 'Confirmar saque assistido, com comprovante' },
    { icone: 'cadeado', texto: 'Gerar código de entrada e de troca de PIN' },
  ],
};

export const faq = {
  eyebrow: 'Perguntas',
  titulo: ['Dúvidas ', 'comuns.'],
  itens: [
    ['O app é pago?', 'Não. O app é grátis e não tem anúncios. Ele abre pelo navegador e fica na tela inicial do celular.'],
    ['Por que não está na Play Store?', 'Nesta fase de teste, o app é instalado pelo navegador, que é grátis e funciona em Android e iPhone. A versão da Play Store vem depois, publicada pela organização do projeto.'],
    ['E se eu não tiver internet?', 'O app abre sem internet e mostra o último saldo salvo. As entregas e os pedidos ficam guardados no celular e são enviados sozinhos quando o sinal voltar.'],
    ['Preciso ter conta de e-mail?', 'Não. A entrada é pelo número de telefone, com um código da agente do Vivá ou por SMS. Depois, você usa um PIN de 4 números.'],
    ['Quem pode ver os meus dados?', 'No servidor, a família aparece só como um código. Nome, fotos e documentos ficam no seu celular. A equipe vê as entregas e os compromissos para validar os pagamentos, e você pode retirar a autorização quando quiser.'],
    ['Meu celular é antigo. Funciona?', 'O app foi feito para celular simples. Se tiver dificuldade, a agente do Instituto Vivá instala com você ou atende a sua família pelo app dela.'],
  ],
};

export const final = {
  eyebrow: 'Raízes Família',
  titulo: ['Pronto para ', 'começar?'],
  lede: 'Abra o app no celular e entre com o código que a agente do Instituto Vivá entregou para você.',
  primario: 'Abrir e instalar o app',
  secundario: 'Falar com a equipe',
  fixo: 'Abrir o app',
};
