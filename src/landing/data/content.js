/* ---------------------------------------------------------------------------
   Todo o texto da landing, na ordem em que aparece.

   A fonte é o protótipo aprovado (`prototipos/raizes-landing.html`): o texto
   daqui é o de lá, palavra por palavra. Mudar uma frase é mudar aqui, nunca no
   JSX.

   Dois enquadramentos ficam de fora, de propósito: "o problema / a solução",
   que trata o território como defeito a consertar, e qualquer verbo que sugira
   que o projeto *participa* do Youth Challenge Blockchain. Ele venceu.

   Os números são os reais e não têm arredondamento de conveniência: 12
   toneladas, 30 famílias, 60 crianças, 51 em dia (85%), divisão 60/25/15,
   R$ 30 por criança/mês, cofre 2-de-3.
--------------------------------------------------------------------------- */

import { URL_CONTATO, URL_EXPLORAR, URL_PAGINA_APP, URL_PAINEL, URL_PRIVACIDADE } from '../../config.js';

/** Link para a página de contato com o assunto já escolhido. */
export const contatoCom = (tipo) => `${URL_CONTATO}?tipo=${tipo}`;

/* O `id` é o da seção na página; o menu destaca a seção em que o leitor está. */
export const navItems = [
  { id: 'inicio', label: 'Início' },
  { id: 'impacto', label: 'Impacto' },
  { id: 'como', label: 'Como funciona' },
  { id: 'infancia', label: 'Fundo Infância' },
  { id: 'parceiros', label: 'Parceiros' },
  { id: 'faq', label: 'FAQ' },
];

export const nav = {
  app: { rotulo: 'App da família', href: URL_PAGINA_APP },
  painel: { rotulo: 'Entrar no painel', href: URL_PAINEL },
  contato: { rotulo: 'Falar com a equipe', curto: 'Contato', href: URL_CONTATO },
};

export const hero = {
  selo: { destaque: 'Vencedor', texto: 'Youth Challenge Blockchain · UNICEF Brasil' },
  /* Quebrado em linhas à mão: cada uma sobe por trás da própria máscara. */
  linhas: [
    { texto: 'Um futuro', acento: false },
    { texto: 'mais justo para', acento: false },
    { texto: 'as crianças', acento: true },
    { texto: 'de Boipeba', acento: true },
  ],
  subtitulo:
    'Transformamos economia circular em renda familiar e proteção à infância, por meio de blockchain e dinheiro programável.',
  primario: { rotulo: 'Investir no projeto', href: contatoCom('investimento') },
  secundario: { rotulo: 'Explorar a ilha e o ciclo', href: URL_EXPLORAR },
  aoVivo: 'Em operação em Boipeba, Cairu, Bahia',
  marcadores: [
    { valor: '30+', rotulo: 'famílias' },
    { valor: '60', rotulo: 'crianças' },
    { valor: '12 t', rotulo: 'de resíduo validadas' },
  ],
  legendaFoto: 'Mutirão de coleta · Boipeba',
  role: 'ROLE',
};

export const manifesto = {
  eyebrow: 'O projeto',
  /* A frase acende palavra por palavra conforme a rolagem. `destaque` é o
     trecho em itálico menta. */
  antes: 'Em Boipeba, o trabalho de quem limpa e recicla o território pode financiar diretamente',
  destaque: 'a saúde e a educação das crianças',
  depois: 'da comunidade.',
  lateral:
    'O Raízes do Futuro transforma esse valor em renda familiar e em suporte financeiro programável, de forma transparente, automática, e sem depender de caridade.',
  botao: 'Ver como o ciclo funciona',
};

