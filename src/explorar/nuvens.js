/* ---------------------------------------------------------------------------
   As nuvens procedurais, num canvas por cima do mapa.

   Cada nuvem é um sprite pintado uma vez só, no começo: dezenas de "puffs"
   (gradientes radiais) agrupados em cinco bolhas, com uma cópia desfocada e
   escurecida por baixo que faz a sombra no chão. Na capa, as nuvens cobrem os
   lados da ilha; ao entrar, `dispersar()` as empurra para fora da tela, e só
   algumas ficam, bem transparentes. `passagem()` atravessa um bando rápido de
   nuvens na tela, que é a transição entre um ponto e outro do mapa.
--------------------------------------------------------------------------- */

import { lerp, rnd } from './desenho.js';

/** Soma de três sorteios: uma distribuição aproximadamente normal em [-1, 1]. */
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

function criarSprite(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  const puff = (px, py, r, a, col) => {
    const gr = x.createRadialGradient(px, py, 0, px, py, r);
    gr.addColorStop(0, `rgba(${col},${a})`);
    gr.addColorStop(0.6, `rgba(${col},${a * 0.55})`);
    gr.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = gr;
    x.beginPath();
    x.arc(px, py, r, 0, 7);
    x.fill();
  };
  const bolhas = [...Array(5)].map(() => ({ x: w / 2 + gauss() * w * 0.22, y: h / 2 + gauss() * h * 0.14, r: w * rnd(0.12, 0.2) }));
  bolhas.forEach((b) => puff(b.x, b.y, b.r * 1.5, 0.16, '236,240,238'));
  for (let i = 0; i < 260; i++) {
    const b = bolhas[i % bolhas.length];
    const a = Math.random() * 6.28;
    const d = Math.pow(Math.random(), 0.7) * b.r;
    const px = b.x + Math.cos(a) * d * 1.3;
    const py = b.y + Math.sin(a) * d * 0.8;
    const r = w * rnd(0.018, 0.06) * (1 - (d / b.r) * 0.5);
    puff(px, py, r, rnd(0.12, 0.32), py < b.y ? '255,255,255' : '226,232,230');
  }
  for (let i = 0; i < 90; i++) {
    const b = bolhas[i % bolhas.length];
    puff(b.x + gauss() * b.r * 2.2, b.y + gauss() * b.r * 1.1, w * rnd(0.01, 0.03), rnd(0.05, 0.14), '255,255,255');
  }
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const o = out.getContext('2d');
  o.filter = 'blur(2.5px)';
  o.drawImage(c, 0, 0);
  const sh = document.createElement('canvas');
  sh.width = w;
  sh.height = h;
  const sx = sh.getContext('2d');
  sx.filter = 'blur(18px)';
  sx.drawImage(c, 0, 0);
  sx.filter = 'none';
  sx.globalCompositeOperation = 'source-in';
  sx.fillStyle = 'rgb(2,14,10)';
  sx.fillRect(0, 0, w, h);
  return { c: out, sh };
}

/**
 * Monta as nuvens no `canvas` e devolve os controles.
 * `reduzir`: com menos movimento, as nuvens não andam e não há passagens.
 */
