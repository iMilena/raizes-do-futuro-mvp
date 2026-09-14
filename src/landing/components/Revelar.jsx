import { useRef } from 'react';
import { useVisivel } from '../hooks/useVisivel';

/**
 * Envelope da revelação no scroll: o filho sobe e aparece quando entra na tela.
 *
 * `atraso` escalona irmãos de uma mesma fileira (cartões, colunas), para eles
 * chegarem em cascata e não em bloco. Vira `--rf-d`, lido pelo CSS.
 */
export function Revelar({
  como: Tag = 'div',
  atraso = 0,
  className = '',
  style,
  children,
  ...resto
}) {
  const ref = useRef(null);
  const visivel = useVisivel(ref);

  return (
    <Tag
      ref={ref}
      className={`rf-rv${visivel ? ' is-in' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--rf-d': `${atraso}ms`, ...style }}
      {...resto}
    >
      {children}
    </Tag>
  );
}

export default Revelar;
