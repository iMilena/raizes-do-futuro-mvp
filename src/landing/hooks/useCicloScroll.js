import { useEffect, useRef, useState } from 'react';

/**
 * Traduz a rolagem sobre o palco do ciclo em "que etapa, e quanto dela".
 *
 * Devolve `indice` como estado do React, porque é o que troca o texto ao lado
 * do anel e isso acontece sete vezes na seção inteira. Já a fração dentro da
 * etapa (`local`) muda a cada quadro, e virar estado seria pedir um render por
 * quadro para mexer em dois atributos de SVG: ela vai por `aoDesenhar`, um
 * callback que recebe `(indice, local)` e escreve direto no DOM.
 *
 * O callback é guardado em ref para o efeito não reassinar o scroll toda vez
 * que o componente renderiza.
 */
export function useCicloScroll(refPalco, total, aoDesenhar) {
  const [indice, setIndice] = useState(0);
  const refDesenho = useRef(aoDesenhar);
  refDesenho.current = aoDesenhar;

  useEffect(() => {
    let agendado = false;

    const medir = () => {
      agendado = false;
      const palco = refPalco.current;
      if (!palco) return;

      const percorrivel = palco.offsetHeight - window.innerHeight;
      if (percorrivel <= 0) return;

      const p = Math.min(Math.max(-palco.getBoundingClientRect().top / percorrivel, 0), 1);
      const i = Math.min(Math.floor(p * total), total - 1);
      const local = Math.min(Math.max(p * total - i, 0), 1);

      refDesenho.current?.(i, local);
      setIndice((atual) => (atual === i ? atual : i));
    };

    const aoRolar = () => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(medir);
    };

    medir();
    window.addEventListener('scroll', aoRolar, { passive: true });
    window.addEventListener('resize', aoRolar, { passive: true });
    return () => {
      window.removeEventListener('scroll', aoRolar);
      window.removeEventListener('resize', aoRolar);
    };
  }, [refPalco, total]);

  return indice;
}
