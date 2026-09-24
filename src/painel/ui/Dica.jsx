import { useEffect, useRef } from 'react';

/* ---------------------------------------------------------------------------
   A dica flutuante do painel: qualquer elemento com `data-tip` (HTML simples,
   escrito pelo próprio painel) mostra a dica ao passar o mouse ou ao receber
   foco. No diagrama de fluxo, a faixa sob o cursor fica acesa e as outras
   esmaecem.

   Uma camada só para o painel inteiro, montada no shell, em vez de um
   componente de dica por elemento: são dezenas de faixas e barras, e cada uma
   com o próprio estado seria render à toa a cada movimento do mouse.
--------------------------------------------------------------------------- */
export function CamadaDeDicas() {
  const ref = useRef(null);

  useEffect(() => {
    const tip = ref.current;
    let atual = null;

    const mostrar = (alvo) => {
      atual = alvo;
      tip.innerHTML = alvo.dataset.tip;
      tip.classList.add('on');
      if (alvo.classList.contains('band')) {
        document.querySelectorAll('.pn-flow .band').forEach((b) => b.classList.toggle('esmaecida', b !== alvo));
      }
    };
    const esconder = () => {
      if (!atual) return;
      tip.classList.remove('on');
      document.querySelectorAll('.pn-flow .band').forEach((b) => b.classList.remove('esmaecida'));
      atual = null;
    };
    const posicionar = (x, y) => {
      const nx = Math.min(x + 14, innerWidth - tip.offsetWidth - 10);
      const ny = Math.min(y + 14, innerHeight - tip.offsetHeight - 10);
      tip.style.left = nx + 'px';
      tip.style.top = ny + 'px';
    };

    const aoEntrar = (e) => {
      const t = e.target.closest?.('.painel-raizes [data-tip]');
      if (t && t !== atual) mostrar(t);
    };
    const aoMover = (e) => {
      if (atual) posicionar(e.clientX, e.clientY);
    };
    const aoSair = (e) => {
      const t = e.target.closest?.('[data-tip]');
      if (t && t === atual && !t.contains(e.relatedTarget)) esconder();
    };
    /* Pelo teclado: a dica aparece ao lado do elemento focado. */
    const aoFocar = (e) => {
      const t = e.target.closest?.('.painel-raizes [data-tip]');
      if (!t) return;
      mostrar(t);
      const r = t.getBoundingClientRect();
      posicionar(r.left, r.bottom);
    };

    document.addEventListener('pointerover', aoEntrar);
    document.addEventListener('pointermove', aoMover);
    document.addEventListener('pointerout', aoSair);
    document.addEventListener('focusin', aoFocar);
    document.addEventListener('focusout', esconder);
    return () => {
      document.removeEventListener('pointerover', aoEntrar);
      document.removeEventListener('pointermove', aoMover);
      document.removeEventListener('pointerout', aoSair);
      document.removeEventListener('focusin', aoFocar);
      document.removeEventListener('focusout', esconder);
    };
  }, []);

  return <div className="pn-tip" ref={ref} role="tooltip" />;
}

export default CamadaDeDicas;
