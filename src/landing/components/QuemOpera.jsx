import { useRef } from 'react';
import { Foto } from './Foto';
import { Revelar } from './Revelar';
import { Eyebrow, Titulo } from './Pecas';
import { pilaresComunidade } from '../images';
import { parceiros } from '../data/content';
import { useVisivel } from '../hooks/useVisivel';

/**
 * "Quem opera o ciclo": a foto do encontro comunitário fica presa (sticky) ao
 * lado dos três cartões de assinatura enquanto eles passam.
 */
export function QuemOpera() {
  const ref = useRef(null);
  const visivel = useVisivel(ref);

  return (
    <section className="sec" id="parceiros">
      <div className="wrap ops">
        <figure ref={ref} className={`photo${visivel ? ' in' : ''}`}>
          <Foto imagem={pilaresComunidade} sizes="(max-width: 900px) 100vw, 560px" />
          <figcaption>{parceiros.legendaFoto}</figcaption>
        </figure>
        <div>
          <Revelar>
            <Eyebrow>{parceiros.eyebrow}</Eyebrow>
          </Revelar>
          <Revelar atraso={100}>
            <Titulo partes={parceiros.titulo} />
          </Revelar>
          <Revelar como="p" className="lead" atraso={200}>
            {parceiros.lede}
          </Revelar>
          <div className="signers">
            {parceiros.itens.map((s, i) => (
              <Revelar key={s.nome} className="signer" atraso={i * 100}>
                <div className="n" aria-hidden="true">
                  {s.n}
                </div>
                <div>
                  <small>{s.etiqueta}</small>
                  <h3>{s.nome}</h3>
                  <p>{s.texto}</p>
                </div>
              </Revelar>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default QuemOpera;