export const impacto = {
  eyebrow: 'Impacto até aqui',
  titulo: ['O ciclo não é projeto de gaveta. ', 'Ele já roda.'],
  lede: 'Coleta validada, receita dividida por contrato e bônus liberado por cofre multisig, acontecendo em Boipeba com as famílias da ilha.',
  numeros: [
    { valor: 12, unidade: 't', rotulo: 'Toneladas de resíduo coletadas e validadas' },
    { valor: 30, rotulo: 'Famílias participantes do projeto' },
    { valor: 60, rotulo: 'Crianças acompanhadas' },
    { valor: 85, sufixo: '%', rotulo: 'Com saúde e escola em dia' },
  ],
};

export const coorte = {
  total: 60,
  emDia: 51,
  rotuloGrade: '51 de 60 crianças com saúde e escola em dia',
  eyebrow: 'As 60 crianças acompanhadas',
  titulo: 'Cada ponto é uma criança dentro do Fundo Infância.',
  texto:
    '51 das 60 estão com vacinação, matrícula e frequência comprovadas, e por isso recebem o bônus do mês. Para as outras, o valor fica reservado, nunca perdido.',
  legendaEmDia: 'Saúde e escola em dia',
  legendaEmCurso: 'Acompanhamento em curso',
  botaoApp: { rotulo: 'Conhecer o app da família', href: URL_PAGINA_APP },
};

export const parceiros = {
  eyebrow: 'Quem opera o ciclo',
  titulo: ['Três organizações, e ', 'nenhuma manda sozinha.'],
  lede: 'A governança não é promessa de slide: está escrita no contrato que libera o dinheiro.',
  legendaFoto: 'Encontro comunitário · Boipeba',
  itens: [
    {
      n: '1',
      etiqueta: 'Território · Assinatura 1',
      nome: 'Instituto Vivá',
      texto:
        'Mobiliza famílias e recicladores em Boipeba e valida presencialmente as comprovações de saúde e educação das crianças.',
    },
    {
      n: '2',
      etiqueta: 'Validação · Assinatura 2',
      nome: 'DeTrash',
      texto:
        'Metodologia que valida a coleta e gera o Relatório de Circularidade, com a evidência ancorada on-chain.',
    },
    {
      n: '3',
      etiqueta: 'Comunidade · Assinatura 3',
      nome: 'Representante comunitário',
      texto:
        'A ilha tem assento no cofre. Nenhuma liberação do Fundo Infância acontece sem que a comunidade possa assinar.',
    },
  ],
};

export const ciclo = {
  eyebrow: 'Como funciona',
  titulo: ['Um ciclo fechado, do resíduo à ', 'proteção da infância.'],
  lede: 'Coleta validada vira evidência auditável, evidência vira receita, receita vira renda e proteção da infância, dividida por código.',
  /* `foto` é a chave de uma foto em ../images; `arte` é o desenho do cartão
     sem foto. As sete etapas são as sete marcas da barra de progresso. */
  etapas: [
    {
      indice: '01 · Origem',
      rotulo: 'Resíduo',
      titulo: 'Resíduo',
      texto:
        'Moradores e turistas separam material reciclável. Moradores participam de ações de coleta pela ilha.',
      tags: ['PET', 'Alumínio', 'Vidro'],
      foto: 'coletaValidacao',
    },
    {
      indice: '02 · Território',
      rotulo: 'Coleta',
      titulo: 'Coleta',
      texto: 'Catadores e pontos de coleta parceiros recolhem e pesam o material recolhido na ilha.',
      tags: ['Pesagem', 'Ponto parceiro'],
      foto: 'pesagemSacos',
    },
    {
      indice: '03 · Prova',
      rotulo: 'Validação',
      titulo: 'Validação',
      texto:
        'O registro em campo confirma origem e volume. A metodologia da DeTrash valida a coleta e gera um Relatório de Circularidade.',
      tags: ['Registro em campo', 'Evidência on-chain'],
      arte: 'detectores',
    },
    {
      indice: '04 · Destino',
      rotulo: 'Circularidade',
      titulo: 'Circularidade',
      texto:
        'O material segue para reaproveitamento local. Os produtos são feitos por recicladores e famílias adultas parceiras, e cada um leva um QR code de rastreio.',
      tags: ['Reaproveitamento local', 'QR de rastreio'],
      foto: 'rendaDireta',
    },
    {
      indice: '05 · Receita',
      rotulo: 'Receita',
      titulo: 'Duas fontes de receita',
      texto:
        'O Relatório de Circularidade vira receita, vendido a turistas e empresas que investem nas ações comunitárias da ilha.',
      tags: ['Turismo', 'Empresas'],
      arte: 'fontes',
    },
    {
      indice: '06 · Governança',
      rotulo: 'Cofre',
      titulo: 'Cofre',
      texto:
        'O valor entra num cofre multisig e é dividido automaticamente por código. Nenhuma organização controla o dinheiro sozinha.',
      tags: ['Multisig 2-de-3', 'Divisão automática'],
      arte: 'cofre',
    },
    {
      indice: '07 · Destino final',
      rotulo: 'Infância',
      titulo: 'Saúde e educação',
      texto:
        'Renda e bônus chegam às famílias e às crianças. A renda do trabalho é incondicional; o bônus do Fundo Infância é adicional.',
      tags: ['Renda direta', 'Bônus da infância'],
      foto: 'oficinaEscola',
    },
  ],
};

