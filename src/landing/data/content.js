/* ---------------------------------------------------------------------------
   Todo o texto da landing.

   Dois enquadramentos ficam de fora, de propósito: "o problema / a solução",
   que trata o território como defeito a consertar, e qualquer verbo que sugira
   que o projeto *participa* do Youth Challenge Blockchain. Ele venceu.

   Os números aqui são os reais e não têm arredondamento de conveniência:
   12 toneladas, 30 famílias, 60 crianças, 85% com saúde e escola em dia,
   divisão 60/25/15, R$ 30 por criança/mês, cofre 2-de-3.
--------------------------------------------------------------------------- */

export const navItems = [
  { id: 'topo', label: 'Início' },
  { id: 'impacto', label: 'Impacto' },
  { id: 'ciclo', label: 'Como Funciona' },
  { id: 'valor', label: 'Fundo Infância' },
  { id: 'parceiros', label: 'Parceiros' },
  { id: 'faq', label: 'FAQ' },
];

export const hero = {
  selo: { destaque: 'Vencedor', texto: 'Youth Challenge Blockchain · UNICEF Brasil' },
  /* Quebrado em linhas à mão: cada uma sobe por trás da própria máscara. */
  linhas: [
    { texto: 'Um Futuro', acento: false },
    { texto: 'Mais Justo para', acento: false },
    { texto: 'as Crianças', acento: true },
    { texto: 'de Boipeba', acento: true },
  ],
  subtitulo:
    'Transformamos economia circular em renda familiar e proteção à infância, por meio de blockchain e dinheiro programável.',
  legendaFoto: 'Mutirão de coleta · Boipeba, Cairu, Bahia',
  aoVivo: 'Em operação em Boipeba, Cairu, Bahia',
  marcadores: [
    { valor: '30+', rotulo: 'famílias' },
    { valor: '60', rotulo: 'crianças' },
    { valor: '12 t', rotulo: 'de resíduo validadas' },
  ],
  primario: 'Investir no projeto',
  secundario: 'Ver o ciclo rodando',
};

export const tese = {
  eyebrow: 'O projeto',
  /* Cada item é uma linha da máscara. String simples, ou as três partes de uma
     linha que tem destaque no meio. */
  linhas: [
    'Em Boipeba, o trabalho',
    'de quem limpa e recicla',
    'o território pode financiar',
    { antes: 'diretamente a ', destaque: 'saúde', depois: ' e a' },
    { destaque: 'educação das crianças' },
    'da comunidade.',
  ],
  lateral:
    'O Raízes do Futuro transforma esse valor em renda familiar e em suporte financeiro programável, de forma transparente, automática, e sem depender de caridade.',
};

export const impacto = {
  eyebrow: 'Impacto até aqui',
  titulo: 'O ciclo não é projeto de gaveta. Ele já roda.',
  lede: 'Coleta validada, receita dividida por contrato e bônus liberado por cofre multisig, acontecendo em Boipeba com as famílias da ilha.',
};

export const numeros = [
  { valor: 12, sufixo: '', rotulo: 'Toneladas de resíduo coletadas e validadas' },
  { valor: 30, sufixo: '', rotulo: 'Famílias participantes do projeto' },
  { valor: 60, sufixo: '', rotulo: 'Crianças acompanhadas' },
  { valor: 85, sufixo: '%', rotulo: 'Com saúde e escola em dia' },
];

export const coorte = {
  titulo: 'As 60 crianças acompanhadas',
  total: 60,
  emDia: 51,
  legendaEmDia: 'saúde e escola em dia',
  legendaEmCurso: 'acompanhamento em curso',
  nota: 'Cada ponto é uma criança dentro do Fundo Infância. 51 das 60 estão com vacinação, matrícula e frequência comprovadas, e por isso recebem o bônus do mês. Para as outras, o valor fica reservado, nunca perdido.',
};

