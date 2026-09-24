/* ---------------------------------------------------------------------------
   Os assuntos e as perguntas de cada um, copiados do protótipo
   (`prototipos/raizes-contato.html`, objeto `FORMS`). O passo 2 do
   formulário é montado a partir daqui: mudar uma pergunta é mudar aqui.

   Tipos de campo: `pills` (escolha única em botões), `select`, `text` e
   `date`.
--------------------------------------------------------------------------- */

export const ASSUNTOS = [
  {
    v: 'investimento',
    rotulo: 'Investir no projeto',
    sub: 'Capital para ampliar coleta, validação e famílias no ciclo',
    icone: 'investimento',
  },
  {
    v: 'relatorio',
    rotulo: 'Empresas e turismo',
    sub: 'Comprar o Relatório de Circularidade ou peças da feira',
    icone: 'relatorio',
  },
  {
    v: 'territorio',
    rotulo: 'Parceria de território',
    sub: 'Repetir o modelo na sua comunidade ou organização',
    icone: 'territorio',
  },
  {
    v: 'imprensa',
    rotulo: 'Imprensa',
    sub: 'Entrevistas, reportagens e pedidos de material',
    icone: 'imprensa',
  },
  {
    v: 'outro',
    rotulo: 'Outro assunto',
    sub: 'Voluntariado, pesquisa, eventos ou uma ideia',
    icone: 'outro',
    largo: true,
  },
];

export const ROTULO = Object.fromEntries(ASSUNTOS.map((a) => [a.v, a.rotulo]));

export const FORMS = {
  investimento: {
    t: 'Sobre o investimento',
    s: 'Não precisa ter valores fechados. É só para a equipe preparar a conversa certa.',
    f: [
      { id: 'perfil', l: 'Você investe como', type: 'pills', o: ['Pessoa física', 'Fundo ou empresa', 'Fundação ou instituto', 'Programa ou edital'] },
      { id: 'faixa', l: 'Faixa que você considera', type: 'pills', o: ['Até R$ 10 mil', 'R$ 10 a 50 mil', 'R$ 50 a 200 mil', 'Acima de R$ 200 mil', 'Ainda não sei'] },
      { id: 'interesse', l: 'O que mais te interessa', type: 'select', o: ['Ampliar a operação em Boipeba', 'Levar o modelo a outros territórios', 'Tecnologia e rastreabilidade', 'Impacto na infância'] },
      { id: 'prazo', l: 'Quando pensa em decidir', type: 'select', o: ['Este mês', 'Nos próximos 3 meses', 'Este ano', 'Só estou conhecendo'] },
    ],
  },
  relatorio: {
    t: 'Sobre a compra',
    s: 'Cada relatório traz a evidência validada pela DeTrash e a receita já entra dividida no cofre 60/25/15.',
    f: [
      { id: 'tipo', l: 'Você é', type: 'pills', o: ['Empresa', 'Pousada ou hotel', 'Operador de turismo', 'Turista'] },
      { id: 'quer', l: 'Interesse', type: 'pills', o: ['Relatório de Circularidade', 'Peças da feira', 'Os dois'] },
      { id: 'freq', l: 'Frequência', type: 'select', o: ['Compra única', 'Mensal', 'Trimestral', 'Por temporada'] },
      { id: 'uso', l: 'Para que vai usar', type: 'select', o: ['Relatório ESG da empresa', 'Comunicação com clientes', 'Presente ou lembrança', 'Outro'] },
    ],
  },
  territorio: {
    t: 'Sobre o seu território',
    s: 'O modelo funciona onde já existe presença comunitária. Conte onde você atua.',
    f: [
      { id: 'local', l: 'Cidade ou comunidade', type: 'text', ph: 'Ex.: Ilha de Maré, Salvador' },
      { id: 'orgtipo', l: 'Sua organização', type: 'select', o: ['ONG ou associação', 'Prefeitura ou órgão público', 'Cooperativa de catadores', 'Universidade', 'Empresa'] },
      { id: 'residuo', l: 'Já existe coleta organizada?', type: 'pills', o: ['Sim', 'Parcial', 'Ainda não'] },
      { id: 'familias', l: 'Famílias que poderiam participar', type: 'select', o: ['Até 30', '30 a 100', '100 a 500', 'Mais de 500'] },
    ],
  },
  imprensa: {
    t: 'Sobre a pauta',
    s: 'Podemos organizar entrevista com a equipe, com o Instituto Vivá e visita guiada à ilha.',
    f: [
      { id: 'veiculo', l: 'Veículo', type: 'text', ph: 'Ex.: nome do jornal, canal ou podcast' },
      { id: 'formato', l: 'Formato', type: 'pills', o: ['Entrevista', 'Reportagem na ilha', 'Artigo', 'Podcast ou vídeo'] },
      { id: 'data', l: 'Prazo da pauta', type: 'date' },
      { id: 'foco', l: 'Enfoque', type: 'select', o: ['Proteção da infância', 'Blockchain e IA', 'Meio ambiente e resíduos', 'Juventude e o prêmio UNICEF'] },
    ],
  },
  outro: {
    t: 'Conte o que você tem em mente',
    s: 'Voluntariado, pesquisa, eventos ou uma ideia: a gente lê tudo.',
    f: [{ id: 'assunto', l: 'Assunto', type: 'text', ph: 'Em poucas palavras' }],
  },
};

/** O "o que acontece depois" do passo 2 da linha do tempo, por assunto. */
export const PROXIMO = {
  investimento: 'Com o kit de investidores, os números do piloto e horários para uma conversa.',
  relatorio: 'Com a proposta do relatório, valores e prazos de entrega.',
  territorio: 'Com perguntas sobre o território para avaliar se o modelo faz sentido aí.',
  imprensa: 'Com fotos em alta, dados verificados e contatos para entrevista.',
  outro: 'Com um retorno de quem cuida do assunto.',
};

export const PROXIMO_PADRAO = 'Com os materiais que fazem sentido para você e uma proposta de conversa.';
