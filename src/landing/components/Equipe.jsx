import { Revelar } from './Revelar';
import { Eyebrow, Titulo } from './Pecas';
import { PESSOAS, RECONHECIMENTO, iniciais } from '../data/equipe';

/**
 * A equipe: os reconhecimentos no alto e um cartão por pessoa, com foto (ou
 * as iniciais, enquanto a foto não chega), nome, papel e histórico.
 *
 * Serve às duas páginas: a landing passa `idioma="pt"` e a página de
 * investidores `idioma="en"`. Os títulos vêm de quem chama.
 */
export function Equipe({ idioma = 'pt', eyebrow, titulo, nota, id = 'equipe' }) {
  return (
    <section className="sec" id={id} tabIndex={-1}>
      <div className="wrap">
        <Revelar>
          <Eyebrow>{eyebrow}</Eyebrow>
        </Revelar>
        <Revelar atraso={100}>
          <Titulo partes={titulo} />
        </Revelar>

        <ul className="premios">
          {RECONHECIMENTO.map((r) => (
            <Revelar key={r.destaque.en} como="li">
              <b>{r.destaque[idioma]}</b>
              <span>{r.texto[idioma]}</span>
            </Revelar>
          ))}
        </ul>

        <ul className="equipe">
          {PESSOAS.map((p, i) => (
            <Revelar key={p.nome} como="li" atraso={i * 80}>
              {p.foto ? (
                <img className="rosto" src={p.foto} alt="" loading="lazy" width="96" height="96" />
              ) : (
                <span className="rosto" aria-hidden="true">
                  {iniciais(p.nome)}
                </span>
              )}
              <h3>{p.nome}</h3>
              <small>{p.papel[idioma]}</small>
              {p.historico[idioma] && <p>{p.historico[idioma]}</p>}
            </Revelar>
          ))}
        </ul>
        {nota && <p className="equipe-nota">{nota}</p>}
      </div>
    </section>
  );
}

export default Equipe;
