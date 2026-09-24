/* ---------------------------------------------------------------------------
   Os lugares do mapa "Explorar a ilha".

   PRAIAS E COMUNIDADES: coordenadas aproximadas dos lugares reais de Boipeba.

   ATENÇÃO, POSIÇÕES ILUSTRATIVAS: `pesagem` (ponto de coleta), `viva`
   (Instituto Vivá), `feira` e `escola` NÃO são os endereços reais. Foram
   postas perto da vila e de Moreré só para a animação do ciclo fazer sentido
   no mapa. Troque pelas coordenadas verdadeiras assim que a equipe confirmar
   ([latitude, longitude], em graus decimais). O `cofre` fica de propósito no
   mar, a leste: ele representa o contrato on-chain, que não tem endereço.
--------------------------------------------------------------------------- */

export const L0 = {
  vila: [-13.5832, -38.9292],
  boca: [-13.5813, -38.9282],
  tass: [-13.5828, -38.9137],
  cueira: [-13.5922, -38.9132],
  morere: [-13.6097, -38.9074],
  bainema: [-13.6267, -38.9029],
  castelhanos: [-13.6735, -38.9152],
  saoseb: [-13.6636, -38.9468],
  /* ilustrativas (ver o aviso acima) */
  pesagem: [-13.5822, -38.9276],
  viva: [-13.5846, -38.9306],
  feira: [-13.6094, -38.9082],
  escola: [-13.663, -38.946],
  /* simbólica: o contrato no mar */
  cofre: [-13.615, -38.88],
};

/** Os limites da ilha, para a visão geral e o voo de entrada. */
export const ILHA = [
  [-13.68, -39.0],
  [-13.57, -38.872],
];

/** Até onde a pessoa pode arrastar o mapa. */
export const LIMITES = [
  [-13.78, -39.1],
  [-13.48, -38.78],
];

/* `extra` nomeia o bloco adicional do painel (ver PainelPonto.jsx). `foto` é a
   chave de uma foto em src/landing/images. */
