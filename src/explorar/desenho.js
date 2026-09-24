/* ---------------------------------------------------------------------------
   Os desenhos pequenos das cenas, em canvas 2D: bonecos, resíduos, sacos,
   moedas, carrinhos, barcos e as zonas marcadas no chão.

   Tudo é desenhado em coordenadas locais e escalado por `s`, que cresce com o
   zoom do mapa: de longe os bonecos somem, de perto ficam do tamanho de uma
   pessoa na foto de satélite. Nenhum prédio é desenhado: as cenas acontecem
   sobre zonas no chão, em cima da foto real.
--------------------------------------------------------------------------- */

export const SKIN = ['#6b4430', '#8a5a3c', '#5a3825', '#a0694a', '#7a4b32'];
export const SHIRT = ['#7fd99a', '#f3b267', '#fbf5e3', '#d97742', '#cfedd9', '#5fb07c'];

export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a, b) => a + Math.random() * (b - a);

/** Retângulo de cantos arredondados (o `roundRect` nativo ainda falta em alguns). */
export function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/**
 * Um boneco. `o` descreve a pose: `dir` (1 ou -1), `ph` (fase do passo),
 * `walk` (0 ou 1), `bend` (0 a 1, abaixando), e os acessórios `bag`, `hat`,
 * `tool`, `phone`, `vest`, `wave`.
 */
export function person(c, x, y, s, o) {
  c.save();
  c.translate(x, y);
  c.scale(s * (o.dir || 1), s);
  c.fillStyle = 'rgba(0,0,0,.38)';
  c.beginPath();
  c.ellipse(0, 0, 7.5, 2.6, 0, 0, 7);
  c.fill();
  const sw = Math.sin(o.ph || 0) * (o.walk || 0);
  c.lineCap = 'round';
  c.strokeStyle = o.pants || '#1d2b33';
  c.lineWidth = 2.6;
  c.beginPath();
  c.moveTo(0, -9);
  c.lineTo(sw * 4.5, 0);
  c.moveTo(0, -9);
  c.lineTo(-sw * 4.5, 0);
  c.stroke();
  c.translate(0, -9);
  c.rotate((o.bend || 0) * 0.95);
  if (o.bag) {
    c.fillStyle = '#ece5cf';
    c.beginPath();
    c.ellipse(-5, -5, 3.6, 4.4, -0.3, 0, 7);
    c.fill();
    c.fillStyle = 'rgba(0,0,0,.15)';
    c.fillRect(-6, -9.5, 2.4, 1.6);
  }
  c.fillStyle = o.shirt;
  rr(c, -3.4, -11, 6.8, 11, 2.8);
  c.fill();
  if (o.vest) {
    c.fillStyle = 'rgba(4,16,13,.25)';
    c.fillRect(-3.4, -6, 6.8, 1.2);
  }
  c.fillStyle = o.skin;
  c.beginPath();
  c.arc(0.6, -14, 3.3, 0, 7);
  c.fill();
  if (o.hat) {
    c.fillStyle = o.hat;
    c.beginPath();
    c.arc(0.6, -15, 3.5, Math.PI, 0);
    c.fill();
    c.fillRect(0.6, -15.4, 5, 1.3);
  }
  const b = o.bend || 0;
  const ax = 3.5 + b * 2.5 + (o.wave ? Math.sin(o.ph * 2) * 2 : 0);
  const ay = -3 + b * 6 + (o.wave ? -10 : 0);
  c.strokeStyle = o.skin;
  c.lineWidth = 1.8;
  c.beginPath();
  c.moveTo(0.5, -9);
  c.lineTo(ax, ay);
  c.stroke();
  if (o.tool) {
    c.strokeStyle = '#dfe6e2';
    c.lineWidth = 1.1;
    c.beginPath();
    c.moveTo(ax, ay);
    c.lineTo(ax + 3 + b * 2, ay + 6 + b * 3);
    c.stroke();
  }
  if (o.phone) {
    c.fillStyle = '#111';
    rr(c, ax - 1, ay - 4, 3, 5, 0.8);
    c.fill();
    c.fillStyle = 'rgba(127,217,154,.9)';
    c.fillRect(ax - 0.4, ay - 3.3, 1.8, 3.4);
  }
  c.restore();
}

/** Um resíduo na areia: 0 garrafa PET, 1 lata de alumínio, 2 garrafa de vidro. */
export function trash(c, x, y, s, k, rot) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.rotate(rot);
  c.fillStyle = 'rgba(0,0,0,.3)';
  c.beginPath();
  c.ellipse(0, 1.2, 3.4, 1.2, 0, 0, 7);
  c.fill();
  if (k === 0) {
    c.fillStyle = 'rgba(120,200,255,.95)';
    rr(c, -3.4, -1.3, 6.2, 2.6, 1.2);
    c.fill();
    c.fillStyle = '#e8f4ff';
    c.fillRect(2.6, -0.7, 1.2, 1.4);
  } else if (k === 1) {
    c.fillStyle = '#cfd6d9';
    rr(c, -1.8, -2.4, 3.6, 4.2, 1);
    c.fill();
    c.fillStyle = '#d97742';
    c.fillRect(-1.8, -0.6, 3.6, 1);
  } else {
    c.fillStyle = 'rgba(90,190,110,.95)';
    rr(c, -3, -1.1, 5.2, 2.2, 1);
    c.fill();
    c.fillRect(2, -0.5, 1.6, 1);
  }
  c.restore();
}

