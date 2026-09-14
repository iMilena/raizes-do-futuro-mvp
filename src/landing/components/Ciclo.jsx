import { useCallback, useMemo, useRef } from 'react';
import { Revelar } from './Revelar';
import { ciclo } from '../data/content';
import { useCicloScroll } from '../hooks/useCicloScroll';

/* Geometria do anel. Em unidades do viewBox, não em pixels: o SVG escala junto
   com a coluna e a conta continua valendo em qualquer largura. */
const CX = 210;
const CY = 210;
const R = 140;
const FOLGA = 4.6; // graus de respiro entre um arco e o seguinte

const TOTAL = ciclo.etapas.length;
const ABERTURA = 360 / TOTAL;
const PERIMETRO = Math.PI * 2 * R;

/** Ponto do círculo no ângulo dado, com 0° no topo e o giro no sentido horário. */
function polar(angulo, raio) {
  const rad = ((angulo - 90) * Math.PI) / 180;
  return [CX + Math.cos(rad) * raio, CY + Math.sin(rad) * raio];
}

function arco(de, ate, raio) {
  const [x0, y0] = polar(de, raio);
  const [x1, y1] = polar(ate, raio);
  const maior = ate - de > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${raio} ${raio} 0 ${maior} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/**
 * O ciclo, contado pela rolagem.
 *
 * O anel fica preso na tela enquanto a página percorre sete espaçadores; a cada
 * um, um arco se preenche, um nó acende, o pacote de luz avança e o texto ao
 * lado troca. A cor viaja junto: menta enquanto é território, âmbar quando o
 * resíduo vira dinheiro, terracota quando o dinheiro chega na criança.
 *
 * Só o índice da etapa passa pelo estado do React. O preenchimento dentro de
 * cada arco muda a cada quadro e é escrito direto nos nós do SVG — sessenta
 * renders por segundo para mexer em `stroke-dashoffset` seria trabalho jogado
 * fora, e a árvore de sete etapas não é barata de reconciliar.
 */
export function Ciclo() {
  const refPalco = useRef(null);
  const refsArco = useRef([]);
  const refsNo = useRef([]);
  const refPacote = useRef(null);

  const arcos = useMemo(
    () =>
      ciclo.etapas.map((etapa, i) => {
        const de = i * ABERTURA + FOLGA / 2;
        const ate = (i + 1) * ABERTURA - FOLGA / 2;
        const comprimento = PERIMETRO * ((ate - de) / 360);
        const [nx, ny] = polar(i * ABERTURA, R);
        const [rx, ry] = polar(i * ABERTURA, R + 30);
        const angulo = i * ABERTURA;
        return {
          d: arco(de, ate, R),
          comprimento,
          cor: etapa.cor,
          rotulo: etapa.rotulo,
          no: { x: nx, y: ny },
          texto: {
            x: rx,
            y: ry + 3,
            ancora: angulo > 5 && angulo < 175 ? 'start' : angulo > 185 ? 'end' : 'middle',
          },
        };
      }),
    []
  );

  const desenhar = useCallback(
    (indice, local) => {
      arcos.forEach((a, i) => {
        const preenchido = i < indice ? 1 : i === indice ? local : 0;
        const el = refsArco.current[i];
        if (el) el.style.strokeDashoffset = (a.comprimento * (1 - preenchido)).toFixed(2);

        const no = refsNo.current[i];
        if (no) {
          const aceso = i <= indice;
          no.setAttribute('r', aceso ? '7' : '4.5');
          no.setAttribute('fill', aceso ? a.cor : '#0A2720');
          no.parentNode.classList.toggle('is-aceso', aceso);
        }
      });

      const pacote = refPacote.current;
      if (pacote) {
        const [px, py] = polar((indice + local) * ABERTURA, R);
        pacote.setAttribute('cx', px.toFixed(2));
        pacote.setAttribute('cy', py.toFixed(2));
        pacote.setAttribute('fill', arcos[indice].cor);
      }
    },
    [arcos]
  );

  const indice = useCicloScroll(refPalco, TOTAL, desenhar);

  return (
    <>
      <section
        className="rf-ato rf-noite rf-ciclo-abertura"
        id="ciclo"
        style={{ '--rf-de': '#0C2C23', '--rf-ate': '#0E3026' }}
      >
        <div className="rf-wrap">
          <Revelar como="span" className="rf-eyebrow">
            {ciclo.eyebrow}
          </Revelar>
          <Revelar como="h2" className="rf-h-sec" atraso={80} style={{ maxWidth: '17ch' }}>
            {ciclo.titulo}
          </Revelar>
          <Revelar como="p" className="rf-lede" atraso={160}>
            {ciclo.lede}
          </Revelar>
        </div>
      </section>

      <div className="rf-palco rf-noite" ref={refPalco}>
        <div className="rf-preso rf-wrap">
          <div className="rf-anel-caixa">
            <svg className="rf-anel" viewBox="0 0 420 420" aria-hidden="true">
              <circle className="rf-anel-trilho" cx={CX} cy={CY} r={R} />

              <g>
                {arcos.map((a, i) => (
                  <path
                    key={a.rotulo}
                    ref={(el) => {
                      refsArco.current[i] = el;
                    }}
                    className="rf-anel-arco"
                    d={a.d}
                    stroke={a.cor}
                    style={{
                      strokeDasharray: a.comprimento.toFixed(2),
                      strokeDashoffset: a.comprimento.toFixed(2),
                    }}
                  />
                ))}
              </g>

              <g>
                {arcos.map((a, i) => (
                  <g className="rf-anel-no" key={a.rotulo}>
                    <circle
                      ref={(el) => {
                        refsNo.current[i] = el;
                      }}
                      cx={a.no.x.toFixed(2)}
                      cy={a.no.y.toFixed(2)}
                      r="4.5"
                      fill="#0A2720"
                      stroke={a.cor}
                      strokeWidth="1.8"
                    />
                    <text x={a.texto.x.toFixed(2)} y={a.texto.y.toFixed(2)} textAnchor={a.texto.ancora}>
                      {a.rotulo}
                    </text>
                  </g>
                ))}
              </g>

              <circle className="rf-anel-pacote" ref={refPacote} cx={CX} cy={CY - R} r="7" fill={arcos[0].cor} />
            </svg>

            <div className="rf-anel-nucleo" aria-hidden="true">
              <div>
                <div className="rf-anel-k">{ciclo.rotuloEtapa}</div>
                <div className="rf-anel-n rf-mono">{String(indice + 1).padStart(2, '0')}</div>
              </div>
            </div>
          </div>

          <div className="rf-etapas">
            {ciclo.etapas.map((etapa, i) => (
              <article className={`rf-etapa${i === indice ? ' is-on' : ''}`} key={etapa.rotulo}>
                <div className="rf-etapa-idx">
                  {String(i + 1).padStart(2, '0')} · {etapa.indice}
                </div>
                <h3>{etapa.titulo}</h3>
                <p>{etapa.texto}</p>
                <div className="rf-chips">
                  {etapa.chips.map((chip) => (
                    <span
                      className={`rf-chip${chip.tom ? ` is-${chip.tom}` : ''}`}
                      key={chip.texto}
                    >
                      {chip.texto}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* A altura destes sete blocos é o que dá comprimento à rolagem do anel:
            um por etapa, e nada dentro deles. */}
        <div aria-hidden="true">
          {ciclo.etapas.map((etapa) => (
            <div className="rf-espacador" key={etapa.rotulo} />
          ))}
        </div>
      </div>
    </>
  );
}

export default Ciclo;
