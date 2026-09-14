import { useRef } from 'react';
import { Revelar } from './Revelar';
import { tese } from '../data/content';
import { useVisivel } from '../hooks/useVisivel';

/**
 * A tese, revelada linha a linha.
 *
 * Cada linha sobe por trás da própria máscara, com 70 ms de diferença entre
 * elas — o suficiente para o olho seguir a frase na ordem em que ela foi
 * escrita, em vez de encarar o bloco inteiro de uma vez. A quebra é manual
 * (`tese.linhas`), porque a máscara precisa saber onde a linha termina.
 */
export function Tese() {
  const ref = useRef(null);
  const visivel = useVisivel(ref, { limiar: 0.3, margem: '0px' });

  return (
    <section
      className={`rf-ato rf-noite rf-tese${visivel ? ' is-in' : ''}`}
      ref={ref}
      style={{ '--rf-de': '#061713', '--rf-ate': '#08201A' }}
    >
      <div className="rf-wrap rf-tese-grade">
        <div>
          <Revelar como="span" className="rf-eyebrow">
            {tese.eyebrow}
          </Revelar>

          <p className="rf-tese-texto">
            {tese.linhas.map((linha, i) => {
              const chave = typeof linha === 'string' ? linha : linha.destaque;
              return (
                <span className="rf-linha" key={chave}>
                  <i style={{ '--rf-d': `${i * 70}ms` }}>
                    {typeof linha === 'string' ? (
                      linha
                    ) : (
                      <>
                        {linha.antes}
                        <mark>{linha.destaque}</mark>
                        {linha.depois}
                      </>
                    )}
                  </i>
                </span>
              );
            })}
          </p>
        </div>

        <Revelar className="rf-tese-lateral" atraso={420}>
          {tese.lateral}
        </Revelar>
      </div>
    </section>
  );
}

export default Tese;
