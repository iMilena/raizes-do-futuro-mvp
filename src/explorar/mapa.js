/* ---------------------------------------------------------------------------
   O motor do "Explorar a ilha": o mapa Leaflet, os marcadores, a pane das
   cenas, as nuvens e o laço de animação.

   Fica fora do React de propósito. O que muda a cada quadro (posição dos
   bonecos, partículas, nuvens, a seta da borda) é pintado direto no canvas e
   no DOM, sem passar por estado: re-renderizar a página sessenta vezes por
   segundo seria desperdício. O React cuida do resto (capa, painel, filtros,
   percurso) e fala com o motor pelos métodos devolvidos aqui; o motor fala de
   volta pelos `eventos`.

   As classes que dependem do zoom (`near`, `zoomed-out`) vão no elemento
   `mundo`, que o React renderiza com className fixo, para um render nunca
   apagar o que o motor ligou.
--------------------------------------------------------------------------- */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BARCOS, CICLO, FLUXO_DA_ETAPA, ILHA, L0, LIMITES, POIS, PRAIAS_COM_COLETA } from './dados.js';
import { cenaEscola, cenaFeira, cenaPesagem, cenaPraia, cenaRoda, desenharCofre, desenharFluxos } from './cenas.js';
import { drawBoat } from './desenho.js';
import { criarNuvens } from './nuvens.js';

export const celular = () => innerWidth <= 760;

/** Onde a capa enquadra a ilha, conforme a largura da tela. */
const zoomDaCapa = () => (innerWidth < 500 ? 12.25 : innerWidth < 1100 ? 12.75 : 13);
const CENTRO_CAPA = [-13.622, -38.936];

const INTERACOES = ['dragging', 'touchZoom', 'doubleClickZoom', 'scrollWheelZoom', 'boxZoom', 'keyboard'];

/** Largura que o painel lateral ocupa no desktop (o mapa desconta isso). */
const larguraPainel = () => Math.min(440, innerWidth * 0.35);