export const POIS = [
  {
    id: 'coleta', g: ['ciclo'], n: '01', ll: L0.cueira, zoom: 16.5,
    et: '01 · Coleta', title: 'Mutirão nas praias', local: 'Praia da Cueira e Tassimirim',
    foto: 'coletaValidacao', cap: 'Mutirão de coleta · Boipeba',
    alt: 'Moradores reunidos na praia, sob os coqueiros, ao lado dos sacos de resíduo recolhidos.',
    text: 'Moradores e turistas separam o reciclável. Coletores parceiros percorrem as praias recolhendo PET, alumínio e vidro que chegam com a maré e com o turismo.',
    num: ['12 t', 'de resíduo coletadas e validadas até aqui'], tags: ['PET', 'Alumínio', 'Vidro'],
  },
  {
    id: 'pesagem', g: ['ciclo'], n: '02', ll: L0.pesagem, zoom: 17,
    et: '02 · Validação', title: 'Pesagem e prova com IA', local: 'Ponto de coleta · Velha Boipeba',
    text: 'O material é pesado no ponto de coleta. O app de campo funciona offline, registra peso e foto, e um modelo de visão computacional sinaliza o que precisa de conferência antes de a DeTrash emitir o Relatório de Circularidade.',
    num: ['4', 'detectores revisam cada coleta antes da validação'], tags: ['App offline', 'Visão computacional', 'DeTrash'],
    extra: 'detectores',
  },
  {
    id: 'viva', g: ['ciclo', 'comunidade'], n: '03', ll: L0.viva, zoom: 17, left: true,
    et: '03 · Território', title: 'Instituto Vivá', local: 'Velha Boipeba',
    foto: 'pilaresComunidade', cap: 'Encontro comunitário · Boipeba',
    alt: 'Roda de mulheres da comunidade reunidas em formação, com cadernos e materiais de trabalho.',
    text: 'Mobiliza famílias e recicladores na ilha e valida presencialmente as comprovações de saúde e educação das crianças. É a primeira das três assinaturas do cofre.',
    num: ['30+', 'famílias participantes do projeto'], tags: ['Assinatura 1', 'Mobilização'],
  },
  {
    id: 'feira', g: ['ciclo', 'comunidade'], n: '04', ll: L0.feira, zoom: 17, left: true,
    et: '04 · Circularidade e receita', title: 'Feira da comunidade', local: 'Moreré',
    foto: 'rendaDireta', cap: 'Feira da comunidade · Moreré',
    alt: 'Feira da comunidade com peças artesanais expostas na banca diante do mural do Projeto Vivá.',
    text: 'O material vira produto nas mãos de recicladores e famílias adultas parceiras, cada peça com QR code de rastreio. O Relatório de Circularidade é vendido a turistas e empresas que investem na ilha.',
    num: ['2', 'fontes de receita: turismo e empresas'], tags: ['QR de rastreio', 'Turismo', 'Empresas'],
  },
  {
    id: 'cofre', g: ['ciclo'], n: '05', ll: L0.cofre, zoom: 15, chain: true,
    et: '05 · Governança', title: 'Cofre multisig', local: 'On-chain · Solana',
    text: 'A cada venda, o contrato reparte o valor antes que alguém decida. Nenhuma organização controla o dinheiro sozinha.',
    num: ['2-de-3', 'assinaturas exigidas em cada liberação'], tags: ['Multisig', 'Divisão automática'],
    extra: 'cofre',
  },
  {
    id: 'escola', g: ['ciclo', 'comunidade'], n: '06', ll: L0.escola, zoom: 17,
    et: '06 · Destino final', title: 'Fundo Infância', local: 'Escolas e unidades de saúde da ilha',
    foto: 'fundoInfancia', cap: 'Oficina com material reciclado',
    alt: 'Duas crianças montando peças com material reciclado sobre a mesa.',
    text: 'O contrato libera R$ 30 por criança, por mês, quando vacinação, matrícula e frequência escolar estão comprovadas. A renda do trabalho é incondicional; o bônus é adicional.',
    num: ['51 de 60', 'crianças com saúde e escola em dia neste mês'], tags: ['R$ 30 por criança', 'Vacinação', 'Matrícula', 'Frequência'],
    extra: 'criancas',
  },
  /* praias */
  { id: 'p-boca', g: ['praias'], beach: 1, ll: L0.boca, zoom: 16, et: 'Praia', title: 'Boca da Barra', local: 'Velha Boipeba', left: true, text: 'Na ponta da vila, onde o Rio do Inferno encontra o mar. É a porta de entrada de quem chega de barco à ilha.', tags: ['Vila', 'Rio do Inferno'] },
  { id: 'p-tass', g: ['praias'], beach: 1, ll: L0.tass, zoom: 16, et: 'Praia', title: 'Tassimirim', local: 'Costa leste', text: 'Faixa extensa e calma de areia, cercada de coqueiros, a uma caminhada da vila.', tags: ['Coqueiral', 'Mar calmo'] },
  { id: 'p-cueira', g: ['praias'], beach: 1, ll: [-13.5935, -38.9127], zoom: 16, et: 'Praia', title: 'Cueira', local: 'Costa leste', text: 'Areia larga e coqueiral, conhecida pelas barracas de frutos do mar à beira da praia.', tags: ['Coqueiral', 'Frutos do mar'] },
  { id: 'p-morere', g: ['praias'], beach: 1, ll: [-13.611, -38.9064], zoom: 16, et: 'Praia', title: 'Moreré', local: 'Vila de pescadores', text: 'Pequena vila de pescadores com piscinas naturais que surgem na maré baixa.', tags: ['Piscinas naturais', 'Pesca'] },
  { id: 'p-bainema', g: ['praias'], beach: 1, ll: L0.bainema, zoom: 16, et: 'Praia', title: 'Bainema', local: 'Costa leste', text: 'Uma das praias mais isoladas da ilha, com recifes e coqueiral contínuo.', tags: ['Isolada', 'Recifes'] },
  { id: 'p-cast', g: ['praias'], beach: 1, ll: L0.castelhanos, zoom: 15.5, et: 'Praia', title: 'Ponta dos Castelhanos', local: 'Extremo sul', text: 'Mar aberto e recifes no sul da ilha. O nome remete a um antigo naufrágio espanhol.', tags: ['Recifes', 'Mar aberto'] },
  { id: 'p-cova', g: ['praias'], beach: 1, ll: [-13.666, -38.95], zoom: 15.5, et: 'Comunidade', title: 'Cova da Onça', local: 'São Sebastião', left: true, text: 'Comunidade do sul da ilha, voltada para o canal e o manguezal.', tags: ['Canal', 'Manguezal'] },
];

/** As seis etapas do ciclo, na ordem do percurso guiado. */
export const CICLO = POIS.filter((p) => p.n);

/** Qual linha de fluxo acende quando cada etapa está aberta. */
export const FLUXO_DA_ETAPA = { coleta: 0, pesagem: 1, feira: 2, cofre: 3, escola: 4 };

/* As linhas de fluxo entre as etapas, com partículas. `col` é RGB sem o
   alfa, para o canvas montar o rgba com a transparência de cada traço. */
export const FLUXOS = [
  { a: L0.cueira, b: L0.pesagem, col: '127,217,154', lbl: 'resíduo' },
  { a: L0.pesagem, b: L0.feira, col: '207,237,217', lbl: 'material validado' },
  { a: L0.feira, b: L0.cofre, col: '243,178,103', lbl: 'receita' },
  { a: L0.cofre, b: L0.vila, col: '127,217,154', lbl: '60% renda' },
  { a: L0.cofre, b: L0.escola, col: '243,178,103', lbl: '25% infância' },
];

/** Os barcos: vão e voltam entre `a` e `b`. */
export const BARCOS = [
  { a: [-13.602, -38.8985], b: [-13.612, -38.8975], t: 0, sp: 0.02 },
  { a: [-13.579, -38.938], b: [-13.5808, -38.931], t: 0.4, sp: 0.03 },
  { a: [-13.644, -38.897], b: [-13.64, -38.893], t: 0.2, sp: 0.025 },
];

/** Os trechos de praia onde os coletores trabalham: [início, fim, pessoas]. */
export const PRAIAS_COM_COLETA = [
  [[-13.5906, -38.9134], [-13.5942, -38.913], 3],
  [[-13.5816, -38.9139], [-13.5842, -38.9136], 2],
];
