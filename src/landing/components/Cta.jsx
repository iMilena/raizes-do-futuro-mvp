import { Revelar } from './Revelar';
import { cta } from '../data/content';
import { rolarAte } from '../hooks/useCromoDoScroll';

export function Cta({ aoAbrirContato }) {
  return (
    <section
      className="rf-ato rf-dia rf-cta"
      id="contato"
      style={{ '--rf-de': '#EFEBDE', '--rf-ate': '#E7E1D0' }}
    >
      <div className="rf-wrap">
        <Revelar como="span" className="rf-eyebrow rf-eyebrow-centro">
          {cta.eyebrow}
        </Revelar>
        <Revelar como="h2" atraso={80} className="rf-cta-titulo">
          {cta.titulo}
        </Revelar>
        <Revelar className="rf-cta-acoes" atraso={160}>
          <button type="button" className="rf-btn" onClick={aoAbrirContato}>
            {cta.primario}
          </button>
          <a
            className="rf-btn rf-btn-fantasma"
            href="#parceiros"
            onClick={(e) => {
              e.preventDefault();
              rolarAte('parceiros');
            }}
          >
            {cta.secundario}
          </a>
        </Revelar>
      </div>
    </section>
  );
}

export default Cta;
