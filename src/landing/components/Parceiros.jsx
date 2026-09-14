import { Revelar } from './Revelar';
import { Foto } from './Foto';
import { parceiros } from '../data/content';
import { pilaresComunidade } from '../images';

/**
 * Quem opera o ciclo.
 *
 * As três organizações aparecem com a etiqueta da assinatura que cada uma
 * detém no cofre, e não como um mural de logos: é a mesma lista que o cofre
 * logo abaixo deixa a pessoa mexer. A foto ao lado é a roda comunitária — a
 * terceira assinatura tem gente por trás.
 */
export function Parceiros() {
  return (
    <section
      className="rf-ato rf-noite"
      id="parceiros"
      style={{ '--rf-de': '#0A2720', '--rf-ate': '#0C2C23' }}
    >
      <div className="rf-wrap">
        <Revelar como="span" className="rf-eyebrow">
          {parceiros.eyebrow}
        </Revelar>
        <Revelar como="h2" className="rf-h-sec" atraso={80} style={{ maxWidth: '17ch' }}>
          {parceiros.titulo}
        </Revelar>
        <Revelar como="p" className="rf-lede" atraso={160}>
          {parceiros.lede}
        </Revelar>

        <div className="rf-ops-grade">
          <Revelar como="figure" className="rf-ops-foto" atraso={200}>
            <Foto
              imagem={pilaresComunidade}
              sizes="(max-width: 980px) 92vw, 34vw"
            />
            <figcaption>{parceiros.legendaFoto}</figcaption>
          </Revelar>

          <Revelar className="rf-ops" atraso={280}>
            {parceiros.itens.map((item) => (
              <div className="rf-op" key={item.nome}>
                <span className="rf-op-papel">{item.papel}</span>
                <h3>{item.nome}</h3>
                <span className="rf-op-etiqueta">{item.etiqueta}</span>
                <p>{item.texto}</p>
              </div>
            ))}
          </Revelar>
        </div>
      </div>
    </section>
  );
}

export default Parceiros;
