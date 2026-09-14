import { useEffect, useState } from 'react';

const CONSULTA = '(prefers-reduced-motion: reduce)';

/**
 * `true` quando o sistema pede menos movimento.
 *
 * O CSS já desliga transição e animação por conta própria; este hook existe
 * para o que o CSS não alcança — contadores, o pacote que percorre o anel, o
 * parallax — que precisam nascer no estado final em vez de nunca chegar nele.
 * A preferência é observada, e não lida uma vez: quem muda a configuração do
 * sistema com a página aberta vê o efeito na hora.
 */
export function usePrefereMenosMovimento() {
  const [reduzir, setReduzir] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(CONSULTA).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(CONSULTA);
    const aoMudar = (e) => setReduzir(e.matches);
    mq.addEventListener('change', aoMudar);
    return () => mq.removeEventListener('change', aoMudar);
  }, []);

  return reduzir;
}
