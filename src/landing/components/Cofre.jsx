import { useState } from 'react';
import { Revelar } from './Revelar';
import { Eyebrow } from './Pecas';
import { cofre } from '../data/content';

/** Um interruptor: botão com `aria-pressed`, que é o que ele de fato é. */
function Interruptor({ rotulo, sub, ligado, aoTrocar }) {
  return (
    <button type="button" className="tg" aria-pressed={ligado} onClick={aoTrocar}>
      <span>
        <b>{rotulo}</b>
        <small>{sub}</small>
      </span>
      <i className="sw" aria-hidden="true" />
    </button>
  );
}

const inicial = (itens, padrao) =>
  Object.fromEntries(itens.map((x) => [x.id, x.inicial ?? padrao]));

/**
 * "Experimente o cofre": três compromissos e três assinaturas.
 *
 * A regra é a do contrato, e só ela: libera R$ 30 quando os três compromissos
 * estão comprovados e há pelo menos duas assinaturas. Fora disso, o valor fica
 * reservado, nunca é perdido. O resultado é uma região `aria-live`, para quem
 * usa leitor de tela ouvir a consequência de cada interruptor.
 */
export function Cofre() {
  const [comp, setComp] = useState(() => inicial(cofre.compromissos, true));
  const [ass, setAss] = useState(() => inicial(cofre.assinaturas, true));

  const c = Object.values(comp).filter(Boolean).length;
  const s = Object.values(ass).filter(Boolean).length;
  const ok = c === cofre.compromissos.length && s >= 2;

  return (
    <Revelar className="panel">
      <Eyebrow>{cofre.eyebrow}</Eyebrow>
      <h3>{cofre.titulo}</h3>
      <p className="d">{cofre.texto}</p>

      <div className="tg-group" role="group" aria-labelledby="lp-tg-c">
        <small id="lp-tg-c">{cofre.rotuloCompromissos}</small>
        <div className="tgs">
          {cofre.compromissos.map((x) => (
            <Interruptor
              key={x.id}
              {...x}
              ligado={comp[x.id]}
              aoTrocar={() => setComp((v) => ({ ...v, [x.id]: !v[x.id] }))}
            />
          ))}
        </div>
      </div>

      <div className="tg-group" role="group" aria-labelledby="lp-tg-s">
        <small id="lp-tg-s">{cofre.rotuloAssinaturas}</small>
        <div className="tgs">
          {cofre.assinaturas.map((x) => (
            <Interruptor
              key={x.id}
              {...x}
              ligado={ass[x.id]}
              aoTrocar={() => setAss((v) => ({ ...v, [x.id]: !v[x.id] }))}
            />
          ))}
        </div>
      </div>

      <div className={`result ${ok ? 'ok' : 'no'}`} aria-live="polite">
        {ok ? (
          <>
            <b>R$ {cofre.bonus}</b>
            <p>{cofre.liberado(s)}</p>
          </>
        ) : (
          <>
            <b>R$ 0</b>
            <p>
              {c < cofre.compromissos.length ? cofre.faltaCompromisso : cofre.faltaAssinatura(s)}.{' '}
              {cofre.reservado}
            </p>
          </>
        )}
      </div>
    </Revelar>
  );
}

export default Cofre;
