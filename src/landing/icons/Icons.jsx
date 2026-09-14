/* ---------------------------------------------------------------------------
   Os ícones da landing.

   Todos desenhados no mesmo sistema: caixa 24×24, traço de 1.7 a 2.2, pontas e
   junções arredondadas, `currentColor`. São poucos e específicos demais para
   valer uma biblioteca inteira no bundle — os quatro dos pilares, em especial,
   têm a raiz e a onda do próprio projeto, que nenhum conjunto genérico traz.
--------------------------------------------------------------------------- */

const traco = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function SetaDireita(props) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="2.2" {...traco} aria-hidden="true" {...props}>
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

export function SetaEsquerda(props) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="2.2" {...traco} aria-hidden="true" {...props}>
      <path d="M19 12H6M11 18l-6-6 6-6" />
    </svg>
  );
}

export function Chevron(props) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="2" {...traco} aria-hidden="true" {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function Fechar(props) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="2" {...traco} aria-hidden="true" {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** A chave dos signatários: gira um quarto de volta quando a assinatura entra. */
export function Chave(props) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="2" {...traco} aria-hidden="true" {...props}>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v4" />
    </svg>
  );
}

/** Escudo com a raiz dentro: infâncias protegidas. */
export function IconeEscudo(props) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.7" {...traco} aria-hidden="true" {...props}>
      <path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6Z" />
      <path d="M12 15v-4" />
      <path d="M12 11c-2 0-3-1.2-3-3 2 0 3 1 3 3Z" />
    </svg>
  );
}

/** Duas figuras, uma maior e uma menor: famílias fortes. */
export function IconeFamilia(props) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.7" {...traco} aria-hidden="true" {...props}>
      <path d="M3 20c1.5-4 4-6 6-6s4.5 2 6 6" />
      <circle cx="9" cy="8" r="3.2" />
      <path d="M15.5 20c1-2.6 2.4-4.2 3.6-4.6" />
      <circle cx="17" cy="9.5" r="2.4" />
    </svg>
  );
}

/** Raiz sobre a maré: territórios saudáveis. */
export function IconeTerritorio(props) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.7" {...traco} aria-hidden="true" {...props}>
      <path d="M3 17c3-2 6-2 9 0s6 2 9 0" />
      <path d="M3 21c3-2 6-2 9 0s6 2 9 0" />
      <path d="M12 13V5" />
      <path d="M12 8c-3 0-5-2-5-5 3 0 5 2 5 5Z" />
      <path d="M12 10c3 0 5-2 5-5-3 0-5 2-5 5Z" />
    </svg>
  );
}

/** Escudo com a marca de conferido: confiança digital. */
export function IconeConfianca(props) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.7" {...traco} aria-hidden="true" {...props}>
      <path d="M12 2.6 20 7v6.2c0 4.4-3.3 7.4-8 8.2-4.7-.8-8-3.8-8-8.2V7Z" />
      <path d="m8.8 12.2 2.2 2.2 4.2-4.6" />
    </svg>
  );
}

/** Cada pilar diz o nome do próprio ícone; aqui ele vira componente. */
export const ICONES_PILAR = {
  escudo: IconeEscudo,
  familia: IconeFamilia,
  territorio: IconeTerritorio,
  confianca: IconeConfianca,
};
