/* ===========================================================================
   DADOS DE DEMONSTRAÇÃO. NÃO SÃO NÚMEROS REAIS DO PROJETO.

   Tudo o que a Visão geral e a Trilha de prova mostram sai daqui, e só daqui:
   o mês de setembro de 2026 que o protótipo aprovado usa para contar a
   história (R$ 16.400 de receita, os hashes, a família de exemplo).

   A equipe ainda não decidiu qual base vale para essas duas telas: os números
   da landing (12 t, 30 famílias, 60 crianças, 51 em dia), o estado do painel
   ou uma base nova. Quando decidir, basta trocar os valores deste arquivo, ou
   substituir as leituras dele por seletores do store. Nenhuma outra tela lê
   este arquivo, e nenhum número daqui deve ir parar em outra tela.

   Onde o painel já tem o dado de verdade (as transações do cofre na devnet),
   a Trilha usa o real e cai neste arquivo só quando o real ainda não existe.
=========================================================================== */

export const DEMONSTRACAO = true;

export const MES = {
  nome: 'setembro de 2026',
  kg: 1240,
  kgAnterior: 1051,
  receita: 16400,
  turismo: 3900,
  esg: 12500,
  renda: 9840,
  infancia: 4100,
  operacao: 2460,
  bonusLiberado: 1530,
  reservado: 2570,
  familias: 30,
  criancas: 60,
  emDia: 51,
  /* quilos validados por semana: as quatro primeiras são de agosto */
  semanas: [
    ['04/08', 188], ['11/08', 214], ['18/08', 251], ['25/08', 236],
    ['01/09', 262], ['08/09', 301], ['15/09', 344], ['22/09', 333],
  ],
};

/** Últimas provas na cadeia (modo Apresentação da Visão geral). */
export const PROVAS_RECENTES = [
  ['Bônus liberado · 51 crianças', '3Hy8…pLq2', 'há 2 h'],
  ['Divisão 60/25/15 · venda ESG', '5KxQ…9Qe1', 'ontem'],
  ['Lote diário de coletas · raiz Merkle', '7bE4…41aC', 'ontem'],
  ['Divisão 60/25/15 · 6 peças', '2mTd…Wk07', '22/09'],
];

/* As trilhas rastreáveis. Cada etapa: [título, quando, texto, [tipo da prova,
   código, nota]]. `tx` marca a etapa que pode ser trocada pela transação real
   do cofre, quando houver uma do mesmo tipo no store. */
