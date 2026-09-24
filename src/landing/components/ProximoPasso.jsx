import { Revelar } from './Revelar';
import { Eyebrow, Seta, Titulo } from './Pecas';
import { proximoPasso, fechamento } from '../data/content';

/**
 * "O próximo passo": os três cartões levam à página de contato já com o
 * assunto escolhido. Logo depois, o fechamento "Vamos construir juntos".
 */
export function ProximoPasso() {
  return (
    <>
      <section className="sec next" id="contato">
        <div className="wrap">
          <Revelar>
            <Eyebrow>{proximoPasso.eyebrow}</Eyebrow>
          </Revelar>
          <Revelar atraso={100}>
            <Titulo partes={proximoPasso.titulo} />
          </Revelar>
          <Revelar como="p" className="lead" atraso={200}>
            {proximoPasso.lede}
          </Revelar>
          <div className="ways">
            {proximoPasso.frentes.map((f, i) => (
              <Revelar key={f.n} como="a" className="way" href={f.href} atraso={i * 100}>
                <b>{f.n}</b>
                <h3>{f.titulo}</h3>
                <p>{f.texto}</p>
                <span className="go">
                  {f.acao} <Seta tamanho={14} />
                </span>
              </Revelar>
            ))}
          </div>
        </div>
      </section>

      <section className="close" id="fim">
        <div className="bg" aria-hidden="true" />
        <div className="wrap">
          <Revelar>
            <Eyebrow style={{ justifyContent: 'center' }}>{fechamento.eyebrow}</Eyebrow>
          </Revelar>
          <Revelar como="h2" atraso={100}>
            {fechamento.antes}
            <em>{fechamento.destaque}</em>
            {fechamento.depois}
          </Revelar>
          <Revelar className="cta" atraso={200}>
            <a className="btn btn-p" href={fechamento.primario.href}>
              {fechamento.primario.rotulo}
              <Seta />
            </a>
            <a className="btn btn-g" href={fechamento.secundario.href}>
              {fechamento.secundario.rotulo}
            </a>
          </Revelar>
        </div>
      </section>
    </>
  );
}

export default ProximoPasso;
