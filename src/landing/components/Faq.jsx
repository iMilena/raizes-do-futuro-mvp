import { useState } from 'react';
import { Revelar } from './Revelar';
import { Eyebrow, Titulo } from './Pecas';
import { faq } from '../data/content';

/**
 * As oito perguntas em acordeão. A primeira nasce aberta. Cada botão diz se
 * está expandido (`aria-expanded`) e aponta para a resposta que controla.
 */
export function Faq() {
  const [abertas, setAbertas] = useState(() => new Set([0]));

  const trocar = (i) =>
    setAbertas((a) => {
      const n = new Set(a);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  return (
    <section className="sec" id="faq">
      <div className="wrap faq">
        <div>
          <Revelar>
            <Eyebrow>{faq.eyebrow}</Eyebrow>
          </Revelar>
          <Revelar atraso={100}>
            <Titulo partes={faq.titulo} />
          </Revelar>
        </div>
        <div>
          {faq.itens.map((item, i) => {
            const aberta = abertas.has(i);
            return (
              <Revelar key={item.q} className={`qa${aberta ? ' open' : ''}`}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={aberta}
                    aria-controls={`lp-faq-${i}`}
                    id={`lp-faq-b-${i}`}
                    onClick={() => trocar(i)}
                  >
                    <span>{item.q}</span>
                    <i aria-hidden="true" />
                  </button>
                </h3>
                <div className="a" id={`lp-faq-${i}`} role="region" aria-labelledby={`lp-faq-b-${i}`}>
                  <div>
                    <p>{item.a}</p>
                  </div>
                </div>
              </Revelar>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default Faq;
