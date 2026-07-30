import { Navbar } from './Navbar';
import { hero } from '../data/content';
import { heroAerial, avatarFamilia1, avatarFamilia2 } from '../images';

export function Hero({ activeSection }) {
  return (
    <div id="inicio" className="hero">
      <img src={heroAerial} className="hero-bg-image" alt="Vista aérea de Boipeba, Bahia" />
      <div className="hero-overlay" />
      <div className="hero-overlay-bottom" />

      <Navbar activeSection={activeSection} />

      <div className="hero-content">
        <h1 className="hero-title">
          {hero.titleLine1}
          <br />
          <span className="hero-title-accent">{hero.titleHighlight}</span>
        </h1>
        <p className="hero-subtitle">{hero.subtitle}</p>
      </div>

      <div className="hero-floating-card">
        <div className="hero-avatars">
          <img src={avatarFamilia1} className="hero-avatar" alt="" />
          <img src={avatarFamilia2} className="hero-avatar" alt="" />
          <div className="hero-avatar-more">+3</div>
        </div>
        <div className="hero-floating-text">{hero.floatingCardText}</div>
      </div>
    </div>
  );
}
