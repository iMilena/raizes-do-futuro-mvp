import { Foto } from './Foto';
import { Seta } from './Pecas';
import { criancaEscola } from '../images';
import { hero } from '../data/content';

/**
 * A capa: o texto à esquerda e, à direita, a criança da escola de Boipeba numa
 * janela em arco, com o coração batendo ao lado e o cartão do Fundo Infância.
 * Segue `raizes-capa-crianca.html`, no tema escuro, que é o do site.
 *
 * A foto é a maior pintura da primeira tela, então vai com prioridade alta e
 * sem `lazy`.
 */
export function Capa() {
  return (
    <header className="hero" id="inicio">
      <div className="wrap capa-grid">
        <div>
          <span className="badge fu">
            <b>{hero.selo.destaque}</b>
            {hero.selo.texto}
          </span>
          <h1 className="fu" style={{ animationDelay: '.1s' }}>
            {hero.titulo} <em>{hero.destaque}</em>
          </h1>
          <p className="sub fu" style={{ animationDelay: '.2s' }}>
            {hero.subtitulo}
          </p>
          <div className="cta fu" style={{ animationDelay: '.3s' }}>
            <a className="btn btn-p" href={hero.primario.href}>
              {hero.primario.rotulo}
              <Seta />
            </a>
            <a className="btn btn-g" href={hero.secundario.href}>
              {hero.secundario.rotulo}
            </a>
          </div>
          <div className="nums fu" style={{ animationDelay: '.4s' }}>
            {hero.marcadores.map((m) => (
              <div key={m.rotulo}>
                <b>{m.valor}</b>
                <span>{m.rotulo}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="palco fu" style={{ animationDelay: '.15s' }}>
          <div className="arco">
            <Foto imagem={criancaEscola} alt={hero.altFoto} sizes="(max-width: 900px) 90vw, 480px" prioridade />
          </div>
          <div className="coracao" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3.1 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.6h2c.7-1.5 2.2-2.6 4.3-2.6 3.6 0 5.8 3.7 4.3 7.2C19.5 16.4 12 21 12 21z" />
            </svg>
          </div>
          <div className="cartao">
            <small>{hero.cartao.eyebrow}</small>
            <p>{hero.cartao.texto}</p>
            <ul>
              {hero.cartao.itens.map((t) => (
                <li key={t}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12.5 10 17 19 7" />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Capa;
