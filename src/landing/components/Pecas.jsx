/* ---------------------------------------------------------------------------
   Peças pequenas que se repetem pela landing inteira.
--------------------------------------------------------------------------- */

/** A seta dos botões: um traço e uma ponta, que anda 3 px no hover. */
export function Seta({ tamanho }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      width={tamanho}
      height={tamanho}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/**
 * Título de seção com o fim em itálico menta.
 *
 * O texto vem do content.js como `[antes, destaque]`, para a quebra entre a
 * parte reta e a itálica ficar no dado, e não espalhada pelo JSX.
 */
export function Titulo({ partes, como: Tag = 'h2', className = 'h', ...resto }) {
  const [antes, destaque] = partes;
  return (
    <Tag className={className} {...resto}>
      {antes}
      {destaque && <em>{destaque}</em>}
    </Tag>
  );
}

/** O rótulo mono com o traço à esquerda que abre cada seção. */
export function Eyebrow({ children, className = '', ...resto }) {
  return (
    <div className={`eyebrow${className ? ` ${className}` : ''}`} {...resto}>
      {children}
    </div>
  );
}