export function criarMapa({ mapaEl, mundoEl, nuvensEl, bordaEl, contadorEl, reduzir, eventos }) {
  const DPR = Math.min(2, devicePixelRatio || 1);
  let emCapa = true;
  let filtro = 'ciclo';
  let atual = null;
  let fluxoAceso = -1;
  let itensRecolhidos = 0;
  let tempoFluxo = 0;
  let quadro = 0;
  let ultimo = performance.now();

  /* ------------------------------------------------------------ mapa -- */
  const map = L.map(mapaEl, {
    zoomControl: false, attributionControl: true, zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 110,
    minZoom: 12, maxZoom: 18.5, maxBounds: LIMITES, maxBoundsViscosity: 0.85, worldCopyJump: false,
  });
  map.attributionControl.setPrefix(false);
  const tiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxNativeZoom: 17, maxZoom: 18.5, keepBuffer: 6, attribution: 'Imagens © Esri, Maxar, Earthstar Geographics',
  }).addTo(map);
  tiles.once('load', () => eventos.aoCarregar?.());

  map.setView(CENTRO_CAPA, zoomDaCapa(), { animate: false });
  INTERACOES.forEach((h) => map[h].disable());

  const aoZoom = () => {
    const z = map.getZoom();
    mundoEl.classList.toggle('zoomed-out', z < 13.5);
    mundoEl.classList.toggle('near', z >= 15.4);
  };
  map.on('zoom zoomend', aoZoom);
  aoZoom();
  map.on('dragstart', () => eventos.aoArrastar?.());

  /* ------------------------------------------------------ marcadores -- */
  POIS.forEach((p) => {
    const cls = ['mk', p.beach && 'beach', p.chain && 'chain', p.left && 'left', ...p.g.map((x) => 'g-' + x)].filter(Boolean).join(' ');
    const icon = L.divIcon({
      className: '',
      iconSize: [0, 0],
      html: `<div class="${cls}" data-id="${p.id}"><span class="mk-dot">${p.n || ''}</span><span class="mk-txt"><span class="mk-lbl">${p.title}</span><span class="mk-st"></span></span></div>`,
    });
    L.marker(p.ll, { icon, keyboard: true, title: p.title, alt: p.title, riseOnHover: true })
      .addTo(map)
      .on('click', () => eventos.aoClicarPonto?.(p.id));
  });
  const marcarAtivo = (id) =>
    mapaEl.querySelectorAll('.mk').forEach((e) => e.classList.toggle('active', e.dataset.id === id));

  /* ------------------------------------------- pane das cenas (canvas) -- */
  const pane = map.createPane('fx');
  pane.style.zIndex = 450;
  pane.style.pointerEvents = 'none';
  pane.classList.add('leaflet-fx-pane');
  const fx = L.DomUtil.create('canvas', 'leaflet-zoom-hide', pane);
  const fc = fx.getContext('2d');
  let W = 0;
  let H = 0;
  const medirFx = () => {
    const s = map.getSize();
    W = s.x;
    H = s.y;
    fx.width = W * DPR;
    fx.height = H * DPR;
    fx.style.width = W + 'px';
    fx.style.height = H + 'px';
  };
  medirFx();
  map.on('resize', medirFx);

  const flutuantes = [];
  const m = {
    P: (ll) => map.latLngToContainerPoint(ll),
    distancia: (a, b) => map.distance(a, b),
    flutuar: (f) => flutuantes.push({ ...f, t: 0 }),
    contar: () => itensRecolhidos++,
  };
  const praias = PRAIAS_COM_COLETA.map(([a, b, n]) => cenaPraia(m, a, b, n, 1));
  const cenas = [...praias, cenaPesagem(m, L0.pesagem), cenaRoda(m, L0.viva), cenaFeira(m, L0.feira), cenaEscola(m, L0.escola)];
  const barcos = BARCOS.map((b) => ({ ...b }));

  /* ---------------------------------------------------------- nuvens -- */
  const nuvens = criarNuvens(nuvensEl, { reduzir, celular, dpr: DPR });

  /* --------------------------------------- seta para a próxima etapa -- */
  const bordaTexto = bordaEl.querySelector('[data-texto]');
  const bordaSeta = bordaEl.querySelector('[data-seta]');
  function seta() {
    if (!atual || !atual.n || atual.n === '06' || !mundoEl.classList.contains('near')) {
      bordaEl.classList.remove('on');
      return;
    }
    const nx = CICLO[CICLO.indexOf(atual) + 1];
    const np = m.P(nx.ll);
    const mob = celular();
    /* a área útil do mapa: sem a navegação em cima e sem o painel (ao lado no
       desktop, embaixo no celular) */
    const R = { l: 18, t: 100, r: mob ? W - 18 : W - larguraPainel() - 30, b: mob ? H * 0.4 - 24 : H - 140 };
    const cx = (R.l + R.r) / 2;
    const cy = (R.t + R.b) / 2;
    if (np.x > R.l && np.x < R.r && np.y > R.t && np.y < R.b) {
      bordaEl.classList.remove('on');
      return;
    }
    const dx = np.x - cx;
    const dy = np.y - cy;
    const kx = dx ? ((dx > 0 ? R.r : R.l) - cx) / dx : 1e9;
    const ky = dy ? ((dy > 0 ? R.b : R.t) - cy) / dy : 1e9;
    const k = Math.min(kx, ky);
    let x = cx + dx * k;
    const y = cy + dy * k;
    const w = bordaEl.offsetWidth || 200;
    x = Math.max(R.l + w / 2, Math.min(R.r - w / 2, x));
    bordaEl.style.left = x + 'px';
    bordaEl.style.top = y + 'px';
    bordaSeta.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    const txt = nx.n + ' · ' + nx.title;
    if (bordaTexto.textContent !== txt) bordaTexto.textContent = txt;
    bordaEl.dataset.id = nx.id;
    bordaEl.classList.add('on');
  }

  /* ------------------------------------------------------------ laço -- */
  const contadorNum = contadorEl.querySelector('[data-n]');
  function frame(agora) {
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    L.DomUtil.setPosition(fx, map.containerPointToLayerPoint([0, 0]));
    fc.setTransform(DPR, 0, 0, DPR, 0, 0);
    fc.clearRect(0, 0, W, H);
    const z = map.getZoom();
    if (!emCapa) {
      if (!reduzir) tempoFluxo += dt;
      const fAlpha = filtro === 'ciclo' ? Math.max(0.5, Math.min(1, (17.2 - z) / 1.2)) : 0;
      desenharFluxos(m, fc, z, fAlpha, tempoFluxo, fluxoAceso);
      desenharCofre(m, fc, reduzir ? 0 : agora / 1000);
      const sAlpha = Math.max(0, Math.min(1, (z - 14.3) / 0.6));
      if (sAlpha > 0) {
        const s = Math.max(0.7, Math.min(1.9, Math.pow(2, z - 16) * 1.2));
        fc.globalAlpha = sAlpha;
        barcos.forEach((b) => drawBoat(fc, b, s, reduzir ? 0 : dt, m.P));
        cenas.forEach((S) => {
          if (!reduzir) S.update(dt);
          const p = m.P(S.ll || S.a);
          if (p.x > -200 && p.x < W + 200 && p.y > -200 && p.y < H + 200) S.draw(fc, s);
        });
        for (let i = flutuantes.length - 1; i >= 0; i--) {
          const f = flutuantes[i];
          f.t += dt;
          const p = m.P(f.ll);
          const a = 1 - f.t / 1.4;
          if (a <= 0) {
            flutuantes.splice(i, 1);
            continue;
          }
          fc.save();
          fc.globalAlpha = a * sAlpha;
          fc.font = `800 ${12 * Math.min(1.4, s)}px "Manrope Variable", Manrope, sans-serif`;
          fc.textAlign = 'left';
          fc.fillStyle = f.col || '#fbf5e3';
          fc.shadowColor = 'rgba(0,0,0,.8)';
          fc.shadowBlur = 6;
          fc.fillText(f.txt, p.x + 48 * s, p.y - 14 * s - f.t * 22);
          fc.restore();
        }
        fc.globalAlpha = 1;
        /* a legenda de cada marcador diz o que está acontecendo na cena */
        cenas.forEach((S) => {
          if (S.poi && S.status !== S._ls) {
            S._ls = S.status;
            const e = mapaEl.querySelector(`.mk[data-id="${S.poi}"] .mk-st`);
            if (e) e.textContent = S.status;
          }
        });
      }
      seta();
      const pertoDaPraia =
        sAlpha > 0.5 &&
        praias.some((S) => {
          const p = m.P(S.a);
          return p.x > 0 && p.x < W && p.y > 0 && p.y < H;
        });
      contadorEl.classList.toggle('on', pertoDaPraia);
      contadorNum.textContent = itensRecolhidos;
    }
    nuvens.desenhar(dt);
    quadro = requestAnimationFrame(frame);
  }
  quadro = requestAnimationFrame(frame);

  const aoRedimensionar = () => {
    nuvens.medir();
    map.invalidateSize();
  };
  addEventListener('resize', aoRedimensionar);

  const duracao = (d) => (reduzir ? 0 : d);

  /* --------------------------------------------------------- comandos -- */
  return {
    /** Sai da capa: as nuvens abrem, o mapa voa até a ilha e fica livre. */
    entrar() {
      if (!emCapa) return;
      emCapa = false;
      nuvens.dispersar(1);
      INTERACOES.filter((h) => h !== 'boxZoom').forEach((h) => map[h].enable());
      if (celular()) {
        map.flyToBounds(ILHA, { duration: duracao(2.8), paddingTopLeft: [10, 150], paddingBottomRight: [10, 130] });
      } else {
        map.flyTo([-13.618, -38.925], 13.5, { duration: duracao(2.8), easeLinearity: 0.2 });
      }
    },
    /** De volta à capa, com as nuvens fechando. */
    voltarCapa() {
      emCapa = true;
      atual = null;
      fluxoAceso = -1;
      marcarAtivo(null);
      nuvens.dispersar(0);
      INTERACOES.forEach((h) => map[h].disable());
      map.flyTo(CENTRO_CAPA, zoomDaCapa(), { duration: duracao(2) });
    },
    /** Voa até um ponto, acende o marcador e a linha de fluxo dele. */
    focar(id) {
      const p = POIS.find((x) => x.id === id);
      atual = p || null;
      marcarAtivo(p ? id : null);
      fluxoAceso = p ? (FLUXO_DA_ETAPA[id] ?? -1) : -1;
      if (!p) return;
      const z = p.zoom || 16;
      const pt = map.project(p.ll, z);
      /* o ponto fica no centro da área visível, e não atrás do painel */
      const desvio = celular() ? L.point(0, innerHeight * 0.24) : L.point(larguraPainel() / 2, 0);
      const alvo = map.unproject(pt.add(desvio), z);
      const dist = map.distance(map.getCenter(), p.ll);
      if (dist > 1500) nuvens.passagem(Math.random() < 0.5 ? 1 : -1);
      map.flyTo(alvo, z, { duration: duracao(Math.min(3, 1.2 + dist / 4000)), easeLinearity: 0.25 });
    },
    /** Tira o destaque do ponto atual (o painel fechou). */
    soltar({ afastar } = {}) {
      atual = null;
      fluxoAceso = -1;
      marcarAtivo(null);
      if (afastar) map.flyTo(map.getCenter(), Math.min(map.getZoom(), 14), { duration: duracao(1.2) });
    },
    /** Troca o filtro e enquadra os pontos dele. */
    filtrar(f) {
      filtro = f;
      nuvens.passagem(1);
      const lista = POIS.filter((p) => p.g.includes(f));
      map.flyToBounds(L.latLngBounds(lista.map((p) => p.ll)).pad(0.35), {
        duration: duracao(1.8), maxZoom: 14.5, paddingBottomRight: [0, celular() ? 120 : 60],
      });
    },
    /** Só registra o filtro, sem voar (quando abrir um ponto troca o filtro). */
    usarFiltro(f) {
      filtro = f;
    },
    zoomMais: () => map.zoomIn(0.75),
    zoomMenos: () => map.zoomOut(0.75),
    visaoGeral() {
      nuvens.passagem(-1);
      map.flyToBounds(ILHA, { duration: duracao(1.8), padding: [40, 40] });
    },
    destruir() {
      cancelAnimationFrame(quadro);
      removeEventListener('resize', aoRedimensionar);
      nuvens.destruir();
      map.remove();
    },
  };
}
