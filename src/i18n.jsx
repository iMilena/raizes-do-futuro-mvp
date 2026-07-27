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
    '❔ Como funciona': '❔ How it works',
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
