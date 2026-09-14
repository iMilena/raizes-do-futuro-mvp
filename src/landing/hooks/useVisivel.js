import { useEffect, useState } from 'react';
import { usePrefereMenosMovimento } from './usePrefereMenosMovimento';

/** Depois disto, o conteúdo aparece de qualquer jeito. Ver abaixo. */
const REDE_DE_SEGURANCA = 2500;

/**
 * Avisa quando o elemento entrou na tela — uma vez só, e para sempre.
 *
 * Vem com uma rede de segurança deliberada: passados 2,5 s, o conteúdo é
 * marcado como visível aconteça o que acontecer. A revelação começa com
 * `opacity: 0`, então qualquer falha do IntersectionObserver (navegador sem
 * suporte, elemento que nunca cruza o limiar, aba restaurada já rolada) deixaria
 * a página em branco. Animação que não roda é um detalhe; texto que não aparece
 * é a página inteira perdida.
 *
 * Com `prefers-reduced-motion`, nasce visível e nem observa.
 */
export function useVisivel(ref, { limiar = 0.08, margem = '0px 0px -12% 0px' } = {}) {
  const reduzir = usePrefereMenosMovimento();
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (reduzir || !('IntersectionObserver' in window)) {
      setVisivel(true);
      return undefined;
    }

    const alvo = ref.current;
    if (!alvo) {
      setVisivel(true);
      return undefined;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            setVisivel(true);
            observador.disconnect();
          }
        }
      },
      { threshold: limiar, rootMargin: margem }
    );
    observador.observe(alvo);

    const rede = setTimeout(() => setVisivel(true), REDE_DE_SEGURANCA);

    return () => {
      observador.disconnect();
      clearTimeout(rede);
    };
  }, [ref, limiar, margem, reduzir]);

  return visivel;
}
