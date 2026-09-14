import { useEffect, useId, useRef, useState } from 'react';
import { Revelar } from './Revelar';
import { faq } from '../data/content';

/**
 * Uma pergunta e a resposta que abre.
 *
 * A altura é medida por `ResizeObserver` em vez de lida uma vez: o texto
 * reflui quando a janela muda de largura, e uma altura congelada cortaria a
 * resposta pela metade em telas estreitas. `height: auto` não anima, daí a
 * medida em pixels.
 */
function Pergunta({ item, aberta, aoAlternar }) {
  const refConteudo = useRef(null);
  const [altura, setAltura] = useState(0);
  const idResposta = useId();

  useEffect(() => {
    const alvo = refConteudo.current;
    if (!alvo) return undefined;

    const medir = () => setAltura(alvo.offsetHeight);
    medir();

    if (!('ResizeObserver' in window)) return undefined;
    const observador = new ResizeObserver(medir);
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  return (
    <div className={`rf-qa${aberta ? ' is-aberta' : ''}`}>
      <h3>
        <button
          type="button"
          className="rf-q"
          aria-expanded={aberta}
          aria-controls={idResposta}
          onClick={aoAlternar}
        >
          {item.q}
          <span className="rf-q-sinal" aria-hidden="true" />
        </button>
      </h3>

      <div className="rf-ans" id={idResposta} style={{ height: aberta ? altura : 0 }}>
        <div ref={refConteudo}>{item.a}</div>
      </div>
    </div>
  );
}

/** Uma aberta por vez: com oito respostas longas, duas abertas viram rolagem. */
export function Faq() {
  const [abertaEm, setAbertaEm] = useState(0);

  return (
    <section
      className="rf-ato rf-dia"
      id="faq"
      style={{ '--rf-de': '#E3D9C2', '--rf-ate': '#F3F0E6' }}
    >
      <div className="rf-wrap rf-wrap-estreito">
        <Revelar como="span" className="rf-eyebrow">
          {faq.eyebrow}
        </Revelar>
        <Revelar como="h2" className="rf-h-sec" atraso={80} style={{ maxWidth: '15ch' }}>
          {faq.titulo}
        </Revelar>

        <div className="rf-faq">
          {faq.itens.map((item, i) => (
            <Pergunta
              key={item.q}
              item={item}
              aberta={abertaEm === i}
              aoAlternar={() => setAbertaEm((atual) => (atual === i ? -1 : i))}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Faq;
