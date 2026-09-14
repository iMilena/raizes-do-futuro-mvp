import { Revelar } from './Revelar';
import { ICONES_PILAR } from '../icons/Icons';
import { pilares } from '../data/content';

/* O fundo de cada pilar dá um passo dentro da rampa, para o bloco de quatro
   não virar um retângulo chapado no meio da descida para a areia. */
const FUNDOS = [
  ['#1A4430', '#173E2C'],
  ['#194230', '#163C2B'],
  ['#173E2C', '#143829'],
  ['#163C2B', '#133628'],
];

export function Pilares() {
  return (
    <section className="rf-ato rf-noite" style={{ '--rf-de': '#293E24', '--rf-ate': '#463A21' }}>
      <div className="rf-wrap">
        <Revelar como="span" className="rf-eyebrow">
          {pilares.eyebrow}
        </Revelar>
        <Revelar como="h2" className="rf-h-sec" atraso={80} style={{ maxWidth: '14ch' }}>
          {pilares.titulo}
        </Revelar>

        <Revelar className="rf-pilares" atraso={160}>
          {pilares.itens.map((pilar, i) => {
            const Icone = ICONES_PILAR[pilar.icone];
            return (
              <div
                className="rf-pilar"
                key={pilar.id}
                style={{ '--rf-de': FUNDOS[i][0], '--rf-ate': FUNDOS[i][1] }}
              >
                <Icone className="rf-pilar-ico" />
                <h3>{pilar.titulo}</h3>
                <p>{pilar.texto}</p>
              </div>
            );
          })}
        </Revelar>
      </div>
    </section>
  );
}

export default Pilares;
