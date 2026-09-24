import { useEffect, useRef, useState } from 'react';
import { Foto } from './Foto';
import { Eyebrow, Titulo } from './Pecas';
import * as fotos from '../images';
import { ciclo } from '../data/content';
import { usePrefereMenosMovimento } from '../hooks/usePrefereMenosMovimento';

/* Os desenhos dos cartões sem foto. SVG inline e sem texto essencial: o que
   importa está no parágrafo do cartão, o desenho é ilustração (aria-hidden). */
const ARTES = {
  balanca: (
    <svg viewBox="0 0 440 130">
      <g fill="none" stroke="#7fd99a" strokeWidth="1.5">
        <rect x="150" y="80" width="140" height="10" rx="3" />
        <path d="M220 80V40" />
        <rect x="185" y="18" width="70" height="26" rx="6" />
      </g>
      <text x="220" y="36" textAnchor="middle" fill="#7fd99a" fontFamily="JetBrains Mono" fontSize="13">
        18,6 kg
      </text>
      <g fill="#cfedd9" opacity=".8">
        <ellipse cx="200" cy="72" rx="14" ry="10" />
        <ellipse cx="232" cy="70" rx="16" ry="12" />
      </g>
    </svg>
  ),
  detectores: (
    <svg viewBox="0 0 440 130">
      <g fontFamily="JetBrains Mono" fontSize="11" fill="#cfedd9">
        <rect x="120" y="14" width="200" height="104" rx="12" fill="none" stroke="rgba(207,237,217,.25)" />
        <text x="138" y="40">pilha recontada</text>
        <text x="138" y="62">sequência</text>
        <text x="138" y="84">foto (pHash)</text>
        <text x="138" y="106">peso</text>
      </g>
      <g fill="#7fd99a" fontFamily="JetBrains Mono" fontSize="11" textAnchor="end">
        <text x="302" y="40">ok</text>
        <text x="302" y="62">ok</text>
        <text x="302" y="84">ok</text>
        <text x="302" y="106">ok</text>
      </g>
    </svg>
  ),
  fontes: (
    <svg viewBox="0 0 440 130">
      <g fill="none" strokeWidth="1.5">
        <rect x="110" y="30" width="96" height="70" rx="12" stroke="#f3b267" />
        <rect x="234" y="30" width="96" height="70" rx="12" stroke="#7fd99a" />
      </g>
      <text x="158" y="72" textAnchor="middle" fill="#f3b267" fontFamily="Fraunces Variable, Fraunces" fontSize="18">
        Turismo
      </text>
      <text x="282" y="72" textAnchor="middle" fill="#7fd99a" fontFamily="Fraunces Variable, Fraunces" fontSize="18">
        Empresas
      </text>
    </svg>
  ),
  cofre: (
    <svg viewBox="0 0 440 130">
      <polygon points="220,14 272,44 272,96 220,126 168,96 168,44" fill="none" stroke="#f3b267" strokeWidth="1.5" />
      <circle cx="220" cy="46" r="8" fill="#7fd99a" />
      <circle cx="198" cy="84" r="8" fill="#7fd99a" />
      <circle cx="242" cy="84" r="8" fill="none" stroke="#cfedd9" strokeDasharray="3 3" />
    </svg>
  ),
};

function Etapa({ e, i }) {
  const tags = (
    <div className="tags">
      {e.tags.map((t) => (
        <span className="tag" key={t}>
          {t}
        </span>
      ))}
    </div>
  );
  if (e.foto) {
    return (
      <article className="stage img">
        <Foto imagem={fotos[e.foto]} alt="" sizes="(max-width: 900px) 100vw, 440px" />
        <div className="in">
          <small>{e.indice}</small>
          <h3>{e.titulo}</h3>
          <p>{e.texto}</p>
          {tags}
        </div>
      </article>
    );
  }
  return (
    <article className="stage">
      <span className="num" aria-hidden="true">
        {String(i + 1).padStart(2, '0')}
      </span>
      <small>{e.indice}</small>
      <h3>{e.titulo}</h3>
      <p>{e.texto}</p>
      <div className="art" aria-hidden="true">
        {ARTES[e.arte]}
      </div>
      {tags}
    </article>
  );
}

/** Abaixo disto a rolagem horizontal presa vira lista vertical. */
const LARGURA_LISTA = 900;

/**
 * "Como funciona": as sete etapas andam na horizontal enquanto a página rola
 * na vertical.
 *
 * A seção é alta (560vh) e o conteúdo fica num container `position: sticky`;
 * o quanto já se rolou dentro dela vira o deslocamento da trilha e o
 * preenchimento da barra de progresso. Tudo por `transform`, direto no DOM, sem
 * estado do React por quadro. Abaixo de 900 px, ou com menos movimento, a
 * seção vira uma lista vertical comum.
 */
export function ComoFunciona() {
  const reduzir = usePrefereMenosMovimento();
  const pin = useRef(null);
  const trilha = useRef(null);
  const barra = useRef(null);
  const [passo, setPasso] = useState(0);

  useEffect(() => {
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      const t = trilha.current;
      const p0 = pin.current;
      if (!t || !p0) return;
      if (reduzir || innerWidth <= LARGURA_LISTA) {
        t.style.transform = '';
        return;
      }
      const r = p0.getBoundingClientRect();
      const total = p0.offsetHeight - innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / total));
      const max = t.scrollWidth - innerWidth;
      t.style.transform = `translate3d(${-p * max}px,0,0)`;
      if (barra.current) barra.current.style.transform = `scaleX(${p})`;
      setPasso(Math.min(ciclo.etapas.length - 1, Math.round(p * (ciclo.etapas.length - 1))));
    };
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener('scroll', aoRolar, { passive: true });
    window.addEventListener('resize', aoRolar);
    return () => {
      window.removeEventListener('scroll', aoRolar);
      window.removeEventListener('resize', aoRolar);
      cancelAnimationFrame(quadro);
    };
  }, [reduzir]);

  return (
    <section id="como" className={reduzir ? 'lista' : undefined}>
      <div className="pin" ref={pin}>
        <div className="pin-sticky">
          <div className="wrap how-head">
            <div>
              <Eyebrow>{ciclo.eyebrow}</Eyebrow>
              <Titulo partes={ciclo.titulo} style={{ maxWidth: '18ch' }} />
            </div>
            <p className="lead" style={{ maxWidth: '40ch' }}>
              {ciclo.lede}
            </p>
          </div>
          <div className="track" ref={trilha}>
            {ciclo.etapas.map((e, i) => (
              <Etapa key={e.rotulo} e={e} i={i} />
            ))}
          </div>
          <div className="prog-wrap" aria-hidden="true">
            <div className="prog">
              <div className="bar">
                <i ref={barra} />
              </div>
            </div>
            <div className="prog">
              <div className="lbls">
                {ciclo.etapas.map((e, i) => (
                  <span key={e.rotulo} className={i <= passo ? 'on' : undefined}>
                    {e.rotulo}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ComoFunciona;