export const parceiros = {
  eyebrow: 'Quem opera o ciclo',
  titulo: 'Três organizações, e nenhuma delas manda sozinha.',
  lede: 'A governança não é promessa de slide: está escrita no contrato que libera o dinheiro.',
  legendaFoto: 'Encontro comunitário · Boipeba',
  itens: [
    {
      papel: 'Território',
      nome: 'Instituto Vivá',
      etiqueta: 'Assinatura 1',
      texto:
        'Mobiliza famílias e recicladores em Boipeba e valida presencialmente as comprovações de saúde e educação das crianças.',
    },
    {
      papel: 'Validação',
      nome: 'DeTrash',
      etiqueta: 'Assinatura 2',
      texto:
        'Metodologia que valida a coleta e gera o Relatório de Circularidade, com a evidência ancorada on-chain.',
    },
    {
      papel: 'Comunidade',
      nome: 'Representante comunitário',
      etiqueta: 'Assinatura 3',
      texto:
        'A ilha tem assento no cofre. Nenhuma liberação do Fundo Infância acontece sem que a comunidade possa assinar.',
    },
  ],
};

export const ciclo = {
  eyebrow: 'Como funciona',
  titulo: 'Um ciclo fechado, do resíduo à proteção da infância.',
  lede: 'Uma infraestrutura com três pontas: coleta validada vira evidência auditável, evidência vira receita, receita vira renda e proteção da infância, dividida por código.',
  rotuloEtapa: 'Etapa',
  /* A cor de cada etapa é o próprio argumento: menta enquanto é território,
     âmbar quando vira dinheiro, terracota quando chega na criança. */
  etapas: [
    {
      indice: 'Origem',
      rotulo: 'Resíduo',
      titulo: 'Resíduo',
      texto:
        'Moradores e turistas separam material reciclável. Moradores participam de ações de coleta pela ilha.',
      cor: '#7FD99A',
      chips: [{ texto: 'PET' }, { texto: 'Alumínio' }, { texto: 'Vidro' }],
    },
    {
      indice: 'Território',
      rotulo: 'Coleta',
      titulo: 'Coleta',
      texto: 'Catadores e pontos de coleta parceiros recolhem e pesam o material recolhido na ilha.',
      cor: '#7FD99A',
      chips: [{ texto: 'Pesagem' }, { texto: 'Ponto parceiro' }],
    },
    {
      indice: 'Prova',
      rotulo: 'Validação',
      titulo: 'Validação',
      texto:
        'O registro em campo confirma origem e volume. A metodologia da DeTrash valida a coleta e gera um Relatório de Circularidade.',
      cor: '#9FE3B4',
      chips: [{ texto: 'Registro em campo' }, { texto: 'Evidência ancorada on-chain', tom: 'menta' }],
    },
    {
      indice: 'Destino',
      rotulo: 'Circularidade',
      titulo: 'Circularidade',
      texto:
        'O material segue para reaproveitamento local. Os produtos são feitos por recicladores e famílias adultas parceiras, e cada um leva um QR code de rastreio.',
      cor: '#BFECCB',
      chips: [{ texto: 'Reaproveitamento local' }, { texto: 'QR de rastreio' }],
    },
    {
      indice: 'Receita',
      rotulo: 'Receita',
      titulo: '2 fontes de receita',
      texto:
        'O Relatório de Circularidade vira receita, vendido a turistas e empresas que investem nas ações comunitárias da ilha.',
      cor: '#F3B267',
      chips: [
        { texto: 'Turismo', tom: 'ambar' },
        { texto: 'Empresas', tom: 'ambar' },
      ],
    },
    {
      indice: 'Governança',
      rotulo: 'Cofre',
      titulo: 'Cofre',
      texto:
        'O valor entra num cofre multisig e é dividido automaticamente por código. Nenhuma organização controla o dinheiro sozinha.',
      cor: '#F3B267',
      chips: [
        { texto: 'Multisig 2-de-3', tom: 'ambar' },
        { texto: 'Divisão automática', tom: 'ambar' },
      ],
    },
    {
      indice: 'Destino final',
      rotulo: 'Infância',
      titulo: 'Saúde e educação',
      texto:
        'Renda e bônus chegam às famílias e às crianças. A renda do trabalho é incondicional; o bônus do Fundo Infância é adicional.',
      cor: '#D97742',
      chips: [
        { texto: 'Renda direta', tom: 'terracota' },
        { texto: 'Bônus da infância', tom: 'terracota' },
      ],
    },
  ],
};

