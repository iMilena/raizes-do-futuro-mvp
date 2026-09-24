/* ---------------------------------------------------------------------------
   As cenas animadas do ciclo, desenhadas numa pane própria do Leaflet (entre
   as fotos de satélite e os marcadores).

   Cada cena é um objeto `{ update(dt), draw(c, s) }` e, quando tem legenda no
   marcador, `poi` e `status`. `update` avança o tempo; `draw` pinta no canvas,
   já convertendo lat/lng em pixel pelo `m.P` que o motor passa. Com menos
   movimento, o motor não chama `update`: a cena fica parada num quadro.

   `m` é o que as cenas precisam do mapa:
     P(ll)             lat/lng → ponto na tela
     distancia(a, b)   metros entre dois pontos
     flutuar(f)        solta um texto que sobe e some ({ ll, txt, col })
     contar()          +1 no contador de itens recolhidos da cena
--------------------------------------------------------------------------- */

import { L0, FLUXOS } from './dados.js';
import { SKIN, SHIRT, coin, drawCart, lerp, person, rnd, rr, sack, trash, zone } from './desenho.js';

const MLAT = 110574;
const mlon = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);
/** Desloca um ponto `e` metros para leste e `n` para norte. */
const off = (ll, e, n) => [ll[0] + n / MLAT, ll[1] + e / mlon(ll[0])];

function sentido(m, from, to) {
  const a = m.P(from);
  const b = m.P(to);
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
}

/* ------------------------------------------------ coleta na praia ---- */
function na(S, u, v) {
  const lat = lerp(S.a[0], S.b[0], u);
  const lng = lerp(S.a[1], S.b[1], u);
  return off([lat, lng], v * S.sea, 0);
}

/**
 * Coletores andando pela faixa de areia entre `a` e `b`, cada um indo até o
 * resíduo mais próximo à frente, abaixando e recolhendo. O mar devolve resíduo
 * novo de tempos em tempos.
 */
export function cenaPraia(m, a, b, nPessoas, ladoDoMar) {
  const S = { a, b, len: m.distancia(a, b), items: [], walkers: [], sea: ladoDoMar, spawnT: 0 };
  const soltar = () =>
    S.items.push({ u: rnd(0.05, 0.95), v: rnd(-6, 9), k: (Math.random() * 3) | 0, r: rnd(0, 6.28), alive: 1 });
  for (let i = 0; i < 11; i++) soltar();
  for (let i = 0; i < nPessoas; i++) {
    S.walkers.push({
      u: rnd(0.1, 0.9), v: rnd(-2, 4), dir: Math.random() < 0.5 ? 1 : -1, st: 'walk', t: 0, ph: rnd(0, 6), bag: 0,
      shirt: i % 2 ? '#7fd99a' : '#f3b267', skin: SKIN[i % SKIN.length], hat: i % 2 ? '#fbf5e3' : null, sp: rnd(4.2, 5.6),
    });
  }
  S.update = (dt) => {
    S.spawnT += dt;
    if (S.spawnT > 2.4 && S.items.filter((x) => x.alive).length < 12) {
      S.spawnT = 0;
      soltar();
    }
    S.walkers.forEach((w) => {
      if (w.st === 'pick') {
        w.t -= dt;
        if (w.t <= 0) {
          w.it.alive = 0;
          w.bag++;
          m.contar();
          m.flutuar({ ll: na(S, w.u, w.v), txt: '+1' });
          w.st = 'walk';
          w.it = null;
        }
        return;
      }
      let best = null;
      let bd = 1e9;
      S.items.forEach((it) => {
        if (!it.alive || it.claimed) return;
        const d = (it.u - w.u) * w.dir;
        if (d >= -0.005 && d < bd) {
          bd = d;
          best = it;
        }
      });
      if (!best && !w.it) {
        w.dir *= -1;
        return;
      }
      if (!w.it) {
        w.it = best;
        best.claimed = 1;
      }
      const it = w.it;
      const du = (it.u - w.u) * S.len;
      const dv = it.v - w.v;
      const dist = Math.hypot(du, dv);
      if (dist < 1.4) {
        w.st = 'pick';
        w.t = 0.85;
        it.claimed = 0;
        return;
      }
      const st = Math.min(dist, w.sp * dt);
      w.u += ((du / dist) * st) / S.len;
      w.v += (dv / dist) * st;
      w.ph += dt * 9;
      w.dir = du >= 0 ? 1 : -1;
      if (w.u < 0.02 || w.u > 0.98) w.dir *= -1;
    });
  };
  S.draw = (c, s) => {
    S.items.forEach((it) => {
      if (!it.alive) return;
      const p = m.P(na(S, it.u, it.v));
      trash(c, p.x, p.y, s * 1.15, it.k, it.r);
    });
    S.walkers
      .slice()
      .sort((x, y) => x.v - y.v)
      .forEach((w) => {
        const p = m.P(na(S, w.u, w.v));
        const scr = m.P(na(S, w.u + 0.01 * w.dir, w.v));
        person(c, p.x, p.y, s, {
          dir: scr.x >= p.x ? 1 : -1, ph: w.ph, walk: w.st === 'walk' ? 1 : 0,
          bend: w.st === 'pick' ? Math.sin((1 - w.t / 0.85) * Math.PI) : 0,
          shirt: w.shirt, skin: w.skin, hat: w.hat, bag: w.bag > 0, tool: 1, vest: 1,
        });
      });
  };
  return S;
}

