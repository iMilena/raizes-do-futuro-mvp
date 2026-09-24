import { Revelar } from './Revelar';
import { Eyebrow, Titulo } from './Pecas';
import { pontas, pilares } from '../data/content';

/** As três pontas da infraestrutura e os quatro pilares do projeto. */
export function Infraestrutura() {
  return (
    <section className="sec">
      <div className="wrap">
        <Revelar>
          <Eyebrow>{pontas.eyebrow}</Eyebrow>
        </Revelar>
        <Revelar atraso={100}>
          <Titulo partes={pontas.titulo} />
        </Revelar>
        <div className="pontas">
          {pontas.itens.map((p, i) => (
            <Revelar key={p.titulo} className="ponta" atraso={i * 100}>
              <small>{p.etiqueta}</small>
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
            </Revelar>
          ))}
        </div>

        <Revelar style={{ marginTop: 110 }}>
          <Eyebrow>{pilares.eyebrow}</Eyebrow>
        </Revelar>
        <Revelar atraso={100}>
          <Titulo partes={pilares.titulo} style={{ maxWidth: '18ch' }} />
        </Revelar>
        <div className="pilares">
          {pilares.itens.map((p, i) => (
            <Revelar key={p.titulo} className="pilar" atraso={i * 100}>
              <b>{String(i + 1).padStart(2, '0')}</b>
              <h4>{p.titulo}</h4>
              <p>{p.texto}</p>
            </Revelar>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Infraestrutura;