export const divisao = {
  eyebrow: 'Dividido por código',
  titulo: 'A cada venda, o contrato reparte antes que alguém decida.',
  lede: 'A blockchain não é usada só para registrar dados: ela executa as regras do projeto.',
  /* `barra` é a largura relativa da tarja, não a porcentagem: 60% ancora a
     maior e as outras duas se medem contra ela. Três barras iguais mentiriam
     sobre a divisão. */
  fatias: [
    {
      chave: 'renda',
      pct: 60,
      barra: '100%',
      titulo: 'Renda direta',
      texto:
        'Vai direto, e sem condições, para quem participa do trabalho ambiental da ilha. Vale para todos os coletores, com ou sem crianças em casa.',
    },
    {
      chave: 'fundo',
      pct: 25,
      barra: '42%',
      titulo: 'Fundo Infância',
      texto:
        'Reservado para o bônus por criança, liberado quando os compromissos de saúde e educação são comprovados.',
    },
    {
      chave: 'operacao',
      pct: 15,
      barra: '25%',
      titulo: 'Operação',
      texto:
        'Sustenta a validação em campo, a logística da coleta e a infraestrutura que mantém tudo auditável.',
    },
  ],
};

export const cofre = {
  eyebrow: 'Experimente o cofre',
  titulo: 'Ninguém abre sozinho.',
  bonus: 30,
  compromissos: [
    { id: 'vacinacao', rotulo: 'Vacinação' },
    { id: 'matricula', rotulo: 'Matrícula' },
    { id: 'frequencia', rotulo: 'Frequência' },
  ],
  /* O representante comunitário começa pendente de propósito: o cofre libera
     com 2 de 3, e ver a terceira assinatura em aberto é o que mostra que ela
     não é enfeite. */
  signatarios: [
    { id: 'viva', nome: 'Instituto Vivá', papel: 'Presença territorial', inicial: true },
    { id: 'detrash', nome: 'DeTrash', papel: 'Validação da coleta', inicial: true },
    { id: 'comunidade', nome: 'Representante comunitário', papel: 'Voz da comunidade', inicial: false },
  ],
};

export const simulador = {
  titulo: 'Veja o que o contrato faz com cada real que entra.',
  rotuloReceita: 'Receita gerada',
  rotuloCampo: 'Receita gerada pelo Relatório de Circularidade',
  min: 1000,
  max: 60000,
  passo: 500,
  inicial: 10000,
  /* As três marcas sob o trilho. Números redondos escolhidos à mão: o ponto
     médio aritmético cairia em R$ 30.500 e leria como erro de digitação. */
  marcas: [1000, 30000, 60000],
  cartoes: [
    {
      chave: 'renda',
      pct: 60,
      barra: '100%',
      rotulo: '60% · Renda direta',
      texto: 'Direto para as famílias que fazem a coleta, sem condição nenhuma.',
    },
    {
      chave: 'fundo',
      pct: 25,
      barra: '42%',
      rotulo: '25% · Fundo Infância',
      texto: 'Reservado para o bônus por criança, liberado pelo cofre 2-de-3.',
    },
    {
      chave: 'operacao',
      pct: 15,
      barra: '25%',
      rotulo: '15% · Operação',
      texto: 'Validação em campo, logística da coleta e a infraestrutura auditável.',
    },
  ],
  nota: 'Simulação com as regras que já estão no contrato: divisão 60/25/15 e bônus de R$ 30 por criança/mês. Não é projeção de receita, é a aritmética de para onde o dinheiro vai quando entra.',
};

export const pontas = {
  eyebrow: 'A infraestrutura',
  titulo: 'Três pontas que se sustentam.',
  itens: [
    {
      id: 'coleta-validacao',
      etiqueta: 'Ponta 01',
      titulo: 'Coleta e Validação',
      texto:
        'Catadores parceiros recolhem e pesam. O registro em campo confirma origem e volume, e a evidência é ancorada on-chain.',
      imagem: 'coletaValidacao',
      destaque: false,
    },
    {
      id: 'fundo-infancia',
      etiqueta: 'Ponta 02',
      titulo: 'Fundo Infância',
      texto:
        '25% da receita fica reservada. O bônus só é liberado com vacinação, matrícula e frequência comprovadas, e nunca é perdido.',
      imagem: 'fundoInfancia',
      destaque: true,
    },
    {
      id: 'renda-direta',
      etiqueta: 'Ponta 03',
      titulo: 'Renda Direta',
      texto:
        '60% de toda receita gerada pelas coletas validadas vai direto, e sem condições, para quem faz o trabalho ambiental da ilha.',
      imagem: 'rendaDireta',
      destaque: false,
    },
  ],
};