/* ------------------------------------------------ pesagem e IA ---- */
export function cenaPesagem(m, ll) {
  const S = { ll, poi: 'pesagem', t: 0, ph: 0, status: '', fl: 0 };
  S.update = (dt) => {
    S.t = (S.t + dt) % 12;
    S.ph += dt * 9;
  };
  S.draw = (c, s) => {
    const p = m.P(ll);
    const t = S.t;
    zone(c, p, 46 * s, 20 * s, '127,217,154', performance.now() / 1000, t > 7.4 && t < 10);
    const din = sentido(m, L0.pesagem, L0.cueira);
    for (let i = 0; i < 4; i++) sack(c, p.x + (18 + i * 6) * s, p.y + (-6 + (i % 2) * 6) * s, s * 0.95, i % 2 ? '#e4dcc2' : '#ece5cf');
    /* a balança, com o visor aceso durante a pesagem */
    c.save();
    c.translate(p.x - 6 * s, p.y);
    c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.beginPath();
    c.ellipse(0, 1, 9, 2.5, 0, 0, 7);
    c.fill();
    c.fillStyle = '#8f9c97';
    rr(c, -8, -2.5, 16, 3.5, 1);
    c.fill();
    c.fillStyle = '#cfd6d9';
    c.fillRect(6, -13, 1.6, 11);
    c.fillStyle = '#0a2720';
    rr(c, 2, -19, 10, 6.5, 1.5);
    c.fill();
    const aceso = t > 3 && t < 10.5;
    c.fillStyle = aceso ? '#7fd99a' : '#40584f';
    c.font = '800 4.6px "Manrope Variable", Manrope, sans-serif';
    c.textAlign = 'center';
    c.fillText(aceso ? '12,4' : '0,0', 7, -14.3);
    c.restore();
    /* o coletor chega da praia com o saco, espera e volta */
    let wx;
    let wy;
    let walk = 0;
    let dir;
    let bag = false;
    const sx = p.x + din.x * 70 * s;
    const sy = p.y + din.y * 40 * s + 8 * s;
    const tx = p.x - 18 * s;
    const ty = p.y + 4 * s;
    if (t < 3) {
      const k = t / 3;
      wx = lerp(sx, tx, k);
      wy = lerp(sy, ty, k);
      walk = 1;
      bag = true;
      dir = tx > sx ? 1 : -1;
    } else if (t < 10.5) {
      wx = tx;
      wy = ty;
      dir = 1;
    } else {
      const k = (t - 10.5) / 1.5;
      wx = lerp(tx, sx, k);
      wy = lerp(ty, sy, k);
      walk = 1;
      dir = sx > tx ? 1 : -1;
    }
    if (t >= 3) sack(c, p.x - 6 * s, p.y - 2.5 * s, s, '#f4eedb');
    person(c, wx, wy, s, { dir, ph: S.ph, walk, bag, shirt: '#f3b267', skin: SKIN[1], hat: '#0a2720', vest: 1 });
    person(c, p.x + 6 * s, p.y + 12 * s, s, { dir: -1, ph: 0, walk: 0, shirt: '#7fd99a', skin: SKIN[3], phone: t > 4.5 && t < 10, vest: 1 });
    /* a moldura da IA varrendo a foto */
    if (t > 4.8 && t < 7.4) {
      const k = ((t - 4.8) * 1.4) % 1;
      c.save();
      c.strokeStyle = 'rgba(127,217,154,.9)';
      c.lineWidth = 1.2;
      c.strokeRect(p.x - 12 * s, p.y - 12 * s, 12 * s, 11 * s);
      c.fillStyle = 'rgba(127,217,154,.35)';
      c.fillRect(p.x - 12 * s, p.y - 12 * s + k * 11 * s, 12 * s, 1.6 * s);
      c.restore();
    }
    if (t > 7.4 && t < 7.5 && !S.fl) {
      S.fl = 1;
      m.flutuar({ ll, txt: '+12,4 kg validados', col: '#7fd99a' });
    }
    if (t < 7) S.fl = 0;
    S.status = t < 3 ? 'Material chegando da praia' : t < 4.8 ? 'Pesando: 12,4 kg' : t < 7.4 ? 'IA conferindo a foto' : 'Coleta validada';
  };
  return S;
}

