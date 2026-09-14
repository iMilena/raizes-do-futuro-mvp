import { useCallback, useEffect, useRef, useState } from 'react';

const DURACAO = 4200;

/**
 * Um aviso curto que aparece e some sozinho.
 *
 * O timer vive numa ref e é sempre limpo antes de um novo aviso, senão dois
 * cliques seguidos deixariam o primeiro relógio apagando o segundo texto no
 * meio da leitura. Também é limpo ao desmontar.
 */
export function useAviso() {
  const [aviso, setAviso] = useState('');
  const refTimer = useRef(null);

  const avisar = useCallback((texto) => {
    clearTimeout(refTimer.current);
    setAviso(texto);
    refTimer.current = setTimeout(() => setAviso(''), DURACAO);
  }, []);

  useEffect(() => () => clearTimeout(refTimer.current), []);

  return [aviso, avisar];
}
