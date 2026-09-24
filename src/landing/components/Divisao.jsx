import { useRef } from 'react';
import { Revelar } from './Revelar';
import { Eyebrow, Titulo } from './Pecas';
import { Cofre } from './Cofre';
import { Simulador } from './Simulador';
import { divisao } from '../data/content';
import { useVisivel } from '../hooks/useVisivel';

/**
 * "Dividido por código": os blocos 60/25/15 crescem na proporção real quando
 * entram na tela (no celular viram três linhas), e logo abaixo o cofre e o
 * simulador deixam o leitor mexer nas regras.
 */
export function Divisao() {
  const ref = useRef(null);
  const visivel = useVisivel(ref);

  return (
    <section className="sec split-sec">
      <div className="wrap">
        <Revelar>
          <Eyebrow>{divisao.eyebrow}</Eyebrow>
        </Revelar>
        <Revelar atraso={100}>
          <Titulo partes={divisao.titulo} />
        </Revelar>
        <Revelar como="p" className="lead" atraso={200}>
          {divisao.lede}
        </Revelar>
        <div ref={ref} className={`split-big${visivel ? ' in' : ''}`}>
          {divisao.fatias.map((f) => (
            <div key={f.chave} className={f.chave}>
              <b>{f.pct}%</b>
              <span>{f.titulo}</span>
            </div>
          ))}
        </div>
        <div className="split-txt">
          {divisao.fatias.map((f) => (
            <p key={f.chave}>{f.texto}</p>
          ))}
        </div>

        <div className="play">
          <Cofre />
          <Simulador />
        </div>
      </div>
    </section>
  );
}

export default Divisao;
