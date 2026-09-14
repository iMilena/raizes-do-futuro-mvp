import { Revelar } from './Revelar';
import { proximoPasso } from '../data/content';

/** As três frentes de captação, já na zona clara da página. */
export function ProximoPasso() {
  return (
    <section
      className="rf-ato rf-dia"
      id="apoiar"
      style={{ '--rf-de': '#F3F0E6', '--rf-ate': '#EFEBDE' }}
    >
      <div className="rf-wrap">
        <Revelar como="span" className="rf-eyebrow">
          {proximoPasso.eyebrow}
        </Revelar>
        <Revelar como="h2" className="rf-h-sec" atraso={80} style={{ maxWidth: '18ch' }}>
          {proximoPasso.titulo}
        </Revelar>
        <Revelar como="p" className="rf-lede" atraso={140}>
          {proximoPasso.lede}
        </Revelar>

        <div className="rf-frentes">
          {proximoPasso.frentes.map((frente, i) => (
            <Revelar className="rf-frente" key={frente.n} atraso={i * 140}>
              <span className="rf-frente-n rf-mono">{frente.n}</span>
              <h3>{frente.titulo}</h3>
              <p>{frente.texto}</p>
            </Revelar>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ProximoPasso;
