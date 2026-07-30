import { pilaresData } from '../data/content';
import { pilaresComunidade } from '../images';

export function Pilares() {
  const [col1, col2] = [
    pilaresData.items.slice(0, 2),
    pilaresData.items.slice(2, 4),
  ];

  return (
    <div className="pilares">
      <h2 className="pilares-title">{pilaresData.title}</h2>

      <div className="pilares-grid">
        <div className="pilares-column">
          {col1.map((item) => (
            <div key={item.number}>
              <div className="pilar-number">{item.number}</div>
              <div className="pilar-title">{item.title}</div>
              <div className="pilar-text">{item.text}</div>
            </div>
          ))}
        </div>

        <div className="pilares-image-wrapper">
          <img
            src={pilaresComunidade}
            className="pilares-image"
            alt="Mutirão de coleta comunitária em Boipeba"
          />
        </div>

        <div className="pilares-column">
          {col2.map((item) => (
            <div key={item.number}>
              <div className="pilar-number">{item.number}</div>
              <div className="pilar-title">{item.title}</div>
              <div className="pilar-text">{item.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
