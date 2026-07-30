import { ClockIcon, ZapIcon, ArchiveIcon, LeafIcon } from '../icons/Icons';
import { comoFunciona, servicesData } from '../data/content';
import * as images from '../images';

const ICONS = {
  clock: ClockIcon,
  zap: ZapIcon,
  archive: ArchiveIcon,
};

function ServiceCard({ service }) {
  const Icon = ICONS[service.icon];
  const image = images[service.image];

  return (
    <div className={`service-card${service.featured ? ' service-card--featured' : ''}`}>
      {service.featured && (
        <LeafIcon filled size={150} color="#fff" className="service-card-watermark" />
      )}

      <div
        className={`service-card-icon${
          service.featured ? ' service-card-icon--featured' : ''
        }`}
      >
        <Icon size={16} color={service.featured ? '#fff' : '#14170f'} />
      </div>

      <div className="service-card-title">{service.title}</div>

      <img src={image} className="service-card-image" alt={service.title} />
    </div>
  );
}

export function ComoFunciona() {
  return (
    <section id="como-funciona" className="como-funciona">
      <div className="como-funciona-intro">
        <h2 className="como-funciona-title">{comoFunciona.title}</h2>
        <p className="como-funciona-desc">{comoFunciona.description}</p>
      </div>

      <div className="como-funciona-cards">
        {servicesData.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>
    </section>
  );
}