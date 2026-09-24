import { Foto } from './Foto';
import { Seta } from './Pecas';
import { coletaValidacao } from '../images';
import { hero } from '../data/content';

/**
 * A capa: a foto do mutirão com Ken Burns lento e névoa, o título em quatro
 * linhas que sobem em sequência, e a faixa de números.
 *
 * A foto é um `<picture>` de verdade, e não fundo de CSS, para o navegador
 * escolher a variante WebP do tamanho da tela. Ela é a maior pintura da página,
 * então vai com prioridade alta e sem `lazy`.
 */
export function Capa() {
  return (
    <header className="hero" id="inicio">
      <div className="hero-bg">
        <Foto imagem={coletaValidacao} sizes="100vw" prioridade />
      </div>
      <div className="mist" aria-hidden="true" />
      <div className="wrap">
        <div className="badge fu" style={{ animationDelay: '.1s' }}>
          <b>{hero.selo.destaque}</b>
          {hero.selo.texto}
        </div>
        <h1>
          {hero.linhas.map((l) => (
            <span className="ln" key={l.texto}>
              <span className={l.acento ? 'g' : undefined}>{l.texto}</span>
            </span>
          ))}
        </h1>
        <p className="sub fu" style={{ animationDelay: '.7s' }}>
          {hero.subtitulo}
        </p>
        <div className="cta fu" style={{ animationDelay: '.85s' }}>
          <a className="btn btn-p" href={hero.primario.href}>
            {hero.primario.rotulo}
            <Seta />
          </a>
          <a className="btn btn-g" href={hero.secundario.href}>
            {hero.secundario.rotulo}
          </a>
        </div>
        <div className="strip fu" style={{ animationDelay: '1s' }}>
          <div className="live">
            <span className="pulse" aria-hidden="true" />
            {hero.aoVivo}
          </div>
          {hero.marcadores.map((m) => (
            <div className="s" key={m.rotulo}>
              <b>{m.valor}</b>
              <span>{m.rotulo}</span>
            </div>
          ))}
          <div className="cap">{hero.legendaFoto}</div>
        </div>
      </div>
      <div className="scroll-hint" aria-hidden="true">
        {hero.role}
      </div>
    </header>
  );
}

export default Capa;