export const pilares = {
  eyebrow: 'Nossos pilares',
  titulo: 'Quatro compromissos que não se negociam.',
  /* Sem numeração: são quatro compromissos simultâneos, não uma sequência. */
  itens: [
    {
      id: 'infancias',
      icone: 'escudo',
      titulo: 'Infâncias Protegidas',
      texto:
        'Nenhuma criança deveria crescer num território onde degradação ambiental, falta de renda e ausência de serviços se reforçam mutuamente. É essa lógica que o projeto quebra.',
    },
    {
      id: 'familias',
      icone: 'familia',
      titulo: 'Famílias Fortes',
      texto:
        '60% de toda receita gerada pelas coletas validadas vai direto, e sem condições, para quem participa do trabalho ambiental da ilha.',
    },
    {
      id: 'territorios',
      icone: 'territorio',
      titulo: 'Territórios Saudáveis',
      texto:
        'Fortalecer a gestão comunitária de resíduos e as ações de preservação ambiental em Boipeba, com a ilha no centro da decisão.',
    },
    {
      id: 'confianca',
      icone: 'confianca',
      titulo: 'Confiança Digital',
      texto:
        'Blockchain e dinheiro programável tornam cada etapa, da coleta ao bônus da criança, rastreável e auditável por qualquer pessoa.',
    },
  ],
};

export const faixaDeLuz = {
  legenda: 'Feira da comunidade · Moreré, Boipeba',
};

export const faq = {
  eyebrow: 'Perguntas frequentes',
  titulo: 'O que costumam nos perguntar.',
  itens: [
    {
      q: 'O que é o Raízes do Futuro?',
      a: 'Uma solução que conecta economia circular, renda familiar e proteção da infância em Boipeba (Bahia), usando blockchain e dinheiro programável. O projeto é o vencedor do Youth Challenge Blockchain, iniciativa do UNICEF Brasil que busca soluções inovadoras de tecnologia para a proteção de crianças e adolescentes, e hoje está em operação no território.',
    },
    {
      q: 'Por que blockchain é essencial para o projeto?',
      a: 'A blockchain não é usada só para registrar dados: ela executa as regras do projeto. A cada venda, a receita é dividida automaticamente por código (60% renda direta, 25% Fundo Infância, 15% operação), e a liberação de qualquer bônus exige 2 de 3 assinaturas em um cofre multisig, garantindo que nenhuma organização controle o dinheiro sozinha.',
    },
    {
      q: 'Qual o papel do Instituto Vivá?',
      a: 'O Instituto Vivá é o parceiro com presença territorial em Boipeba: mobiliza famílias e recicladores, valida presencialmente as comprovações de saúde e educação das crianças, e é um dos três signatários que autorizam cada liberação do cofre multisig do Fundo Infância.',
    },
    {
      q: 'Como funciona o fluxo do projeto, do resíduo à criança?',
      a: 'Moradores e turistas separam material reciclável, que catadores parceiros recolhem e pesam. A metodologia da DeTrash valida essa coleta e gera um Relatório de Circularidade, com evidência ancorada on-chain. Esse relatório vira receita, vendida a turistas e empresas, que entra num cofre multisig e é dividida automaticamente entre renda das famílias, Fundo Infância e operação.',
    },
    {
      q: 'Quem não tem filhos em casa também é beneficiado?',
      a: 'Sim. A renda gerada pela coleta é incondicional e vale para todos os coletores, com ou sem crianças em casa. O bônus do Fundo Infância é um valor adicional, só para quem tem crianças sob os cuidados de saúde e educação em dia: ele nunca substitui a renda do trabalho.',
    },
    {
      q: 'Como funciona o Fundo Infância e o cofre multisig 2-de-3?',
      a: 'Um Smart Contract libera bônus de R$ 30 por criança/mês quando vacinação, matrícula e frequência escolar são comprovadas. A liberação exige 2 de 3 assinaturas (Instituto Vivá, DeTrash e um representante comunitário). Se um compromisso não é cumprido no mês, o valor fica reservado, nunca é perdido.',
    },
    {
      q: 'As crianças participam da produção dos itens reciclados?',
      a: 'Não. Os produtos são feitos por recicladores e famílias adultas parceiras do projeto. O papel das crianças no Raízes do Futuro é outro: são elas quem se beneficiam diretamente, através do Fundo Infância, dos cuidados de saúde e da permanência escolar que o projeto ajuda a viabilizar.',
    },
    {
      q: 'Onde posso comprar os produtos feitos com material reciclado?',
      a: 'O canal preferido pela nossa pesquisa com turistas foi a feira da própria comunidade em Boipeba: é lá que a compra se conecta diretamente com quem participa da coleta. Cada produto carrega um QR code que mostra de onde veio o material e para onde foi o dinheiro da venda.',
    },
  ],
};