/** A zona marcada no chão: halo, contorno tracejado que gira e um pulso. */
export function zone(c, p, rx, ry, col, t, hi) {
  c.save();
  const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, rx);
  g.addColorStop(0, `rgba(${col},${hi ? 0.3 : 0.2})`);
  g.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(p.x, p.y, rx, ry, 0, 0, 7);
  c.fill();
  c.strokeStyle = `rgba(${col},.85)`;
  c.lineWidth = 1.3;
  c.setLineDash([5, 5]);
  c.lineDashOffset = -t * 14;
  c.beginPath();
  c.ellipse(p.x, p.y, rx * 0.82, ry * 0.82, 0, 0, 7);
  c.stroke();
  c.setLineDash([]);
  const k = (t * 0.45) % 1;
  c.strokeStyle = `rgba(${col},${0.6 * (1 - k)})`;
  c.beginPath();
  c.ellipse(p.x, p.y, rx * (0.3 + k * 0.7), ry * (0.3 + k * 0.7), 0, 0, 7);
  c.stroke();
  c.restore();
}

export function sack(c, x, y, s, shade) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = 'rgba(0,0,0,.32)';
  c.beginPath();
  c.ellipse(0, 0.5, 5, 1.8, 0, 0, 7);
  c.fill();
  c.fillStyle = shade || '#ece5cf';
  c.beginPath();
  c.moveTo(-4, 0);
  c.quadraticCurveTo(-5, -7, -1.5, -8.5);
  c.lineTo(1.5, -8.5);
  c.quadraticCurveTo(5, -7, 4, 0);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(0,0,0,.25)';
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(-1.6, -8.2);
  c.lineTo(1.6, -8.2);
  c.stroke();
  c.restore();
}

export function coin(c, x, y, s, a) {
  c.save();
  c.globalAlpha *= a;
  c.fillStyle = 'rgba(0,0,0,.25)';
  c.beginPath();
  c.ellipse(x, y + 5 * s, 3.5 * s, 1.2 * s, 0, 0, 7);
  c.fill();
  const g = c.createRadialGradient(x - 1 * s, y - 1 * s, 0, x, y, 4 * s);
  g.addColorStop(0, '#ffe2a8');
  g.addColorStop(1, '#e59a3c');
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, 3.6 * s, 0, 7);
  c.fill();
  c.restore();
}

/** Um carrinho de mão com dois sacos, empurrado por um coletor. */
export function drawCart(c, x, y, s, dir, ph) {
  c.save();
  c.translate(x, y);
  c.scale(s * dir, s);
  c.fillStyle = 'rgba(0,0,0,.35)';
  c.beginPath();
  c.ellipse(4, 0, 12, 2.6, 0, 0, 7);
  c.fill();
  c.fillStyle = '#2e5a3e';
  c.beginPath();
  c.moveTo(3, -9);
  c.lineTo(17, -9);
  c.lineTo(14, -3);
  c.lineTo(5, -3);
  c.closePath();
  c.fill();
  c.fillStyle = '#ece5cf';
  c.beginPath();
  c.ellipse(8, -11, 3.4, 3, 0, 0, 7);
  c.fill();
  c.beginPath();
  c.ellipse(12.5, -11.5, 3, 2.8, 0, 0, 7);
  c.fill();
  c.strokeStyle = '#1d2b33';
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(14, -1.6, 1.8, 0, 7);
  c.stroke();
  c.beginPath();
  c.moveTo(4, -6);
  c.lineTo(-1, -8);
  c.stroke();
  c.restore();
  person(c, x - 4 * s * dir, y, s, { dir, ph, walk: 1, shirt: '#7fd99a', skin: SKIN[4], hat: '#fbf5e3', vest: 1 });
}

/** Um barco indo e voltando, com a esteira. `P` converte lat/lng em pixel. */
export function drawBoat(c, b, s, dt, P) {
  b.t += dt * b.sp;
  const u = (Math.sin(b.t * Math.PI * 2) + 1) / 2;
  const ll = [lerp(b.a[0], b.b[0], u), lerp(b.a[1], b.b[1], u)];
  const p = P(ll);
  const q = P(b.b);
  const r = P(b.a);
  const ang = Math.atan2(q.y - r.y, q.x - r.x) + (Math.cos(b.t * Math.PI * 2) < 0 ? Math.PI : 0);
  c.save();
  c.translate(p.x, p.y);
  c.rotate(ang);
  c.scale(s, s);
  c.strokeStyle = 'rgba(255,255,255,.45)';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-10, -2);
  c.quadraticCurveTo(-22, -6, -34, -10);
  c.moveTo(-10, 2);
  c.quadraticCurveTo(-22, 6, -34, 10);
  c.stroke();
  c.fillStyle = 'rgba(0,0,0,.3)';
  c.beginPath();
  c.ellipse(1, 2, 11, 4, 0, 0, 7);
  c.fill();
  c.fillStyle = '#f4efe2';
  c.beginPath();
  c.moveTo(12, 0);
  c.quadraticCurveTo(4, -5, -10, -4);
  c.lineTo(-10, 4);
  c.quadraticCurveTo(4, 5, 12, 0);
  c.fill();
  c.fillStyle = '#2e5a3e';
  c.fillRect(-6, -2.2, 6, 4.4);
  c.restore();
}