export const TRILHAS = [
  {
    id: 'bonus',
    valor: 'R$ 30,00',
    rotulo: 'R$ 30 · bônus de setembro',
    contexto: 'Bônus de setembro · 1 criança · família Maria de Lourdes',
    etapas: [
      ['Coleta registrada na praia', '14/09 · 08:12 · Praia da Cueira', 'Coletora C-017 entregou 18,6 kg de PET. O app registrou peso, local e foto mesmo sem internet.', ['Foto', '9f3a…c21e', 'hash calculado no aparelho, a imagem não sai dele']],
      ['Conferência da IA', '14/09 · 08:13', 'Os quatro detectores rodaram sem alerta: pilha, sequência, foto reaproveitada e peso. Confiança do modelo 0,94, acima do limiar de 0,75.', ['Parecer', 'IA-2026-0914-031', 'nenhuma sinalização']],
      ['Validação DeTrash', '15/09', 'A metodologia DeTrash confirmou origem e volume e incluiu a coleta no Relatório de Circularidade.', ['Lote', '7bE4…41aC', 'só a raiz de Merkle e os totais vão para a cadeia']],
      ['Venda do relatório', '17/09 · Empresas (ESG)', 'Uma empresa parceira comprou o Relatório de Circularidade de setembro por R$ 2.500.', ['Venda', 'MK-0917-004', 'registrada no Mercado']],
      ['Divisão automática no contrato', '17/09', 'O contrato repartiu a venda antes de qualquer decisão humana: R$ 1.500 renda, R$ 625 Fundo Infância, R$ 375 operação.', ['Transação', '5KxQ…9Qe1', 'Solana devnet'], 'RECEITA'],
      ['Comprovações da criança', '20/09 · Instituto Vivá', 'Vacinação, matrícula e frequência comprovadas presencialmente. O painel registra que a prova existe, nunca o documento.', ['Validação', 'VV-0920-118', 'dados pessoais ficam com o Vivá']],
      ['Liberação 2-de-3', '21/09', 'Instituto Vivá e Representante comunitário assinaram. R$ 30 chegaram à carteira da família.', ['Transação', '3Hy8…pLq2', '2 de 3 assinaturas'], 'LIBERAÇÃO'],
      ['Na mão da família', '21/09 · Carteira da família', 'A família pode guardar ou sacar via Pix quando quiser. A conta é dela; a equipe não movimenta.', ['Carteira', 'UL7f…FnKi', 'família Maria de Lourdes']],
    ],
  },
  {
    id: 'renda',
    valor: 'R$ 1.500,00',
    rotulo: 'R$ 1.500 · renda da coleta',
    contexto: 'Renda da coleta · venda ESG de 17/09 · 60% para as famílias coletoras',
    etapas: [
      ['Coletas validadas do lote', '01 a 15/09', 'As coletas da quinzena passaram pela conferência da IA e pela validação DeTrash.', ['Lote', '7bE4…41aC', 'raiz de Merkle do lote diário']],
      ['Venda do relatório', '17/09 · Empresas (ESG)', 'Uma empresa parceira comprou o Relatório de Circularidade de setembro por R$ 2.500.', ['Venda', 'MK-0917-004', 'registrada no Mercado']],
      ['Divisão automática no contrato', '17/09', 'O contrato separou 60% da venda para a renda direta, sem condição nenhuma.', ['Transação', '5KxQ…9Qe1', 'Solana devnet'], 'RECEITA'],
      ['Repasse às carteiras', '17/09', 'A renda foi dividida entre as famílias coletoras, na proporção dos quilos validados de cada uma.', ['Repasse', 'RD-0917-030', '30 carteiras']],
    ],
  },
  {
    id: 'peca',
    valor: 'R$ 80,00',
    rotulo: 'R$ 80 · luminária de vidro',
    contexto: 'Luminária de vidro reaproveitado · vendida na feira de Moreré',
    etapas: [
      ['Vidro recolhido e validado', '05/09 · Moreré', 'O vidro da peça saiu de coletas validadas na praia de Moreré.', ['Lote', '4cA1…9e0B', 'origem do material']],
      ['Peça feita por família adulta parceira', '09/09', 'A luminária foi feita na oficina da comunidade e ganhou um QR code de rastreio.', ['QR', 'PC-0912-014', 'rastreio público da peça']],
      ['Venda na feira', '12/09 · Turismo', 'Uma turista comprou a peça na feira da comunidade por R$ 80.', ['Venda', 'MK-0912-021', 'registrada no Mercado']],
      ['Divisão automática no contrato', '12/09', 'R$ 48 renda, R$ 20 Fundo Infância, R$ 12 operação.', ['Transação', '2mTd…Wk07', 'Solana devnet'], 'RECEITA'],
    ],
  },
  {
    id: 'operacao',
    valor: 'R$ 375,00',
    rotulo: 'R$ 375 · operação',
    contexto: 'Operação · 15% da venda ESG de 17/09',
    etapas: [
      ['Venda do relatório', '17/09 · Empresas (ESG)', 'Uma empresa parceira comprou o Relatório de Circularidade de setembro por R$ 2.500.', ['Venda', 'MK-0917-004', 'registrada no Mercado']],
      ['Divisão automática no contrato', '17/09', 'O contrato separou 15% para a operação: validação em campo, logística e infraestrutura.', ['Transação', '5KxQ…9Qe1', 'Solana devnet'], 'RECEITA'],
      ['Uso registrado', '19/09', 'O valor pagou o combustível do barco de logística e a manutenção da balança do ponto de coleta.', ['Despesa', 'OP-0919-007', 'comprovante anexado']],
    ],
  },
];