export const divisao = {
  eyebrow: 'Dividido por código',
  titulo: ['A cada venda, o contrato reparte ', 'antes que alguém decida.'],
  lede: 'A blockchain não é usada só para registrar dados: ela executa as regras do projeto.',
  fatias: [
    {
      chave: 'a',
      pct: 60,
      titulo: 'Renda direta',
      texto:
        'Vai direto, e sem condições, para quem participa do trabalho ambiental da ilha. Vale para todos os coletores, com ou sem crianças em casa.',
    },
    {
      chave: 'b',
      pct: 25,
      titulo: 'Fundo Infância',
      texto:
        'Reservado para o bônus por criança, liberado quando os compromissos de saúde e educação são comprovados.',
    },
    {
      chave: 'c',
      pct: 15,
      titulo: 'Operação',
      texto: 'Sustenta a validação em campo, a logística da coleta e a infraestrutura auditável.',
    },
  ],
};

export const cofre = {
  eyebrow: 'Experimente o cofre',
  titulo: 'Ninguém abre sozinho.',
  texto:
    'Um Smart Contract libera R$ 30 por criança/mês quando vacinação, matrícula e frequência escolar são comprovadas. A liberação exige 2 de 3 assinaturas. Desligue um compromisso ou tire uma assinatura e veja o que acontece.',
  bonus: 30,
  rotuloCompromissos: 'Compromissos da criança',
  rotuloAssinaturas: 'Assinaturas do cofre',
  compromissos: [
    { id: 'vacinacao', rotulo: 'Vacinação', sub: 'caderneta em dia' },
    { id: 'matricula', rotulo: 'Matrícula', sub: 'confirmada na escola' },
    { id: 'frequencia', rotulo: 'Frequência', sub: 'presença mínima no mês' },
  ],
  /* O representante comunitário começa desligado de propósito: o cofre libera
     com 2 de 3, e ver a terceira assinatura em aberto é o que mostra que ela
     não é enfeite. */
  assinaturas: [
    { id: 'viva', rotulo: 'Instituto Vivá', sub: 'presença territorial', inicial: true },
    { id: 'detrash', rotulo: 'DeTrash', sub: 'validação da coleta', inicial: true },
    { id: 'comunidade', rotulo: 'Representante comunitário', sub: 'voz da comunidade', inicial: false },
  ],
  liberado: (n) => `Liberado por criança/mês. ${n} de 3 assinaturas reunidas e compromissos comprovados.`,
  faltaCompromisso: 'Falta um compromisso comprovado',
  faltaAssinatura: (n) => `Só ${n} de 3 assinaturas`,
  reservado: 'O valor fica reservado no Fundo Infância, nunca é perdido.',
};

