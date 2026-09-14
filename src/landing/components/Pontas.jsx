import { Revelar } from './Revelar';
import { Foto } from './Foto';
import { pontas } from '../data/content';
import { coletaValidacao, fundoInfancia, rendaDireta } from '../images';

const FOTOS = { coletaValidacao, fundoInfancia, rendaDireta };

/** Enquadramentos ajustados à mão onde o corte automático perdia o assunto. */
const ENQUADRAMENTO = { rendaDireta: '50% 74%' };

export function Pontas() {
  return (
    <section
      className="rf-ato rf-noite"
      id="pontas"
      style={{ '--rf-de': '#1B3A26', '--rf-ate': '#293E24' }}
    >
      <div className="rf-wrap">
        <Revelar como="span" className="rf-eyebrow">
          {pontas.eyebrow}
        </Revelar>
        <Revelar como="h2" className="rf-h-sec" atraso={80} style={{ maxWidth: '16ch' }}>
          {pontas.titulo}
        </Revelar>

        <div className="rf-tri">
          {pontas.itens.map((item, i) => (
            <Revelar
              como="article"
              key={item.id}
              atraso={i * 140}
              className={`rf-ponta${item.destaque ? ' is-destaque' : ''}`}
            >
              <div className="rf-ponta-arte">
                <Foto
                  imagem={FOTOS[item.imagem]}
                  sizes="(max-width: 980px) 92vw, 33vw"
                  style={
                    ENQUADRAMENTO[item.imagem]
                      ? { objectPosition: ENQUADRAMENTO[item.imagem] }
                      : undefined
                  }
                />
              </div>
              <div className="rf-ponta-corpo">
                <span className="rf-ponta-etiqueta">{item.etiqueta}</span>
                <h3>{item.titulo}</h3>
                <p>{item.texto}</p>
              </div>
            </Revelar>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Pontas;
