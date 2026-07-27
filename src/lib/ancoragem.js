/* ---------------------------------------------------------------------------
   Ancoragem do Relatório de Circularidade na Solana devnet.

   Divisão de trabalho, por segurança:
     · aqui (navegador) calcula-se o SHA-256 real do relatório e valida-se a
       assinatura devolvida — nada que precise de chave privada;
     · quem assina é `onchain/ancorar-relatorio.mjs`, rodado por quem opera,
       com a chave na própria máquina.

   Chave privada não entra em bundle de frontend (é público) nem em função de
   servidor (é chave a mais para vazar). Por isso o fluxo tem uma etapa humana:
   o app mostra o hash, o operador roda o comando, o app recebe a assinatura.
   Menos cômodo e honesto — o registro é verificável por qualquer pessoa.
--------------------------------------------------------------------------- */

export const REDE_ANCORAGEM = 'Solana devnet';

/** SHA-256 real (Web Crypto) do conteúdo canônico do relatório, em hex. */
export async function hashRelatorio(rel) {
  const canonico = [
    'raizes-do-futuro/relatorio-circularidade/v1',
    rel.periodo,
    rel.kg,
    rel.acoes,
    rel.data,
  ].join('|');

  const bytes = new TextEncoder().encode(canonico);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Comando exato para o operador rodar — sem espaço para erro de digitação. */
export const comandoAncoragem = (hash, periodo) =>
  `node ancorar-relatorio.mjs ${hash} "${periodo}"`;

/* ------------------------------------------------ liberação no cofre real ---
   Mesma divisão de trabalho da ancoragem, e pelo mesmo motivo: o multisig do
   SPL Token exige as duas assinaturas na MESMA transação, então o que viaja
   entre as organizações é a transação parcialmente assinada — não um estado
   guardado num servidor nosso. Aqui só montamos o comando e conferimos a
   assinatura que volta.                                                     */

/** Primeira organização prepara e assina parcialmente. */
export const comandoLiberacao = (valor, propostaId, org = 'viva') =>
  `node liberar-bonus.mjs preparar --valor ${Number(valor).toFixed(2)} --org ${org} --proposta ${propostaId}`;

/** Saldo residual do ciclo → ações coletivas (regra 4 do cofre). */
export async function hashDecisaoColetiva(d) {
  const canonico = [
    'raizes-do-futuro/decisao-coletiva/v1',
    d.ciclo,
    d.acao,
    Number(d.valor).toFixed(2),
    d.comoFoiDecidido,
    d.participantes,
    d.data,
  ].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonico));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const comandoDecisao = (hash, ciclo) =>
  `node ancorar-decisao.mjs ${hash} "${ciclo}"`;

/* Assinatura de transação Solana: 64 bytes em base58, o que dá 87–88 chars. */
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{86,90}$/;
export const assinaturaValida = s => BASE58.test(String(s || '').trim());

export const urlExplorer = txId =>
  `https://explorer.solana.com/tx/${txId}?cluster=devnet`;
