import { InstagramIcon, TwitterIcon, LinkedinIcon } from '../icons/Icons';
import { footer } from '../data/content';
import { footerLogo } from '../images';

export function Footer() {
  return (
    <div className="footer">
      <div className="footer-top">
        <div className="footer-columns">
          {footer.columns.map((column) => (
            <div key={column.title}>
              <div className="footer-column-title">{column.title}</div>
              <div className="footer-links">
                {column.links.map((link) => (
                  <span key={link}>{link}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="footer-brand">
          <div className="footer-logo">
            <img src={footerLogo} alt="Raízes do Futuro" className="footer-logo-image" />
            Raízes do Futuro
          </div>
          <div className="footer-tagline">{footer.tagline}</div>
          <div className="footer-socials">
            <div className="footer-social-icon">
              <InstagramIcon size={14} />
            </div>
            <div className="footer-social-icon">
              <TwitterIcon size={14} />
            </div>
            <div className="footer-social-icon">
              <LinkedinIcon size={14} />
            </div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">{footer.bottomText}</div>
    </div>
  );
}