export const simulador = {
  eyebrow: 'Para onde vai cada real',
  titulo: 'Veja o que o contrato faz com a receita.',
  rotuloCampo: 'Receita gerada pelo Relatório de Circularidade',
  min: 1000,
  max: 60000,
  passo: 1000,
  inicial: 10000,
  marcas: [1000, 30000, 60000],
  linhas: [
    { pct: 60, cor: 'var(--mint)', rotulo: '60% · Renda direta', sub: 'direto para as famílias que fazem a coleta, sem condição' },
    { pct: 25, cor: 'var(--dawn)', rotulo: '25% · Fundo Infância', sub: 'reservado para o bônus, liberado pelo cofre 2-de-3' },
    { pct: 15, cor: 'var(--foam)', rotulo: '15% · Operação', sub: 'validação em campo, logística e infraestrutura' },
  ],
  criancas: 60,
  bonus: 30,
  cobertura: (m) => `bônus de R$ 30 por criança, ou as 60 crianças de Boipeba cobertas por ${m} ${m === 1 ? 'mês' : 'meses'}.`,
  semCobertura: 'bônus de R$ 30 por criança neste mês.',
  nota: 'Simulação com as regras que já estão no contrato: divisão 60/25/15 e bônus de R$ 30 por criança/mês. Não é projeção de receita, é a aritmética de para onde o dinheiro vai quando entra.',
};

export const pontas = {
  eyebrow: 'A infraestrutura',
  titulo: ['Três pontas que ', 'se sustentam.'],
  itens: [
    {
      etiqueta: 'PONTA 01',
      titulo: 'Coleta e Validação',
      texto:
        'Catadores parceiros recolhem e pesam. O registro em campo confirma origem e volume, e a evidência é ancorada on-chain.',
    },
    {
      etiqueta: 'PONTA 02',
      titulo: 'Fundo Infância',
      texto:
        '25% da receita fica reservada. O bônus só é liberado com vacinação, matrícula e frequência comprovadas, e nunca é perdido.',
    },
    {
      etiqueta: 'PONTA 03',
      titulo: 'Renda Direta',
      texto:
        '60% de toda receita gerada pelas coletas validadas vai direto, e sem condições, para quem faz o trabalho ambiental da ilha.',
    },
  ],
};

export const pilares = {
  eyebrow: 'Nossos pilares',
  titulo: ['Quatro compromissos que ', 'não se negociam.'],
  itens: [
    {
      titulo: 'Infâncias Protegidas',
      texto:
        'Nenhuma criança deveria crescer num território onde degradação ambiental, falta de renda e ausência de serviços se reforçam mutuamente. É essa lógica que o projeto quebra.',
    },
    {
      titulo: 'Famílias Fortes',
      texto:
        '60% de toda receita gerada pelas coletas validadas vai direto, e sem condições, para quem participa do trabalho ambiental da ilha.',
    },
    {
      titulo: 'Territórios Saudáveis',
      texto:
        'Fortalecer a gestão comunitária de resíduos e as ações de preservação ambiental em Boipeba, com a ilha no centro da decisão.',
    },
    {
      titulo: 'Confiança Digital',
      texto:
        'Blockchain e dinheiro programável tornam cada etapa, da coleta ao bônus da criança, rastreável e auditável por qualquer pessoa.',
    },
  ],
};

export const feira = {
  citacao:
    'Cada peça carrega um QR code que mostra de onde veio o material e para onde foi o dinheiro da venda.',
  legenda: 'Feira da comunidade · Moreré, Boipeba',
};

/* A galeria: as fotos reais do ciclo, uma ao lado da outra. `foto` é a
   chave em ../images; `forma` diz quanto da grade a foto ocupa: `largo` duas
   colunas, `alto` duas linhas (a foto em pé), `cheio` a linha inteira. */
