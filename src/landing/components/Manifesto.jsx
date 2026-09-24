import { useEffect, useMemo, useRef } from 'react';
import { Revelar } from './Revelar';
import { Eyebrow, Seta } from './Pecas';
import { manifesto } from '../data/content';
import { usePrefereMenosMovimento } from '../hooks/usePrefereMenosMovimento';

const palavras = (texto) => texto.split(/\s+/).filter(Boolean);

/**
 * "O projeto": a frase grande em que as palavras acendem uma a uma conforme a
 * rolagem.
 *
 * As palavras acendem por classe, direto no DOM, e não por estado do React: a
 * conta roda a cada quadro de rolagem, e re-renderizar a frase inteira sessenta
 * vezes por segundo para trocar uma classe seria desperdício. Com menos
 * movimento, a frase nasce inteira acesa.
 */
export function Manifesto() {
  const ref = useRef(null);
  const reduzir = usePrefereMenosMovimento();

  const [antes, meio, depois] = useMemo(
    () => [palavras(manifesto.antes), palavras(manifesto.destaque), palavras(manifesto.depois)],
    []
  );

  useEffect(() => {
    const frase = ref.current;
    if (!frase) return undefined;
    const ws = [...frase.querySelectorAll('.w')];
    if (reduzir) {
      ws.forEach((w) => w.classList.add('on'));
      return undefined;
    }
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      const r = frase.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
      const n = Math.round(p * ws.length);
      ws.forEach((w, i) => w.classList.toggle('on', i < n));
    };
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener('scroll', aoRolar, { passive: true });
    window.addEventListener('resize', aoRolar);
    return () => {
      window.removeEventListener('scroll', aoRolar);
      window.removeEventListener('resize', aoRolar);
      cancelAnimationFrame(quadro);
    };
  }, [reduzir]);

  /* O destaque é um só trecho em itálico: as palavras dele ficam dentro de um
     mesmo <span class="k">, para o leitor de tela ler a frase corrida. */
  const span = (w, i) => (
    <span key={i}>
      <span className="w">{w}</span>{' '}
    </span>
  );

  return (
    <section className="manifesto" id="projeto">
      <div className="wrap">
        <Revelar>
          <Eyebrow>{manifesto.eyebrow}</Eyebrow>
        </Revelar>
        <p className="big" ref={ref}>
          {antes.map(span)}
          <span className="k">{meio.map(span)}</span>
          {depois.map(span)}
        </p>
        <div className="aside">
          <Revelar como="p">{manifesto.lateral}</Revelar>
          <Revelar atraso={100}>
            <a className="btn btn-g" href="#como">
              {manifesto.botao}
              <Seta />
            </a>
          </Revelar>
        </div>
      </div>
    </section>
  );
}

export default Manifesto;
