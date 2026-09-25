import { useCallback, useEffect, useRef, useState } from 'react';
import { logoRaizesUrl } from '../landing/images';
import { useContagem } from '../landing/hooks/useContagem';
import { URL_CONTATO, URL_PAGINA_APP, URL_PAINEL, URL_SITE } from '../config.js';
import { CICLO, POIS } from './dados.js';
import { criarMapa } from './mapa.js';
import { criarSom } from './som.js';
import { PainelPonto } from './PainelPonto.jsx';
import '../estilos/site.css';
import './explorar.css';

/* ---------------------------------------------------------------------------
   "Explorar a ilha" (#/explorar), seguindo `prototipos/raizes-boipeba-explore.html`.

   A capa mostra a ilha de satélite entre nuvens; ao entrar, as nuvens se
   abrem e o mapa voa até Boipeba. Marcadores levam a um painel com a foto e
   os números de cada ponto, e "Seguir o ciclo" percorre as seis etapas
   sozinho. O mapa, as cenas e as nuvens vivem em `mapa.js`; aqui fica só o que
   é interface.
--------------------------------------------------------------------------- */

const PASSO_DO_PERCURSO = 8500;
const FILTROS = [
  ['ciclo', 'O ciclo'],
  ['praias', 'Praias'],
  ['comunidade', 'Comunidade'],
];
const ESTATISTICAS = [
  [12, 't validadas'],
  [30, 'famílias'],
  [60, 'crianças'],
];

function Estatistica({ valor, rotulo, ligado }) {
  const n = useContagem(valor, ligado);
  return (
    <div className="stat">
      <b aria-hidden="true">{n}</b>
      <span>
        <span className="sr-only">{valor} </span>
        {rotulo}
      </span>
    </div>
  );
}

const reduzirMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Explorar() {
  const [reduzir] = useState(reduzirMovimento);
  const [carregado, setCarregado] = useState(false);
  const [entrou, setEntrou] = useState(false);
  const [contar, setContar] = useState(false);
  const [filtro, setFiltro] = useState('ciclo');
  const [atualId, setAtualId] = useState(null);
  const [percurso, setPercurso] = useState(false);
  const [som, setSom] = useState(false);

  const mundo = useRef(null);
  const mapaEl = useRef(null);
  const nuvensEl = useRef(null);
  const borda = useRef(null);
  const contador = useRef(null);
  const corpo = useRef(null);
  const barra = useRef(null);
  const motor = useRef(null);
  const audio = useRef(null);
  const filtroRef = useRef(filtro);
  const atualRef = useRef(atualId);
  const percursoRef = useRef({ ligado: false, t: null });

  /* Os callbacks do motor e do teclado leem estes refs, e não o estado, para
     não precisarem ser recriados a cada troca de filtro ou de ponto. */
  useEffect(() => {
    filtroRef.current = filtro;
    atualRef.current = atualId;
  }, [filtro, atualId]);

  const atual = POIS.find((p) => p.id === atualId) || null;
  const lista = POIS.filter((p) => p.g.includes(filtro));

  /* --------------------------------------------------------- percurso -- */
  const pararPercurso = useCallback(() => {
    const pc = percursoRef.current;
    if (!pc.ligado) return;
    pc.ligado = false;
    clearTimeout(pc.t);
    setPercurso(false);
    if (barra.current) {
      barra.current.style.transition = 'none';
      barra.current.style.transform = 'scaleX(0)';
    }
  }, []);

  const abrir = useCallback((id) => {
    const p = POIS.find((x) => x.id === id);
    if (!p) return;
    if (!p.g.includes(filtroRef.current)) {
      filtroRef.current = p.g[0];
      setFiltro(p.g[0]);
      motor.current?.usarFiltro(p.g[0]);
    }
    atualRef.current = id;
    setAtualId(id);
    motor.current?.focar(id);
    audio.current?.sino();
    if (corpo.current) corpo.current.scrollTop = 0;
  }, []);

  const fechar = useCallback(({ afastar } = {}) => {
    setAtualId(null);
    motor.current?.soltar({ afastar });
  }, []);

  function reiniciarBarra() {
    const b = barra.current;
    if (!b) return;
    b.style.transition = 'none';
    b.style.transform = 'scaleX(0)';
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        b.style.transition = `transform ${PASSO_DO_PERCURSO}ms linear`;
        b.style.transform = 'scaleX(1)';
      })
    );
  }

  function comecarPercurso() {
    if (filtroRef.current !== 'ciclo') {
      filtroRef.current = 'ciclo';
      setFiltro('ciclo');
      motor.current?.usarFiltro('ciclo');
    }
    const pc = percursoRef.current;
    pc.ligado = true;
    setPercurso(true);
    let i = 0;
    const ir = () => {
      if (!pc.ligado) return;
      abrir(CICLO[i].id);
      reiniciarBarra();
      i++;
      pc.t = setTimeout(i < CICLO.length ? ir : pararPercurso, PASSO_DO_PERCURSO);
    };
    ir();
  }

  /* ------------------------------------------------------------ motor -- */
  useEffect(() => {
    const pc = percursoRef.current;
    const eng = criarMapa({
      mapaEl: mapaEl.current,
      mundoEl: mundo.current,
      nuvensEl: nuvensEl.current,
      bordaEl: borda.current,
      contadorEl: contador.current,
      reduzir,
      eventos: {
        aoCarregar: () => setCarregado(true),
        aoClicarPonto: (id) => {
          pararPercurso();
          abrir(id);
        },
        aoArrastar: pararPercurso,
      },
    });
    motor.current = eng;
    audio.current = criarSom();
    /* Sem rede, o satélite pode nunca carregar: a capa aparece mesmo assim. */
    const rede = setTimeout(() => setCarregado(true), 4500);
    return () => {
      clearTimeout(rede);
      clearTimeout(pc.t);
      eng.destruir();
      audio.current.destruir();
      motor.current = null;
    };
  }, [abrir, pararPercurso, reduzir]);

  useEffect(() => {
    document.title = 'Boipeba · Raízes do Futuro';
    const html = document.documentElement;
    const antes = { bg: html.style.background, ov: html.style.overflow };
    html.style.background = '#0a2720';
    html.style.overflow = 'hidden';
    return () => {
      html.style.background = antes.bg;
      html.style.overflow = antes.ov;
    };
  }, []);

  /* ----------------------------------------------------------- ações -- */
  const ligarSom = (on) => {
    setSom(on);
    audio.current?.ligar(on);
  };

  const entrar = (comSom) => {
    if (entrou) return;
    if (comSom) ligarSom(true);
    setEntrou(true);
    motor.current?.entrar();
    setTimeout(() => setContar(true), 900);
  };

  const voltarCapa = (e) => {
    e.preventDefault();
    pararPercurso();
    setAtualId(null);
    setEntrou(false);
    motor.current?.voltarCapa();
  };

  const mudarFiltro = (f) => {
    setFiltro(f);
    pararPercurso();
    setAtualId(null);
    motor.current?.soltar();
    motor.current?.filtrar(f);
  };

  const passo = (d) => {
    if (!atual) return;
    const i = (lista.indexOf(atual) + d + lista.length) % lista.length;
    abrir(lista[i].id);
  };

  /* teclado: Enter entra pela capa, Esc fecha o painel, setas trocam de ponto */
  useEffect(() => {
    const aoTeclar = (e) => {
      if (!entrou && e.key === 'Enter' && e.target === document.body) {
        entrar(false);
        return;
      }
      if (!atualRef.current) return;
      if (e.key === 'Escape') {
        pararPercurso();
        fechar();
      }
      const alvo = e.target;
      const digitando = alvo instanceof HTMLElement && alvo.closest('input, textarea, select');
      if (digitando) return;
      if (e.key === 'ArrowRight') {
        pararPercurso();
        passo(1);
      }
      if (e.key === 'ArrowLeft') {
        pararPercurso();
        passo(-1);
      }
    };
    addEventListener('keydown', aoTeclar);
    return () => removeEventListener('keydown', aoTeclar);
  });

  /* no celular, o painel é uma folha que fecha arrastando para baixo */
  const toque = useRef(null);
  const aoTocar = (e) => {
    toque.current = corpo.current && corpo.current.scrollTop <= 0 ? e.touches[0].clientY : null;
  };
  const aoSoltar = (e) => {
    if (toque.current !== null && e.changedTouches[0].clientY - toque.current > 90) {
      pararPercurso();
      fechar();
    }
    toque.current = null;
  };

  const classes = [
    'rf-site',
    'ex',
    entrou ? '' : 'hero',
    `f-${filtro}`,
    atual ? 'panel-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className={`loader${carregado ? ' gone' : ''}`} aria-hidden="true">
        <div className="ld">
          <svg viewBox="0 0 150 150">
            <defs>
              <linearGradient id="ex-lg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fbf5e3" stopOpacity="0" />
                <stop offset="1" stopColor="#fbf5e3" />
              </linearGradient>
            </defs>
            <circle cx="75" cy="75" r="70" fill="none" stroke="url(#ex-lg)" strokeWidth="1.2" />
          </svg>
          <img src={logoRaizesUrl} alt="" />
        </div>
        <div className="ld-t caps">Sobrevoando Boipeba</div>
      </div>

      <div className="world" ref={mundo}>
        <div className="kb">
          <div className="map" ref={mapaEl} role="region" aria-label="Mapa de satélite da Ilha de Boipeba" />
        </div>
        <div className="vignette" />
        <canvas className="clouds" ref={nuvensEl} aria-hidden="true" />
      </div>

      <header className="ex-top">
        <button
          type="button"
          className={`wave-btn${som ? ' on' : ''}`}
          aria-label={som ? 'Desligar som ambiente' : 'Ligar som ambiente'}
          aria-pressed={som}
          onClick={() => ligarSom(!som)}
        >
          <svg viewBox="0 0 30 14" aria-hidden="true">
            <path d={som ? 'M-8 7 Q-6 1 -4 7 T0 7 T4 7 T8 7 T12 7 T16 7 T20 7 T24 7 T28 7 T32 7' : 'M-8 7 L32 7'} />
          </svg>
          <span className="caps">Som</span>
        </button>
        <a className="logo" href="#/explorar" onClick={voltarCapa} aria-label="Voltar ao início">
          <img src={logoRaizesUrl} alt="" />
          <b>Raízes do Futuro</b>
          <small>Boipeba · Bahia</small>
        </a>
        <div className="h-right">
          <a className="h-link" href={URL_SITE}>
            Saiba mais
          </a>
          <a className="h-link hide-m" href={URL_PAGINA_APP}>
            App da família
          </a>
          <a className="h-link hide-m" href={URL_PAINEL}>
            Painel
          </a>
          <a className="h-link" href={`${URL_CONTATO}?tipo=investimento`}>
            Investir
          </a>
        </div>
      </header>

      <section className="capa" aria-hidden={entrou} inert={entrou ? '' : undefined}>
        <svg className="star fade-up" style={{ animationDelay: '.4s,.4s' }} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10 0l1.6 7.2L18.7 4 13 8.8 20 10l-7 1.2 5.7 4.8-7.1-3.2L10 20l-1.6-7.2L1.3 16 7 11.2 0 10l7-1.2L1.3 4l7.1 3.2z" />
        </svg>
        <div className="win caps fade-up" style={{ animationDelay: '.5s' }}>
          Vencedor <b>Youth Challenge Blockchain</b> · UNICEF Brasil
        </div>
        <div className="pre fade-up" style={{ animationDelay: '.7s' }}>
          No coração da ilha de
        </div>
        <h1 aria-label="Boipeba">
          {carregado
            ? [...'BOIPEBA'].map((c, i) => (
                <span key={i} aria-hidden="true" style={{ animationDelay: `${0.9 + i * 0.08}s` }}>
                  {c}
                </span>
              ))
            : <span className="espera" aria-hidden="true">BOIPEBA</span>}
        </h1>
        <p className="sub fade-up" style={{ animationDelay: '1.7s' }}>
          Onde o resíduo das praias vira futuro para as crianças.
        </p>
        <button type="button" className="explore fade-up" style={{ animationDelay: '1.9s' }} onClick={() => entrar(true)}>
          <span>Explorar o mapa</span>
          <span className="l2" aria-hidden="true">
            Explorar o mapa
          </span>
        </button>
        <button type="button" className="silent fade-up" style={{ animationDelay: '2.1s' }} onClick={() => entrar(false)}>
          Começar sem áudio
        </button>
      </section>

      {/* a interface do mapa: escondida enquanto a capa está na frente */}
      <div className="ui-camada" aria-hidden={!entrou} inert={entrou ? undefined : ''}>
        <div className="place-chip ui">
          <div className="caps" style={{ color: 'var(--dawn)' }}>
            Em operação · Cairu, Bahia
          </div>
          <h2>Ilha de Boipeba</h2>
          <p>Arraste para sobrevoar. Chegue perto das praias para ver o ciclo acontecendo.</p>
        </div>
        <div className="stats ui" aria-label="Números do projeto">
          {ESTATISTICAS.map(([v, r]) => (
            <Estatistica key={r} valor={v} rotulo={r} ligado={contar} />
          ))}
        </div>
        <div className="scene-count ui" ref={contador} aria-hidden="true">
          Itens recolhidos nesta cena <b data-n>0</b>
        </div>
        <button type="button" className="tour ui" onClick={() => (percurso ? pararPercurso() : comecarPercurso())} aria-pressed={percurso}>
          <span className="pl" aria-hidden="true">
            {percurso ? (
              <svg viewBox="0 0 10 10" fill="currentColor">
                <path d="M2 1h2v8H2zM6 1h2v8H6z" />
              </svg>
            ) : (
              <svg viewBox="0 0 10 10" fill="currentColor">
                <path d="M2 1v8l7-4z" />
              </svg>
            )}
          </span>
          <span>{percurso ? 'Pausar percurso' : 'Seguir o ciclo'}</span>
        </button>
        <nav className="cats ui" aria-label="Categorias">
          {FILTROS.map(([f, rot]) => (
            <button key={f} type="button" className={filtro === f ? 'on' : undefined} aria-pressed={filtro === f} onClick={() => mudarFiltro(f)}>
              {rot}
            </button>
          ))}
        </nav>
        <div className="zoom ui">
          <button type="button" aria-label="Aproximar" onClick={() => motor.current?.zoomMais()}>
            +
          </button>
          <button type="button" aria-label="Afastar" onClick={() => motor.current?.zoomMenos()}>
            &minus;
          </button>
          <button
            type="button"
            aria-label="Visão geral da ilha"
            onClick={() => {
              pararPercurso();
              fechar();
              motor.current?.visaoGeral();
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M1 5V1h4M11 1h4v4M15 11v4h-4M5 15H1v-4" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          className="edge"
          ref={borda}
          aria-label="Ir para a próxima etapa"
          onClick={(e) => {
            pararPercurso();
            abrir(e.currentTarget.dataset.id);
          }}
        >
          <span className="ar">
            <svg data-seta width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M2 6h8M7 3l3 3-3 3" />
            </svg>
          </span>
          <span>
            <small>Próxima etapa</small>
            <span data-texto />
          </span>
        </button>
      </div>

      <aside
        className="panel"
        aria-hidden={!atual}
        inert={atual ? undefined : ''}
        aria-labelledby={atual ? 'ex-painel-titulo' : undefined}
        onTouchStart={aoTocar}
        onTouchEnd={aoSoltar}
      >
        <button
          type="button"
          className="p-close"
          aria-label="Fechar"
          onClick={() => {
            pararPercurso();
            fechar({ afastar: true });
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" />
          </svg>
        </button>
        <div className="p-scroll" ref={corpo}>
          {atual && <PainelPonto key={atual.id} p={atual} reduzir={reduzir} aoIrPara={abrir} />}
        </div>
        <div className="prog">
          <i ref={barra} />
        </div>
        <div className="p-foot">
          <button
            type="button"
            className="uline"
            onClick={() => {
              pararPercurso();
              passo(-1);
            }}
          >
            ‹ Anterior
          </button>
          <span className="p-count">{atual ? `${lista.indexOf(atual) + 1} / ${lista.length}` : ''}</span>
          <button
            type="button"
            className="uline"
            onClick={() => {
              pararPercurso();
              passo(1);
            }}
          >
            Próximo ›
          </button>
        </div>
      </aside>
    </div>
  );
}

export default Explorar;
