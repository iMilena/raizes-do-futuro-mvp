/* ---------------------------------------------------------------------------
   O lote de exemplo da página de investidores.

   É o mesmo dia de coleta que o painel de Conferência usa como demonstração
   (dados-de-demonstracao.ts): sete coletas, com as sinalizações produzidas
   pelos detectores de verdade. Aqui ele vira o que vai para a cadeia: uma raiz
   de Merkle e números somados.

   A raiz abaixo está escrita à mão de propósito. A página a mostra como
   "publicada" e o botão "Verificar" recalcula a árvore inteira no navegador de
   quem lê, com o mesmo código que roda no app de campo. Se alguém mexer no
   roteiro, no esquema ou no hash sem atualizar a raiz, a verificação falha na
   tela e o teste `investidores.test.ts` falha antes disso.

   É um exemplo, e a página diz isso: a coleta real ainda não começou.
--------------------------------------------------------------------------- */
import { montarLote, provaDeColeta, verificarProvaDeColeta } from '../validacao/ancoragem/lote-diario.js';
import type { LoteDiario, ProvaDeColeta } from '../validacao/ancoragem/lote-diario.js';
import { registrosDoExemplo } from '../validacao/revisao/dados-de-demonstracao.js';

export const DIA_EXEMPLO = '2026-09-14';

/** A raiz publicada do lote de exemplo. Conferida por `investidores.test.ts`. */
export const RAIZ_PUBLICADA = '0x04b31a2b32dd2110fc0ce9638089bd22616e9b7c22d56ef7313cc482189e9703';

export function montarLoteExemplo(): LoteDiario {
  return montarLote(DIA_EXEMPLO, registrosDoExemplo(DIA_EXEMPLO));
}

export interface ResultadoVerificacao {
  lote: LoteDiario;
  /** A raiz recalculada bate com a publicada? */
  raizConfere: boolean;
  /** Prova de inclusão da primeira coleta, e se ela fecha contra a raiz publicada. */
  prova: ProvaDeColeta | null;
  provaConfere: boolean;
}

/** Recalcula tudo do zero, como faria um auditor. */
export function verificarLoteExemplo(): ResultadoVerificacao {
  const lote = montarLoteExemplo();
  const primeira = lote.registros[0];
  const prova = primeira ? provaDeColeta(lote, primeira.hashConteudo) : null;
  return {
    lote,
    raizConfere: lote.arvore.raiz.toLowerCase() === RAIZ_PUBLICADA.toLowerCase(),
    prova,
    provaConfere: prova !== null && verificarProvaDeColeta(prova, RAIZ_PUBLICADA),
  };
}