export const galeria = {
  eyebrow: 'Boipeba, de perto',
  titulo: ['O ciclo acontece ', 'com gente de verdade.'],
  fotos: [
    { foto: 'mutiraoGrupo', legenda: 'Mutirão de limpeza · Boipeba', forma: 'largo' },
    { foto: 'criancaEscola', legenda: 'Na escola · Boipeba', forma: 'alto' },
    { foto: 'pesagemSacos', legenda: 'Pesagem da coleta · Boipeba' },
    { foto: 'balancaPesagem', legenda: 'Cada quilo registrado · 6,54 kg' },
    { foto: 'oficinaEscola', legenda: 'Oficina com o Instituto Vivá · escola da ilha', forma: 'cheio' },
  ],
};

export const faq = {
  eyebrow: 'Perguntas frequentes',
  titulo: ['O que costumam ', 'nos perguntar.'],
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
  titulo: ['A prova está feita. ', 'Agora é escalar.'],
  lede: 'O ciclo funciona em Boipeba. O que falta não é tecnologia, é volume: mais coleta validada, mais receita entrando no cofre, mais crianças cobertas pelo Fundo Infância.',
  frentes: [
    {
      n: '01',
      titulo: 'Investimento',
      texto:
        'Capital para ampliar a operação de coleta e validação na ilha e levar mais famílias para dentro do ciclo.',
      acao: 'Quero investir',
      href: contatoCom('investimento'),
    },
    {
      n: '02',
      titulo: 'Empresas e turismo',
      texto:
        'Compradores do Relatório de Circularidade: pousadas, operadores e empresas que querem investir nas ações comunitárias com rastro auditável.',
      acao: 'Comprar o relatório',
      href: contatoCom('relatorio'),
    },
    {
      n: '03',
      titulo: 'Parceiros de território',
      texto: 'Organizações com presença em outras comunidades, para repetir o modelo onde ele faz sentido.',
      acao: 'Levar para minha comunidade',
      href: contatoCom('territorio'),
    },
  ],
};

export const fechamento = {
  eyebrow: 'Vamos juntos',
  antes: 'Vamos construir juntos um futuro ',
  destaque: 'mais justo',
  depois: ' para as crianças de Boipeba.',
  primario: { rotulo: 'Entrar em contato', href: URL_CONTATO },
  secundario: { rotulo: 'Conhecer os parceiros', href: '#parceiros' },
};

export const rodape = {
  tagline: 'Do impacto ambiental à proteção da infância. Boipeba, Cairu, Bahia.',
  colunas: [
    {
      titulo: 'Navegação',
      links: [
        { rotulo: 'Início', href: '#inicio' },
        { rotulo: 'Impacto', href: '#impacto' },
        { rotulo: 'Como funciona', href: '#como' },
        { rotulo: 'FAQ', href: '#faq' },
        { rotulo: 'App da família', href: URL_PAGINA_APP },
      ],
    },
    {
      titulo: 'Projeto',
      links: [
        { rotulo: 'Painel do projeto', href: URL_PAINEL },
        { rotulo: 'Fundo Infância', href: '#infancia' },
        { rotulo: 'Investir', href: contatoCom('investimento') },
        { rotulo: 'Parceiros', href: '#parceiros' },
      ],
    },
    {
      titulo: 'Outros',
      /* "Equipe" ainda não tem página e aponta para o contato. A política de
         privacidade mora no app das famílias, que é quem coleta os dados. */
      links: [
        { rotulo: 'Equipe', href: URL_CONTATO },
        { rotulo: 'Contato', href: URL_CONTATO },
        { rotulo: 'UNICEF Brasil', href: 'https://www.unicef.org/brazil/', externo: true },
        { rotulo: 'Política de Privacidade', href: URL_PRIVACIDADE, externo: true },
      ],
    },
  ],
  assinatura: 'Raízes do Futuro · Boipeba, Bahia',
  premio: 'Youth Challenge Blockchain · UNICEF Brasil',
};
