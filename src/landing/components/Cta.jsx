import { ArrowRightIcon } from '../icons/Icons';
import { cta } from '../data/content';
import { ctaMangue } from '../images';

export function Cta() {
  return (
    <div className="cta">
      <div className="cta-content">
        <h2 className="cta-title">{cta.title}</h2>
        <button type="button" className="cta-button">
          {cta.buttonLabel}
          <ArrowRightIcon size={14} color="#fff" />
        </button>
      </div>
    </div>
  );
}
