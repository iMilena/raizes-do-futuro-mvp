import { useEffect, useRef } from 'react';
import { Foto } from './Foto';
import { rendaDireta } from '../images';
import { feira } from '../data/content';
import { usePrefereMenosMovimento } from '../hooks/usePrefereMenosMovimento';

/**
 * A foto da feira de Moreré em tela cheia, com parallax suave: a foto anda
 * até 8% da própria altura enquanto a seção cruza a tela. Com menos movimento,
 * fica parada.
 */
export function Feira() {
  const secao = useRef(null);
  const fundo = useRef(null);
  const reduzir = usePrefereMenosMovimento();

  useEffect(() => {
    const bg = fundo.current;
    if (reduzir || !bg) {
      if (bg) bg.style.transform = '';
      return undefined;
    }
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      const r = secao.current.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) {
        bg.style.transform = `translate3d(0,${(r.top / innerHeight) * -8}%,0)`;
      }
    };
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => {
      window.removeEventListener('scroll', aoRolar);
      cancelAnimationFrame(quadro);
    };
  }, [reduzir]);

  return (
    <section className="break" ref={secao}>
      <div className="bg" ref={fundo}>
        <Foto imagem={rendaDireta} sizes="100vw" />
      </div>
      <div className="wrap">
        <q>{feira.citacao}</q>
        <div className="cap">{feira.legenda}</div>
      </div>
    </section>
  );
}

export default Feira;
