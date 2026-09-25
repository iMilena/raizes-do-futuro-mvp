/* ---------------------------------------------------------------------------
   Dois idiomas, sem biblioteca.

   ── ESCOPO, DITO EM VOZ ALTA ──────────────────────────────────────────────
   Está traduzido o que tem leitor de fato em inglês:

     · a PÁGINA PÚBLICA DE RASTREIO (#/rastreio/CÓDIGO) — quem escaneia o QR da
       peça em Boipeba é turista, e boa parte é estrangeira. Aqui o inglês tem
       usuário real, não hipotético.
     · o CASCO DO PAINEL (navegação, cabeçalho, rodapé) e o DASHBOARD — é o que
       um avaliador internacional abre primeiro.

   NÃO está traduzido, de propósito:

     · o APP DA FAMÍLIA. Quem usa é a mãe em Boipeba. Traduzir seria superfície
       sem usuário — e cada string a mais é uma a mais para dessincronizar.
     · as telas de OPERAÇÃO (coletor, validação, mercado, cofre). Quem opera é a
       equipe local. O painel em inglês serve leitura, e para leitura o Dashboard
       e o rastreio contam a história inteira.

   Meia tradução silenciosa seria pior que tradução nenhuma: o avaliador clica,
   cai em português no meio do fluxo e conclui que o resto foi feito com o mesmo
   descuido. Por isso o seletor avisa quando a tela aberta não tem versão em
   inglês, em vez de fingir.

   Português é o padrão sempre: este é um projeto brasileiro, e o inglês é a
   camada de leitura para fora.
--------------------------------------------------------------------------- */
import React, { createContext, useContext, useEffect, useState } from 'react';

const CHAVE = 'raizes-idioma-v1';

/* Telas com versão em inglês completa. O resto o seletor sinaliza. */
export const TRADUZIDAS = ['dashboard'];

