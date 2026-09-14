import { useRef } from 'react';
import { Revelar } from './Revelar';
import { impacto, numeros, coorte } from '../data/content';
import { useVisivel } from '../hooks/useVisivel';
import { useContagem } from '../hooks/useContagem';

function Numero({ valor, sufixo, rotulo, atraso, contar }) {
  const atual = useContagem(valor, contar);
  return (
    <div className="rf-num" style={{ '--rf-d': `${atraso}ms` }}>
      <b>
        {atual}
        {sufixo && <small>{sufixo}</small>}
      </b>
      <span>{rotulo}</span>
    </div>
  );
}

/**
 * A coorte: uma bolinha por criança, 60 delas, 51 preenchidas.
 *
 * O gráfico é o argumento inteiro em uma linha — dá para contar as nove que
 * ainda faltam. Como cada ponto é um dado e não um enfeite, o conjunto vai
 * marcado com `role="img"` e um rótulo que diz a mesma coisa em texto, senão
 * quem usa leitor de tela ouviria sessenta elementos vazios.
 */
function Coorte() {
  const ref = useRef(null);
  const visivel = useVisivel(ref, { limiar: 0.25 });
  const pontos = Array.from({ length: coorte.total }, (_, i) => i < coorte.emDia);

  return (
    <Revelar className={`rf-coorte${visivel ? ' is-in' : ''}`} atraso={200}>
      <div ref={ref}>
        <div className="rf-coorte-topo">
          <span className="rf-mono rf-coorte-k">{coorte.titulo}</span>
          <span className="rf-legenda">
            <span>
              <em className="is-ok" aria-hidden="true" /> {coorte.legendaEmDia}
            </span>
            <span>
              <em aria-hidden="true" /> {coorte.legendaEmCurso}
            </span>
          </span>
        </div>

        <div
          className="rf-pontos"
          role="img"
          aria-label={`${coorte.emDia} de ${coorte.total} crianças com ${coorte.legendaEmDia}.`}
        >
          {pontos.map((emDia, i) => (
            <i
              key={i}
              className={emDia ? 'is-ok' : undefined}
              style={{ '--rf-d': `${i * 22}ms` }}
            />
          ))}
        </div>

        <p className="rf-coorte-nota">{coorte.nota}</p>
      </div>
    </Revelar>
  );
}

export function Impacto() {
  const ref = useRef(null);
  const visivel = useVisivel(ref, { limiar: 0.32 });

  return (
    <section
      className="rf-ato rf-noite"
      id="impacto"
      style={{ '--rf-de': '#08201A', '--rf-ate': '#0A2720' }}
    >
      <div className="rf-wrap">
        <Revelar como="span" className="rf-eyebrow">
          {impacto.eyebrow}
        </Revelar>
        <Revelar como="h2" className="rf-h-sec" atraso={80} style={{ maxWidth: '17ch' }}>
          {impacto.titulo}
        </Revelar>
        <Revelar como="p" className="rf-lede" atraso={140}>
          {impacto.lede}
        </Revelar>

        <div className={`rf-numeros${visivel ? ' is-in' : ''}`} ref={ref}>
          {numeros.map((n, i) => (
            <Numero key={n.rotulo} {...n} atraso={i * 140} contar={visivel} />
          ))}
        </div>

        <Coorte />
      </div>
    </section>
  );
}

export default Impacto;