export function criarNuvens(canvas, { reduzir, celular, dpr }) {
  const cc = canvas.getContext('2d');
  let CW = 0;
  let CH = 0;
  const SPR = [...Array(7)].map(() => criarSprite(560, 360));
  let nuvens = [];
  const passes = [];
  let disperse = 0;
  let alvo = 0;
  let mx = 0.5;
  let my = 0.5;

  function medir() {
    CW = innerWidth;
    CH = innerHeight;
    canvas.width = CW * dpr;
    canvas.height = CH * dpr;
  }

  function semear() {
    nuvens = [];
    const m = celular();
    const n = m ? 11 : 16;
    for (let i = 0; i < n; i++) {
      const lado = i % 2 ? 1 : -1;
      const bx = 0.5 + lado * (m ? rnd(0.42, 0.75) : rnd(0.26, 0.62));
      nuvens.push({
        spr: SPR[i % SPR.length], bx, by: rnd(-0.05, 1.05), s: rnd(1.1, 2.3) * (m ? 0.62 : 1),
        a: rnd(0.75, 1), vx: rnd(6, 14), dx: 0, depth: rnd(0.5, 1.4), keep: Math.random() < 0.4,
      });
    }
    for (let i = 0; i < 3; i++) {
      nuvens.push({
        spr: SPR[i], bx: rnd(0.35, 0.65), by: rnd(-0.1, 0.05) + (i === 2 ? 1.02 : 0), s: rnd(1, 1.6) * (m ? 0.6 : 1),
        a: 0.6, vx: rnd(5, 10), dx: 0, depth: 1, keep: false,
      });
    }
  }

  medir();
  semear();

  const pintar = (spr, x, y, s, a, depth) => {
    const w = spr.c.width * s;
    const h = spr.c.height * s;
    cc.globalAlpha = a * 0.4;
    cc.globalCompositeOperation = 'multiply';
    cc.drawImage(spr.sh, x - w / 2 + 40 * depth, y - h / 2 + 60 * depth, w, h);
    cc.globalCompositeOperation = 'source-over';
    cc.globalAlpha = a;
    cc.drawImage(spr.c, x - w / 2, y - h / 2, w, h);
  };

  function desenhar(dt) {
    cc.setTransform(dpr, 0, 0, dpr, 0, 0);
    cc.clearRect(0, 0, CW, CH);
    disperse += (alvo - disperse) * Math.min(1, dt * 1.5);
    const d = disperse;
    nuvens.forEach((k) => {
      if (!reduzir) k.dx += k.vx * dt * (1 + d);
      let x = k.bx * CW + k.dx;
      const span = CW * 1.9;
      x = (((x + CW * 0.45) % span) + span) % span - CW * 0.45;
      const y = k.by * CH;
      const cx = CW / 2;
      const cy = CH / 2;
      const f = 1 + d * 1.4;
      const X = cx + (x - cx) * f + (mx - 0.5) * -30 * k.depth;
      const Y = cy + (y - cy) * f + (my - 0.5) * -20 * k.depth;
      const alpha = k.a * (1 - d * (k.keep ? 0.72 : 1));
      if (alpha < 0.01) return;
      pintar(k.spr, X, Y, k.s * (1 + d * 0.9), alpha, k.depth);
    });
    for (let i = passes.length - 1; i >= 0; i--) {
      const p = passes[i];
      p.t += dt;
      const u = p.t / p.dur;
      if (u >= 1) {
        passes.splice(i, 1);
        continue;
      }
      const x = (p.dir > 0 ? lerp(-0.5, 1.5, u) : lerp(1.5, -0.5, u)) * CW;
      pintar(p.spr, x, p.y * CH, p.s, Math.sin(u * Math.PI) * 0.9, 1.3);
    }
    cc.globalAlpha = 1;
  }

  const aoMover = (e) => {
    mx = e.clientX / innerWidth;
    my = e.clientY / innerHeight;
  };
  addEventListener('pointermove', aoMover, { passive: true });

  return {
    desenhar,
    medir,
    /** 1 abre as nuvens para os lados (entrar); 0 fecha de volta (capa). */
    dispersar: (v) => {
      alvo = v;
    },
    /** Um bando de nuvens atravessa a tela, da esquerda (1) ou da direita (-1). */
    passagem(dir) {
      if (reduzir) return;
      for (let i = 0; i < 5; i++) {
        passes.push({
          spr: SPR[(Math.random() * 7) | 0], x: 0, y: rnd(0.05, 0.95), s: rnd(1.8, 3), t: 0, dur: rnd(1.5, 2.1), dir,
        });
      }
    },
    destruir() {
      removeEventListener('pointermove', aoMover);
    },
  };
}