/* ------------------------------------------------ roda do Vivá ---- */
export function cenaRoda(m, ll) {
  const S = { ll, poi: 'viva', t: 0, status: '' };
  const ppl = [...Array(7)].map((_, i) => ({ a: (i / 7) * Math.PI * 2 + 0.3, sh: SHIRT[(i + 2) % SHIRT.length], sk: SKIN[i % 5] }));
  S.update = (dt) => {
    S.t += dt;
  };
  S.draw = (c, s) => {
    const p = m.P(ll);
    zone(c, p, 38 * s, 17 * s, '243,178,103', S.t);
    const R = 16 * s;
    const fala = Math.floor(S.t / 2.4) % ppl.length;
    ppl
      .map((q, i) => ({ q, i, x: p.x + Math.cos(q.a) * R, y: p.y + Math.sin(q.a) * R * 0.45 }))
      .sort((u, v) => u.y - v.y)
      .forEach(({ q, i, x, y }) => {
        person(c, x, y, s * 0.92, { dir: Math.cos(q.a) > 0 ? -1 : 1, ph: S.t * 3, walk: 0, shirt: q.sh, skin: q.sk, wave: i === fala, phone: i === 0 });
        if (i === fala) {
          c.save();
          c.fillStyle = 'rgba(251,245,227,.95)';
          rr(c, x - 7 * s, y - 30 * s, 14 * s, 7 * s, 3.5 * s);
          c.fill();
          c.fillStyle = '#0a2720';
          for (let d = 0; d < 3; d++) {
            c.globalAlpha = 0.35 + 0.65 * ((Math.floor(S.t * 3) + d) % 3 === 0);
            c.beginPath();
            c.arc(x + (-3.5 + d * 3.5) * s, y - 26.5 * s, 0.9 * s, 0, 7);
            c.fill();
          }
          c.restore();
        }
      });
    S.status = Math.floor(S.t / 5) % 2 ? 'Validando comprovações das crianças' : 'Roda com as famílias parceiras';
  };
  return S;
}

/* ------------------------------------------------ feira em Moreré ---- */
export function cenaFeira(m, ll) {
  const S = { ll, poi: 'feira', t: 0, ph: 0, status: '' };
  S.update = (dt) => {
    S.t = (S.t + dt) % 10;
    S.ph += dt * 9;
  };
  S.draw = (c, s) => {
    const p = m.P(ll);
    const t = S.t;
    zone(c, p, 44 * s, 19 * s, '243,178,103', performance.now() / 1000, t > 4 && t < 7);
    person(c, p.x - 3 * s, p.y - 4 * s, s * 0.9, { dir: 1, shirt: '#d97742', skin: SKIN[0], wave: t > 4 && t < 5.4, ph: S.ph, hat: '#fbf5e3' });
    /* a banca, com toldo listrado, as peças e o QR */
    c.save();
    c.translate(p.x, p.y);
    c.scale(s * 0.85, s * 0.85);
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.beginPath();
    c.ellipse(0, 2, 21, 4, 0, 0, 7);
    c.fill();
    c.fillStyle = '#6b4a2e';
    c.fillRect(-18, -18, 2, 18);
    c.fillRect(16, -18, 2, 18);
    c.fillStyle = '#8a6a48';
    c.fillRect(-18, -9, 36, 8);
    c.fillStyle = 'rgba(0,0,0,.2)';
    c.fillRect(-18, -2, 36, 1.5);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = i % 2 ? '#fbf5e3' : '#2e5a3e';
      c.beginPath();
      c.moveTo(-20 + i * 6.7, -21);
      c.lineTo(-13.3 + i * 6.7, -21);
      c.lineTo(-13.3 + i * 6.7, -17);
      c.quadraticCurveTo(-16.6 + i * 6.7, -14.5, -20 + i * 6.7, -17);
      c.fill();
    }
    ['#7fd99a', '#f3b267', '#cfedd9', '#d97742'].forEach((col, i) => {
      c.fillStyle = col;
      rr(c, -14 + i * 7, -13, 5, 4, 1);
      c.fill();
    });
    c.fillStyle = '#fff';
    c.fillRect(12, -14, 5, 5);
    c.fillStyle = '#0a2720';
    c.fillRect(13, -13, 1.3, 1.3);
    c.fillRect(15, -13, 1, 1);
    c.fillRect(13, -11, 1, 1);
    c.fillRect(14.6, -11.2, 1.4, 1.4);
    c.restore();
    /* dois turistas chegam, compram e vão embora; a moeda voa para o cofre */
    const k = t < 3.5 ? t / 3.5 : t < 6.5 ? 1 : 1 - (t - 6.5) / 3.5;
    const tx = p.x + lerp(58, 20, k) * s;
    const ty = p.y + 11 * s;
    const andando = t < 3.5 || t > 6.5;
    const dir = t < 3.5 ? -1 : t > 6.5 ? 1 : -1;
    person(c, tx, ty, s, { dir, ph: S.ph, walk: andando ? 1 : 0, shirt: '#9ec5e8', skin: '#e0b48f', hat: '#f3b267' });
    person(c, tx + 9 * s, ty + 3 * s, s * 0.95, { dir, ph: S.ph + 1, walk: andando ? 1 : 0, shirt: '#fbf5e3', skin: '#c99474' });
    if (t > 4.2 && t < 7) {
      const u = (t - 4.2) / 2.8;
      const d = sentido(m, L0.feira, L0.cofre);
      coin(c, p.x + d.x * u * 90 * s, p.y - 16 * s + d.y * u * 50 * s - Math.sin(u * Math.PI) * 22 * s, s, 1 - u * 0.6);
    }
    S.status = t < 4 ? 'Peças feitas com resíduo local' : t < 7 ? 'Venda registrada no QR' : 'Receita segue para o cofre';
  };
  return S;
}