export const proximoPasso = {
  eyebrow: 'O próximo passo',
  titulo: 'A prova está feita. Agora é escalar.',
  lede: 'O ciclo funciona em Boipeba. O que falta não é tecnologia, é volume: mais coleta validada, mais receita entrando no cofre, mais crianças cobertas pelo Fundo Infância.',
  frentes: [
    {
      n: '01',
      titulo: 'Investimento',
      texto:
        'Capital para ampliar a operação de coleta e validação na ilha e levar mais famílias para dentro do ciclo.',
    },
    {
      n: '02',
      titulo: 'Empresas e turismo',
      texto:
        'Compradores do Relatório de Circularidade: pousadas, operadores e empresas que querem investir nas ações comunitárias com rastro auditável.',
    },
    {
      n: '03',
      titulo: 'Parceiros de território',
      texto: 'Organizações com presença em outras comunidades, para repetir o modelo onde ele faz sentido.',
    },
  ],
};

export const cta = {
  eyebrow: 'Vamos juntos',
  titulo: 'Vamos construir juntos um futuro mais justo para as crianças de Boipeba.',
  primario: 'Entrar em contato',
  secundario: 'Conhecer os parceiros',
};

export const contato = {
  eyebrow: 'Fale com a equipe',
  titulo: 'O ciclo já roda. Falta escala.',
  intro:
    'O Raízes do Futuro é um projeto em operação em Boipeba, vencedor do Youth Challenge Blockchain do UNICEF Brasil. Diga em qual frente você quer entrar e a gente responde com os números abertos.',
  caminhos: [
    {
      titulo: 'Investir',
      texto: 'Capital para ampliar a coleta validada e levar mais famílias para dentro do ciclo.',
    },
    {
      titulo: 'Comprar o Relatório de Circularidade',
      texto:
        'Pousadas, operadores de turismo e empresas que querem investir nas ações comunitárias com rastro auditável.',
    },
    {
      titulo: 'Levar o modelo para outro território',
      texto: 'Organizações com presença em comunidades que podem repetir o ciclo.',
    },
    {
      titulo: 'Imprensa e pesquisa',
      texto: 'Material sobre a arquitetura do cofre multisig e a metodologia de validação.',
    },
  ],
  interesses: [
    'Investir no projeto',
    'Comprar o Relatório de Circularidade',
    'Levar o modelo para outro território',
    'Imprensa e pesquisa',
    'Outro assunto',
  ],
};

export const rodape = {
  tagline: 'Do impacto ambiental à proteção da infância. Boipeba, Cairu, Bahia.',
  colunas: [
    {
      titulo: 'Navegação',
      links: [
        { rotulo: 'Início', href: '#topo' },
        { rotulo: 'Impacto', href: '#impacto' },
        { rotulo: 'Como Funciona', href: '#ciclo' },
        { rotulo: 'FAQ', href: '#faq' },
      ],
    },
    {
      titulo: 'Projeto',
      links: [
        { rotulo: 'Painel do projeto', painel: true },
        { rotulo: 'Fundo Infância', href: '#valor' },
        { rotulo: 'Investir', href: '#apoiar' },
        { rotulo: 'Parceiros', href: '#parceiros' },
      ],
    },
    {
      titulo: 'Outros',
      links: [
        { rotulo: 'Equipe', contato: true },
        { rotulo: 'Contato', contato: true },
        { rotulo: 'UNICEF Brasil', href: '#topo' },
        { rotulo: 'Política de Privacidade', href: '#topo' },
      ],
    },
  ],
  assinatura: 'Raízes do Futuro · Boipeba, Bahia',
  premio: 'Youth Challenge Blockchain · UNICEF Brasil',
};
