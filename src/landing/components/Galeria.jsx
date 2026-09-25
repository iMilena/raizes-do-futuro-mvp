import { useRef } from 'react';
import { Foto } from './Foto';
import { Revelar } from './Revelar';
import { Eyebrow, Titulo } from './Pecas';
import * as fotos from '../images';
import { galeria } from '../data/content';
import { useVisivel } from '../hooks/useVisivel';

/** Uma foto da grade, que entra com o mesmo zoom suave das outras fotos. */
function Quadro({ foto, legenda, forma }) {
  const ref = useRef(null);
  const visivel = useVisivel(ref);
  const tamanhos = forma === 'cheio' ? '(max-width: 900px) 100vw, 1240px' : forma === 'largo' ? '(max-width: 900px) 100vw, 820px' : '(max-width: 900px) 100vw, 410px';
  return (
    <figure ref={ref} className={`photo gal-${forma || 'normal'}${visivel ? ' in' : ''}`}>
      <Foto imagem={fotos[foto]} sizes={tamanhos} />
      <figcaption>{legenda}</figcaption>
    </figure>
  );
}

/** "Boipeba, de perto": as fotos reais do ciclo, em grade. */
export function Galeria() {
  return (
    <section className="sec galeria">
      <div className="wrap">
        <Revelar>
          <Eyebrow>{galeria.eyebrow}</Eyebrow>
        </Revelar>
        <Revelar atraso={100}>
          <Titulo partes={galeria.titulo} />
        </Revelar>
        <div className="gal-grade">
          {galeria.fotos.map((f) => (
            <Quadro key={f.foto} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Galeria;
