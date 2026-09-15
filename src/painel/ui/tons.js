/* ---------------------------------------------------------------------------
   Tipo de transação para tom semântico.

   `TIPOS_TX`, no store, carrega uma cor fixa por tipo. Aquela cor é dado de
   negócio antigo e não se mexe nela; o que muda aqui é que a INTERFACE deixa de
   consumi-la. Cor cravada não acompanha a troca de tema, e um roxo de 2024 no
   meio de um painel verde não diz mais nada a ninguém.

   Os quatro tons são os mesmos do resto do painel: deu certo, precisa de
   atenção, deu errado, está esperando. Um tipo que não estiver no mapa cai em
   "esperando", que é o mais neutro dos quatro.
--------------------------------------------------------------------------- */

const TOM_POR_TIPO = {
  'VALIDAÇÃO': 'ok',
  'LIBERAÇÃO': 'ok',
  'ANCORAGEM': 'ok',
  'CONSENTIMENTO': 'ok',
  'CIRCULARIDADE': 'ok',
  'RESERVA': 'warn',
  'ASSINATURA': 'warn',
  'PROPOSTA': 'warn',
  'CONTESTACAO': 'crit',
};

export const tomDaTransacao = tipo => TOM_POR_TIPO[tipo] || 'wait';