/* ------------------------------------------------ escola ---- */
export function cenaEscola(m, ll) {
  const S = {
    ll, poi: 'escola', t: 0, status: '', fl: 0,
    kids: [...Array(5)].map((_, i) => ({
      o: i * 1.1, sh: SHIRT[i % 6], bp: ['#d97742', '#2e5a3e', '#9ec5e8', '#f3b267', '#7fd99a'][i], sk: SKIN[(i + 1) % 5],
    })),
  };
  S.update = (dt) => {
    S.t = (S.t + dt) % 14;
  };
  S.draw = (c, s) => {
    const p = m.P(ll);
    const t = S.t;
    const bonus = t > 9.5 && t < 13.5;
    zone(c, p, 42 * s, 19 * s, bonus ? '243,178,103' : '127,217,154', performance.now() / 1000, bonus);
    const sx = p.x - 64 * s;
    const sy = p.y + 16 * s;
    /* crianças de mochila chegando à escola */
    S.kids.forEach((k) => {
      const u = (t * 0.16 + k.o * 0.12) % 1;
      if (u > 0.92) return;
      const x = lerp(sx, p.x - 6 * s, u);
      const y = lerp(sy, p.y + 4 * s, u) + Math.sin(k.o * 3) * 3 * s;
      c.save();
      c.globalAlpha *= u > 0.8 ? 1 - (u - 0.8) / 0.12 : 1;
      person(c, x, y, s * 0.66, { dir: 1, ph: t * 10 + k.o * 2, walk: 1, shirt: k.sh, skin: k.sk, bag: false });
      c.fillStyle = k.bp;
      rr(c, x - 5 * s * 0.66, y - 17 * s * 0.66, 3.6 * s * 0.66, 6 * s * 0.66, 1.2);
      c.fill();
      c.restore();
    });
    person(c, p.x + 14 * s, p.y + 8 * s, s, { dir: -1, ph: 0, walk: 0, shirt: '#7fd99a', skin: SKIN[2], phone: t < 9.5, vest: 1 });
    /* o bônus chegando do cofre */
    if (t > 8.2 && t < 9.8) {
      const u = (t - 8.2) / 1.6;
      const d = sentido(m, L0.escola, L0.cofre);
      coin(c, p.x + d.x * (1 - u) * 110 * s, p.y - 6 * s + d.y * (1 - u) * 60 * s - Math.sin(u * Math.PI) * 26 * s, s * 1.1, 1);
    }
    if (t > 9.8 && t < 9.9 && !S.fl) {
      S.fl = 1;
      m.flutuar({ ll, txt: 'Bônus liberado', col: '#f3b267' });
    }
    if (t < 9) S.fl = 0;
    const passos = ['Vacinação comprovada', 'Matrícula comprovada', 'Frequência comprovada'];
    S.status = t < 8.2 ? passos[Math.min(2, Math.floor(t / 2.7))] : t < 9.8 ? 'Cofre liberando o bônus' : 'R$ 30 por criança liberados';
  };
  return S;
}

