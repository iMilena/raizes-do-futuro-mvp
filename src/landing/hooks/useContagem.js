import { useEffect, useState } from 'react';
import { usePrefereMenosMovimento } from './usePrefereMenosMovimento';

const DURACAO = 1500;

/**
 * Conta de zero até `alvo` quando `ligado` vira verdadeiro.
 *
 * A curva é um ease-out cúbico: começa rápido e assenta no número, que é como
 * a leitura acontece — o olho pega a ordem de grandeza logo e confere o valor
 * exato no fim. Com `prefers-reduced-motion`, devolve o alvo direto.
 */
export function useContagem(alvo, ligado) {
  const reduzir = usePrefereMenosMovimento();
  const [valor, setValor] = useState(0);

  useEffect(() => {
    if (!ligado) return undefined;
    if (reduzir) {
      setValor(alvo);
      return undefined;
    }

    let quadro = 0;
    let inicio = null;

    const passo = (agora) => {
      if (inicio === null) inicio = agora;
      const p = Math.min((agora - inicio) / DURACAO, 1);
      const suave = 1 - Math.pow(1 - p, 3);
      setValor(Math.round(alvo * suave));
      if (p < 1) quadro = requestAnimationFrame(passo);
    };

    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [alvo, ligado, reduzir]);

  return valor;
}
