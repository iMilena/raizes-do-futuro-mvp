import { LogIn } from 'lucide-react';
import { navItems, hero } from '../data/content';
import { scrollToSection } from '../hooks/useActiveSection';
import { logoRaizes } from '../images';

export function Navbar({ activeSection }) {
  return (
    <div className="landing-header">
      <div className="landing-logo">
        <img
          src={logoRaizes}
          alt="Raízes do Futuro"
          className="landing-logo-image"
        />

        <span className="landing-logo-text">
          Raízes do Futuro
        </span>
      </div>

      <nav className="landing-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              `landing-nav-item ${
                activeSection === item.id ? 'landing-nav-item--active' : ''
              }`
            }
            onClick={() => scrollToSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <button
        type="button"
        className="landing-contact-btn"
        onClick={() => {
          window.location.hash = '#/login';
        }}
      >
        <LogIn size={16} color="#fff" />
        {hero.contactLabel}
      </button>
    </div>
  );
}