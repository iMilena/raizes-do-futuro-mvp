import { useEffect, useState } from 'react';

/** Altura da barra fixa: o que já passou por baixo dela não conta como visível. */
const ALTURA_BARRA = 72;

/**
 * Onde a virada de tema acontece.
 *
 * Tem de ficar acima do `scroll-margin-top` das seções (76 px): quem chega ao
 * FAQ clicando no menu para exatamente em 76, e com o limite em 72 a barra
 * ficava escura sobre a areia clara justamente na seção em que mais gente para.
 * Como a barra pinta o próprio fundo quando está fixada, virar alguns pixels
 * antes não custa nada.
 */
const LIMITE_ZONA_CLARA = 96;

/**
 * O estado da barra do topo, derivado da rolagem.
 *
 * Junta quatro leituras que dependem do mesmo scroll num único ouvinte
 * estrangulado por `requestAnimationFrame` — quatro listeners separados fariam
 * quatro re-renders por quadro:
 *
 *  · `progresso`  0 a 1, quanto da página já passou (a linha fina do topo)
 *  · `fixada`     saiu do topo, então a barra ganha fundo e borda
 *  · `clara`      entrou na zona de dia, então a barra inverte o tema
 *  · `secaoAtiva` qual item do menu acender
 *
 * O estado só é atualizado quando algum valor muda de fato, para a rolagem não
 * virar uma sequência de renders idênticos.
 */
export function useCromoDoScroll({ idsSecoes, idZonaClara, idFimZonaClara }) {
  const [cromo, setCromo] = useState({
    progresso: 0,
    fixada: false,
    clara: false,
    secaoAtiva: idsSecoes[0],
  });

  useEffect(() => {
    let agendado = false;

    const medir = () => {
      agendado = false;
      const y = window.scrollY;
      const rolavel = document.documentElement.scrollHeight - window.innerHeight;

      const zonaClara = idZonaClara && document.getElementById(idZonaClara);
      const fimZonaClara = idFimZonaClara && document.getElementById(idFimZonaClara);
      const clara = Boolean(
        zonaClara &&
          zonaClara.getBoundingClientRect().top < LIMITE_ZONA_CLARA &&
          (!fimZonaClara || fimZonaClara.getBoundingClientRect().top > LIMITE_ZONA_CLARA)
      );

      /* A seção ativa é a que está mais abaixo entre as que já passaram pela
         barra — comparada pela posição na página, não pela ordem do menu.
         O menu não segue a ordem do documento (Parceiros aparece antes do
         Ciclo na página e depois dele no menu), então varrer a lista de trás
         para frente acenderia "Parceiros" enquanto o leitor está no ciclo. */
      let secaoAtiva = idsSecoes[0];
      let maisAbaixo = -Infinity;
      for (const id of idsSecoes) {
        const alvo = document.getElementById(id);
        if (!alvo) continue;
        const topo = alvo.getBoundingClientRect().top;
        if (topo <= ALTURA_BARRA + 68 && topo > maisAbaixo) {
          maisAbaixo = topo;
          secaoAtiva = id;
        }
      }

      const proximo = {
        progresso: rolavel > 0 ? Math.min(Math.max(y / rolavel, 0), 1) : 0,
        fixada: y > 40,
        clara,
        secaoAtiva,
      };

      setCromo((atual) =>
        atual.progresso === proximo.progresso &&
        atual.fixada === proximo.fixada &&
        atual.clara === proximo.clara &&
        atual.secaoAtiva === proximo.secaoAtiva
          ? atual
          : proximo
      );
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
  }, [idsSecoes, idZonaClara, idFimZonaClara]);

  return cromo;
}

/**
 * Rola até uma seção respeitando quem pediu menos movimento.
 * Fica aqui porque é o par natural de `secaoAtiva`: o menu escreve, o hook lê.
 */
export function rolarAte(id) {
  const alvo = document.getElementById(id);
  if (!alvo) return;
  const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  alvo.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
}
