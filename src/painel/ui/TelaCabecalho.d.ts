/* ---------------------------------------------------------------------------
   Tipos do cabeçalho de tela.

   O painel é JSX puro e continua sendo; só o módulo de Validação de Coleta é
   TypeScript. Como a tela de Conferência mora nesse módulo e usa este
   cabeçalho, ela é o único ponto de contato entre os dois mundos, e é aqui que
   o contrato fica escrito. Sem este arquivo, `npm run checar-tipos` para com
   "implicitly has an 'any' type" num import que está correto.
--------------------------------------------------------------------------- */
import type { ReactNode } from 'react';

export declare function TelaCabecalho(props: {
  /** O rótulo "Área · Tela" acima do título (ex.: "Operação · Coleta"). */
  area: string;
  titulo: string;
  /** A frase de propósito, logo abaixo do título. */
  children?: ReactNode;
}): JSX.Element;

/** Uma das pontas do rodapé. `null` quando a tela é a primeira ou a última. */
export interface PontaDeEtapa {
  id: string;
  titulo: string;
}

export declare function NavEtapa(props: {
  anterior: PontaDeEtapa | null;
  proxima: PontaDeEtapa | null;
  aoIr: (id: string) => void;
}): JSX.Element;
