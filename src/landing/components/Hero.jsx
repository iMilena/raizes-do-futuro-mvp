import { useEffect, useMemo, useRef } from 'react';
import { Foto } from './Foto';
import { hero } from '../data/content';
import { coletaValidacao } from '../images';
import { rolarAte } from '../hooks/useCromoDoScroll';
import { usePrefereMenosMovimento } from '../hooks/usePrefereMenosMovimento';

/** Partículas de luz sobre a areia. Quantidade escolhida a olho: mais que isto vira poeira. */
const PARTICULAS = 16;

export function Hero({ aoAbrirContato }) {
  const reduzir = usePrefereMenosMovimento();
  const refFoto = useRef(null);
  const refSecao = useRef(null);

  /* Sorteadas uma vez e guardadas: recalcular a cada render faria as partículas
     saltarem de lugar sempre que qualquer estado da página mudasse. */
  const particulas = useMemo(
    () =>
      Array.from({ length: PARTICULAS }, () => ({
        esquerda: `${Math.random() * 100}%`,
        topo: `${56 + Math.random() * 42}%`,
        duracao: `${9 + Math.random() * 11}s`,
        atraso: `${-Math.random() * 14}s`,
        opacidade: 0.3 + Math.random() * 0.5,
      })),
    []
  );

  /* Parallax: a foto anda um pouco menos que a página e responde de leve ao
     mouse. Escrito direto no style do elemento, sem estado — é uma leitura por
     quadro, e passar por render do React aqui só somaria trabalho. */
  useEffect(() => {
    if (reduzir) return undefined;

    let agendado = false;
    let mx = 0;
    let my = 0;

    const desenhar = () => {
      agendado = false;
      const camada = refFoto.current;
      const secao = refSecao.current;
      if (!camada || !secao) return;

      const y = window.scrollY;
      if (y > secao.offsetHeight) return; // fora da tela, não há o que mover

      const ty = y * 0.034 + my * 0.96;
      const tx = mx * 2.7;
      camada.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
    };

    const agendar = () => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(desenhar);
    };

    const aoMover = (e) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
      agendar();
    };

    window.addEventListener('scroll', agendar, { passive: true });
    window.addEventListener('mousemove', aoMover, { passive: true });
    agendar();

    return () => {
      window.removeEventListener('scroll', agendar);
      window.removeEventListener('mousemove', aoMover);
    };
  }, [reduzir]);

  return (
    <section className="rf-hero rf-noite" id="topo" ref={refSecao}>
      <figure className="rf-cena">
        <div className="rf-camada rf-camada-foto" ref={refFoto}>
          <Foto
            imagem={coletaValidacao}
            sizes="100vw"
            prioridade
            className="rf-hero-foto"
          />
        </div>
        <div className="rf-gradacao" aria-hidden="true" />
        <div className="rf-particulas" aria-hidden="true">
          {particulas.map((p, i) => (
            <span
              key={i}
              className="rf-particula"
              style={{
                left: p.esquerda,
                top: p.topo,
                opacity: p.opacidade,
                animationDuration: p.duracao,
                animationDelay: p.atraso,
              }}
            />
          ))}
        </div>
        <div className="rf-vinheta" aria-hidden="true" />
        <div className="rf-grao" aria-hidden="true" />
        <figcaption className="rf-hero-credito">{hero.legendaFoto}</figcaption>
      </figure>

      <div className="rf-hero-in rf-wrap">
        <span className="rf-selo">
          <b>{hero.selo.destaque}</b>
          {hero.selo.texto}
        </span>

        <h1 className="rf-hero-h">
          {hero.linhas.map((linha, i) => (
            <span className="rf-linha" key={linha.texto}>
              <span style={{ '--rf-d': `${0.15 + i * 0.12}s` }}>
                {linha.acento ? <em>{linha.texto}</em> : linha.texto}
              </span>
            </span>
          ))}
        </h1>

        <p className="rf-hero-sub">{hero.subtitulo}</p>

        <div className="rf-hero-acoes">
          <button type="button" className="rf-btn" onClick={aoAbrirContato}>
            {hero.primario}
          </button>
          <a
            className="rf-btn rf-btn-fantasma"
            href="#ciclo"
            onClick={(e) => {
              e.preventDefault();
              rolarAte('ciclo');
            }}
          >
            {hero.secundario}
          </a>
        </div>

        <div className="rf-aovivo">
          <span className="rf-aovivo-ponto">
            <i aria-hidden="true" />
            {hero.aoVivo}
          </span>
          <span className="rf-aovivo-sep" aria-hidden="true" />
          {hero.marcadores.map((m) => (
            <span key={m.rotulo}>
              <b>{m.valor}</b> {m.rotulo}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Hero;