/* ------------------------------------------------ fluxos e cofre ---- */
function bez(a, b, bend) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return { a, b, c: { x: mx - dy * bend, y: my + dx * bend } };
}
function bp(q, t) {
  const u = 1 - t;
  return { x: u * u * q.a.x + 2 * u * t * q.c.x + t * t * q.b.x, y: u * u * q.a.y + 2 * u * t * q.c.y + t * t * q.b.y };
}

/**
 * As cinco linhas de fluxo entre as etapas, com partículas correndo e, de
 * perto, carrinhos levando o material nas duas primeiras. `hi` é o índice da
 * linha acesa (a da etapa aberta), ou -1.
 */
export function desenharFluxos(m, c, z, alpha, tempo, hi) {
  if (alpha <= 0) return;
  FLUXOS.forEach((f, i) => {
    const q = bez(m.P(f.a), m.P(f.b), 0.22);
    const aceso = hi === i;
    c.save();
    c.globalAlpha = alpha * (hi < 0 || aceso ? 1 : 0.35);
    c.strokeStyle = `rgba(${f.col},.55)`;
    c.lineWidth = aceso ? 2.4 : 1.4;
    c.setLineDash([2, 6]);
    c.lineDashOffset = -tempo * 30;
    c.beginPath();
    c.moveTo(q.a.x, q.a.y);
    c.quadraticCurveTo(q.c.x, q.c.y, q.b.x, q.b.y);
    c.stroke();
    c.setLineDash([]);
    for (let k = 0; k < 5; k++) {
      const t = (tempo * 0.18 + k / 5) % 1;
      const pt = bp(q, t);
      const g = c.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 7);
      g.addColorStop(0, `rgba(${f.col},1)`);
      g.addColorStop(1, `rgba(${f.col},0)`);
      c.fillStyle = g;
      c.beginPath();
      c.arc(pt.x, pt.y, 7, 0, 7);
      c.fill();
    }
    if (z < 15.2) {
      const meio = bp(q, 0.5);
      c.font = '800 10px "Manrope Variable", Manrope, sans-serif';
      c.textAlign = 'center';
      c.fillStyle = `rgba(${f.col},1)`;
      c.shadowColor = 'rgba(0,0,0,.9)';
      c.shadowBlur = 6;
      c.fillText(f.lbl.toUpperCase(), meio.x, meio.y - 8);
    }
    c.restore();
    if (i < 2 && z >= 13.6) {
      const cs = Math.max(0.6, Math.min(1.4, Math.pow(2, z - 16) * 1.1));
      for (let k = 0; k < (i === 0 ? 2 : 1); k++) {
        const t = (tempo * 0.035 + k * 0.5 + i * 0.3) % 1;
        const pt = bp(q, t);
        const pt2 = bp(q, Math.min(1, t + 0.01));
        c.save();
        c.globalAlpha = alpha * Math.min(1, Math.sin(t * Math.PI) * 4);
        drawCart(c, pt.x, pt.y, cs, pt2.x >= pt.x ? 1 : -1, tempo * 9);
        c.restore();
      }
    }
  });
}

/** O cofre no mar: hexágono girando e as três assinaturas (duas acesas). */
export function desenharCofre(m, c, t) {
  const p = m.P(L0.cofre);
  c.save();
  c.translate(p.x, p.y);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 60);
  g.addColorStop(0, 'rgba(243,178,103,.35)');
  g.addColorStop(1, 'rgba(243,178,103,0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, 60, 0, 7);
  c.fill();
  c.rotate(t * 0.3);
  c.strokeStyle = 'rgba(243,178,103,.9)';
  c.lineWidth = 1.4;
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 6.28;
    c.lineTo(Math.cos(a) * 26, Math.sin(a) * 26);
  }
  c.closePath();
  c.stroke();
  c.rotate(-t * 0.6);
  c.setLineDash([3, 5]);
  c.strokeStyle = 'rgba(251,245,227,.5)';
  c.beginPath();
  c.arc(0, 0, 40, 0, 7);
  c.stroke();
  c.setLineDash([]);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * 6.28;
    c.fillStyle = i < 2 ? '#7fd99a' : 'rgba(251,245,227,.35)';
    c.beginPath();
    c.arc(Math.cos(a) * 40, Math.sin(a) * 40, 4.5, 0, 7);
    c.fill();
  }
  c.restore();
}
