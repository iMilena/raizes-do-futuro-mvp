import { useMemo, useRef } from 'react';
import { Revelar } from './Revelar';
import { Eyebrow, Titulo } from './Pecas';
import { impacto, coorte } from '../data/content';
import { useVisivel } from '../hooks/useVisivel';
import { useContagem } from '../hooks/useContagem';

/** Um número que sobe do zero ao valor quando entra na tela. */
function Numero({ valor, unidade, sufixo = '', rotulo, atraso }) {
  const ref = useRef(null);
  const visivel = useVisivel(ref);
  const n = useContagem(valor, visivel);
  return (
    <div ref={ref} className={`imp rf-rv${visivel ? ' is-in' : ''}`} style={{ '--rf-d': `${atraso}ms` }}>
      {/* O leitor de tela ouve o valor final, e não a contagem subindo. */}
      <b aria-hidden="true">
        {n}
        {sufixo}
        {unidade && <small>{unidade}</small>}
      </b>
      <span className="sr-only">
        {valor}
        {sufixo}
        {unidade ? ` ${unidade}` : ''}
      </span>
      <span>{rotulo}</span>
    </div>
  );
}

/**
 * Quais crianças aparecem "em acompanhamento".
 *
 * Um embaralhamento com semente fixa, e não `Math.random()`: os pontos apagados
 * se espalham pela grade como no protótipo, mas no mesmo lugar em toda visita,
 * o que evita a grade "piscar" diferente a cada render e deixa a captura de
 * tela comparável entre versões.
 */
function acesos(total, emDia) {
  let semente = 7;
  const aleatorio = () => {
    semente = (semente * 16807) % 2147483647;
    return semente / 2147483647;
  };
  const ordem = [...Array(total).keys()];
  for (let i = ordem.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
  }
  return new Set(ordem.slice(0, emDia));
}

function Criancas() {
  const ref = useRef(null);
  const visivel = useVisivel(ref);
  const on = useMemo(() => acesos(coorte.total, coorte.emDia), []);
  return (
    <div
      ref={ref}
      className={`kids${visivel ? ' in' : ''}`}
      role="img"
      aria-label={coorte.rotuloGrade}
    >
      {[...Array(coorte.total).keys()].map((i) => (
        <i key={i} className={on.has(i) ? 'on' : undefined} style={{ transitionDelay: `${i * 12}ms` }} />
      ))}
    </div>
  );
}

export function Impacto() {
  return (
    <section className="sec impact" id="impacto">
      <div className="wrap">
        <Revelar>
          <Eyebrow>{impacto.eyebrow}</Eyebrow>
        </Revelar>
        <Revelar atraso={100}>
          <Titulo partes={impacto.titulo} />
        </Revelar>
        <Revelar como="p" className="lead" atraso={200}>
          {impacto.lede}
        </Revelar>
        <div className="imp-grid">
          {impacto.numeros.map((n, i) => (
            <Numero key={n.rotulo} {...n} atraso={i * 100} />
          ))}
        </div>
        <div className="kids-wrap" id="infancia">
          <Criancas />
          <Revelar className="kids-txt">
            <Eyebrow>{coorte.eyebrow}</Eyebrow>
            <h3>{coorte.titulo}</h3>
            <p>{coorte.texto}</p>
            <div className="leg">
              <span>{coorte.legendaEmDia}</span>
              <span>{coorte.legendaEmCurso}</span>
            </div>
            <a className="btn btn-g" href={coorte.botaoApp.href} style={{ marginTop: 26 }}>
              {coorte.botaoApp.rotulo}
            </a>
          </Revelar>
        </div>
      </div>
    </section>
  );
}

export default Impacto;