const DICIONARIO = {
  en: {
    /* ---- Visão geral e menu do redesign ---- */
    'Até aqui,': 'So far,',
    'de resíduo validado viraram renda para': 'of validated waste became income for',
    'das': 'of the',
    'em setembro': 'in September',
    'Totais do projeto: os mesmos da página pública. Valores de setembro (receita, quilos e divisão): ilustrativos e coerentes com esses totais, até a equipe fechar o mês. A fila de hoje e as provas na cadeia leem o estado real do painel.': "Project totals: the same as the public site. September figures (revenue, kilos and split): illustrative and consistent with those totals, until the team closes the month. Today's queue and the on-chain proofs read the dashboard's real state.",
    '15% · validação, logística, infraestrutura': '15% · validation, logistics, infrastructure',
    '60% da receita, sem condições': '60% of revenue, no conditions',
    '60% · incondicional · 30 famílias': '60% · unconditional · 30 families',
    'Agosto': 'August',
    'Assinar': 'Sign',
    'Cofre 2-de-3': '2-of-3 Vault',
    'Coletas conferidas pela IA e validadas pela DeTrash': 'Collections checked by the AI and validated by DeTrash',
    'Como ler este painel.': 'How to read this dashboard.',
    'Comprovado pelo Instituto Vivá': 'Verified by Instituto Vivá',
    'Crianças com bônus': 'Children with bonus',
    'Do quilo recolhido na praia até a conta das famílias. Passe o mouse ou toque em qualquer faixa para ver a origem.': 'From the kilo picked up on the beach to the families\' accounts. Hover or tap any band to see where it came from.',
    'Em dia': 'Up to date',
    'Em setembro,': 'In September,',
    'Empresas': 'Companies',
    'Empresas (ESG)': 'Companies (ESG)',
    'Empresas para o cofre': 'Companies to the vault',
    'Evidência DeTrash vendida como relatório ESG': 'DeTrash evidence sold as an ESG report',
    'Famílias e carteiras': 'Families and wallets',
    'Fila de hoje': 'Today\'s queue',
    'Fluxo do mês': 'Flow of the month',
    'Infância': 'Childhood',
    'Material validado transformado em peças': 'Validated material turned into crafts',
    'Nenhum número desta tela é estimativa. Cada um vem de uma prova: a coleta validada pela DeTrash, a venda registrada no Mercado e a divisão executada pelo contrato na Solana.': 'No number on this screen is an estimate. Each one comes from a proof: the collection validated by DeTrash, the sale logged in the Market and the split executed by the contract on Solana.',
    'Nenhuma proposta no cofre': 'No proposal in the vault',
    'No modo Apresentação, cada número mostra de onde vem. No modo Operação, o mesmo painel vira a rotina da equipe: registrar, conferir, validar e assinar.': 'In Presentation mode, every number shows where it comes from. In Operations mode, the same dashboard becomes the team routine: log, check, validate and sign.',
    'Números do mês: dados de demonstração, até a equipe definir a base oficial. A fila de hoje e as provas na cadeia leem o estado real do painel.': 'Monthly figures: demonstration data, until the team sets the official baseline. Today\'s queue and the on-chain proofs read the dashboard\'s real state.',
    'O que depende de uma pessoa da equipe.': 'What needs a person from the team.',
    'Pago pelo contrato na Solana': 'Paid by the contract on Solana',
    'Para onde foi cada real de setembro': 'Where every real of September went',
    'Parar demonstração': 'Stop demo',
    'Peças para turistas': 'Crafts for tourists',
    'Proposta no cofre aguardando assinatura': 'Vault proposal awaiting signature',
    'Quilos validados por semana, de agosto a setembro': 'Kilos validated per week, August to September',
    'Rastrear um real do começo ao fim': 'Trace one real from start to finish',
    'Receita do mês': 'Revenue this month',
    'Registros públicos na Solana devnet. Ninguém consegue apagar ou alterar.': 'Public records on Solana devnet. Nobody can delete or change them.',
    'Relatório do mês': 'Monthly report',
    'Relatórios de Circularidade': 'Circularity Reports',
    'Relatórios para empresas': 'Reports for companies',
    'Renda': 'Income',
    'Renda das famílias': 'Family income',
    'Renda para as famílias': 'Income for families',
    'Resíduo validado': 'Validated waste',
    'Setembro': 'September',
    'Só entra aqui o que a DeTrash validou. Coleta pendente ou recusada fica de fora.': 'Only what DeTrash validated counts here. Pending or rejected collections are left out.',
    'Telas do painel': 'Dashboard screens',
    'Todas com foto e peso': 'All with photo and weight',
    'Turismo': 'Tourism',
    'Turismo para o cofre': 'Tourism to the vault',
    'Validado pela DeTrash': 'Validated by DeTrash',
    'Validar': 'Validate',
    'Validação do Instituto Vivá': 'Validation by Instituto Vivá',
    'Validação presencial do Vivá': 'In-person validation by Vivá',
    'Vendas registradas no Mercado': 'Sales logged in the Market',
    'Ver o ciclo completo': 'See the full cycle',
    'Ver o cofre na cadeia': 'See the vault on-chain',
    'agosto': 'August',
    'coleta(s) aguardando validação': 'collection(s) awaiting validation',
    'coleta(s) registrada(s) hoje': 'collection(s) logged today',
    'com saúde e escola em dia': 'with health and school up to date',
    'comprovação(ões) de crianças': 'children\'s proof(s)',
    'conferido pela IA e pela DeTrash': 'checked by the AI and by DeTrash',
    'crianças.': 'children.',
    'de 2 assinaturas': 'of 2 signatures',
    'de renda para': 'of income for',
    'de resíduo validado viraram': 'of validated waste became',
    'divide na entrada': 'splits on arrival',
    'entram no cofre já com a divisão por contrato': 'enter the vault already split by contract',
    'famílias': 'families',
    'famílias e bônus para': 'families and bonuses for',
    'liberados': 'released',
    'pendências': 'pending items',
    'peças com QR': 'crafts with QR',
    'peças rastreadas por QR': 'crafts traced by QR',
    'recebidos e divididos': 'received and split',
    'reservados': 'reserved',
    'semana de': 'week of',
    'setembro': 'September',
    'sobre agosto': 'over August',
    'validados': 'validated',
    'Últimas provas na cadeia': 'Latest on-chain proofs',
    'Trilha de prova': 'Proof trail',
    'Coleta': 'Collection',
    'Conferência da IA': 'AI review',
    'Validação do Vivá': 'Vivá validation',
    /* ---- casco do painel ---- */
    'Do resíduo à proteção da infância': 'From waste to child protection',
    'Boipeba · Cairu/BA': 'Boipeba · Cairu, Bahia, Brazil',
    'Visão geral': 'Overview',
    'Operação': 'Operations',
    'Governança': 'Governance',
    'Famílias': 'Families',
    'Dashboard': 'Dashboard',
    'Coletor': 'Collector',
    'Instituto Vivá': 'Instituto Vivá',
    'Mercado': 'Market',
    'Cofre Multisig': 'Multisig Vault',
    'Cadastro': 'Enrolment',
    'incluir família': 'add a family',
    'Família (operação)': 'Family (staff view)',
    'App da Família': 'Family App',
    'visão geral do piloto': 'pilot overview',
    'registrar coleta': 'log a collection',
    'validar & aprovar': 'validate & approve',
    'turista & empresa': 'tourist & company',
    'Solana · 2-de-3': 'Solana · 2-of-3',
    'visão do agente': 'field agent view',
    'como a família vê': 'what the family sees',
    'Cofre na Solana devnet': 'Vault live on Solana devnet',
    'Jornada do app simulada · cofre 2-de-3 real': 'App journey simulated · 2-of-3 vault real',
    'Como funciona': 'How it works',
    'Buscar coleta, família, peça ou transação…': 'Search collections, families, items or transactions…',
    'Pendências': 'Open items',
    'Nada pendente. Ciclo em dia.': 'Nothing pending. Cycle up to date.',
    'Modo local': 'Local mode',
    'sem sincronização': 'not syncing',
    'Exportar dados': 'Export data',
    'Configurações': 'Settings',
    'Nada encontrado para': 'No results for',
    'abrir →': 'open →',
    'próxima etapa →': 'next step →',
    '← etapa anterior': '← previous step',

    /* ---- dashboard ---- */
    'Impacto em tempo real': 'Impact in real time',
    'resíduos validados': 'waste validated',
    'direto para as famílias': 'straight to families',
    'crianças acompanhadas': 'children supported',
    'do piloto': 'of pilot',
    '▶ Ver o ciclo completo': '▶ Watch the full cycle',
    'Quilos validados por semana': 'Kilos validated per week',
    'Receita por fonte': 'Revenue by source',
    'Últimas atividades na rede': 'Latest network activity',
    'Produtos (turismo)': 'Products (tourism)',
    'Relatórios ESG (empresas)': 'ESG reports (companies)',
    'Créditos de reciclagem': 'Recycling credits',
    'Outras fontes': 'Other sources',
    'Ambiental': 'Environmental',
    'Econômico': 'Economic',
    'Social': 'Social',
    'Confiança Digital': 'Digital Trust',
    'Nenhuma coleta validada ainda': 'No validated collections yet',
    'Nenhuma receita registrada': 'No revenue recorded yet',
    'Total validado': 'Total validated',
    'semana(s)': 'week(s)',
    'slot atual': 'current slot',
    'transações': 'transactions',

    /* ---- página pública de rastreio (turista) ----
       Traduzida por inteiro: é a única tela com leitor estrangeiro real. */
    'Rastreio de produto': 'Product traceability',
    'Bahia, Brasil': 'Bahia, Brazil',
    'A história desta peça': 'The story of this piece',
    'Código': 'Code',
    'não encontrado': 'not found',
    'Confira o código impresso na etiqueta. Cada produto tem o seu, no formato RF-XXXX.':
      'Check the code printed on the tag. Every item has its own, in the format RF-XXXX.',
    'ver o projeto': 'see the project',
    'vendida em': 'sold on',
    'A jornada deste material': 'This material’s journey',
    'Recolhido na': 'Collected at',
    'de': 'of',
    'por': 'by',
    'total de': 'total of',
    'neste lote': 'in this batch',
    'Recolhido na ilha de Boipeba': 'Collected on Boipeba island',
    'material do estoque já verificado pela DeTrash':
      'material from stock already verified by DeTrash',
    'Verificado pela DeTrash': 'Verified by DeTrash',
    'A pesagem e a origem foram conferidas pela metodologia da DeTrash antes de virar produto.':
      'Weight and origin were checked using the DeTrash methodology before this became a product.',
    'registro': 'record',
    'Somado ao Relatório de Circularidade': 'Added to the Circularity Report',
    'verificados no período': 'verified in the period',
    'relatório ancorado na': 'report anchored on',
    'Sua compra': 'Your purchase',
    'entraram no ciclo do projeto.': 'entered the project’s cycle.',
    'transação registrada no slot': 'transaction recorded at slot',
    'Para onde foi o seu dinheiro': 'Where your money went',
    'Renda de quem coletou': 'Income for the collector',
    'Fundo Infância': 'Children’s Fund',
    'Operação na ilha': 'Operations on the island',
    'O que isso significa': 'What this means',
    'o código desta peça': 'this piece’s code',
    'Código de rastreio': 'Tracking code',
    'Mostre para outra pessoa escanear — a história é pública e verificável.':
      'Show it to someone else to scan — the story is public and verifiable.',
    'conhecer o projeto Raízes do Futuro': 'learn about the Raízes do Futuro project',

    /* ---- avisos do seletor ---- */
    'Esta tela existe apenas em português': 'This screen is available in Portuguese only',
    'As telas de operação são usadas pela equipe local. O Dashboard e a página pública de rastreio têm versão completa em inglês.':
      'Operational screens are used by the local team. The Dashboard and the public traceability page are fully translated.',
  },
};

