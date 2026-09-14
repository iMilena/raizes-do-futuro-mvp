import { useEffect, useRef } from 'react';

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * O comportamento que um diálogo modal precisa ter e que o CSS não dá.
 *
 * Enquanto aberto: Esc fecha, a página atrás não rola, o foco vai para dentro e
 * fica preso ali no Tab, e ao fechar volta exatamente para o botão que abriu.
 * Sem o laço de foco, `aria-modal="true"` seria só uma etiqueta: quem navega
 * por teclado sairia do diálogo na primeira tabulação e continuaria numa página
 * que não consegue nem ver.
 *
 * Devolve a ref que deve ir no elemento do diálogo.
 */
export function useDialogo(aberto, aoFechar) {
  const refDialogo = useRef(null);
  const refFocoAnterior = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;

    refFocoAnterior.current = document.activeElement;
    document.body.classList.add('rf-travado');

    const focaveis = () =>
      Array.from(refDialogo.current?.querySelectorAll(FOCAVEIS) ?? []).filter(
        (el) => el.offsetParent !== null
      );

    /* O primeiro campo só recebe foco em tela grande. No celular, focar um
       input abre o teclado por cima do diálogo antes de a pessoa ler o que ele
       diz. */
    const inicial = window.innerWidth > 900 ? focaveis()[1] : refDialogo.current;
    inicial?.focus?.({ preventScroll: true });

    const aoTeclar = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        aoFechar();
        return;
      }
      if (e.key !== 'Tab') return;

      const lista = focaveis();
      if (lista.length === 0) return;

      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      const atual = document.activeElement;

      if (e.shiftKey && (atual === primeiro || !refDialogo.current.contains(atual))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && atual === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.classList.remove('rf-travado');
      refFocoAnterior.current?.focus?.({ preventScroll: true });
    };
  }, [aberto, aoFechar]);

  return refDialogo;
}