const Ctx = createContext({ idioma: 'pt', t: s => s, trocar: () => {} });

const inicial = () => {
  try {
    const salvo = globalThis.localStorage?.getItem(CHAVE);
    if (salvo === 'en' || salvo === 'pt') return salvo;
  } catch { /* sem storage */ }
  /* Não adivinho pelo navegador: um avaliador brasileiro com Windows em inglês
     cairia numa tradução parcial sem pedir. Português é o padrão; inglês é
     escolha explícita. */
  return 'pt';
};

export function IdiomaProvider({ children }) {
  const [idioma, setIdioma] = useState(inicial);

  useEffect(() => {
    try { globalThis.localStorage?.setItem(CHAVE, idioma); } catch { /* ok */ }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = idioma === 'en' ? 'en' : 'pt-BR';
    }
  }, [idioma]);

  /**
   * Traduz. Sem entrada no dicionário, devolve o original — nunca uma chave
   * crua na tela nem string vazia. Falta de tradução deve parecer português,
   * não bug.
   */
  const t = s => (idioma === 'en' ? (DICIONARIO.en[s] ?? s) : s);

  return (
    <Ctx.Provider value={{ idioma, t, trocar: setIdioma, en: idioma === 'en' }}>
      {children}
    </Ctx.Provider>
  );
}

export const useIdioma = () => useContext(Ctx);

/** Quantas strings existem em inglês — usado no README e nos testes. */
export const totalTraduzido = () => Object.keys(DICIONARIO.en).length;
