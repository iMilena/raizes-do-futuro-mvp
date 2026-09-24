/* ---------------------------------------------------------------------------
   O som ambiente do mapa: só passarinhos, sintetizados na hora pela Web Audio.
   Nenhum arquivo de áudio é baixado, e não há som de mar, por decisão de
   produto.

   Quatro cantos, sorteados a cada 1,4 a 4,2 s, cada um vindo de um lado do
   estéreo: piado duplo ou triplo, trinado rápido, assobio melódico (no estilo
   do sabiá) e uma gaivota ao longe. Um reverb curto, feito de ruído que decai,
   dá a sensação de lugar aberto. Abrir um ponto do mapa toca um sino baixinho.

   O `AudioContext` só nasce no primeiro `ligar()`, que sempre vem de um clique:
   o navegador não deixa tocar som antes de um gesto da pessoa.
--------------------------------------------------------------------------- */

import { rnd } from './desenho.js';

export function criarSom() {
  let ac = null;
  let master = null;
  let verb = null;
  let ligado = false;
  let timer = null;

  function iniciar() {
    if (ac) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ac = new Ctx();
    master = ac.createGain();
    master.gain.value = 0;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    master.connect(comp);
    comp.connect(ac.destination);
    const ir = ac.createBuffer(2, ac.sampleRate * 2.6, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2);
    }
    verb = ac.createConvolver();
    verb.buffer = ir;
    const vg = ac.createGain();
    vg.gain.value = 0.35;
    verb.connect(vg);
    vg.connect(master);
  }

  /** Uma nota com vibrato leve, glissando de `f0` a `f1`, posicionada em `pan`. */
  function nota(t, f0, f1, dur, vol, pan, tipo) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    o.type = tipo || 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const vib = ac.createOscillator();
    const vg = ac.createGain();
    vib.frequency.value = rnd(25, 45);
    vg.gain.value = f0 * 0.015;
    vib.connect(vg);
    vg.connect(o.frequency);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.3));
    g.gain.setValueAtTime(vol, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    if (p) {
      p.pan.value = pan;
      g.connect(p);
      p.connect(master);
      p.connect(verb);
    } else {
      g.connect(master);
    }
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 0.02);
    vib.stop(t + dur + 0.02);
  }

  function passarinho() {
    if (!ligado) return;
    const t = ac.currentTime + 0.05;
    const pan = rnd(-0.9, 0.9);
    const tipo = Math.random();
    const v = rnd(0.025, 0.05);
    if (tipo < 0.35) {
      /* piado duplo ou triplo */
      const f = rnd(3200, 4200);
      for (let i = 0; i < (Math.random() < 0.5 ? 2 : 3); i++) nota(t + i * 0.16, f, f * rnd(1.25, 1.45), 0.09, v, pan);
    } else if (tipo < 0.65) {
      /* trinado rápido */
      const f = rnd(4200, 5600);
      const n = rnd(8, 16) | 0;
      for (let i = 0; i < n; i++) nota(t + i * 0.045, f * (1 - i * 0.012), f * 0.82, 0.035, v * 0.8, pan);
    } else if (tipo < 0.88) {
      /* assobio melódico, estilo sabiá */
      let tt = t;
      const base = rnd(1900, 2500);
      const mel = [1, 1.26, 1.12, 1.5, 1.33, 1];
      const n = rnd(3, 6) | 0;
      for (let i = 0; i < n; i++) {
        const d = rnd(0.14, 0.26);
        const mm = mel[(i + ((Math.random() * 2) | 0)) % mel.length];
        nota(tt, base * mm, base * mm * rnd(0.94, 1.06), d, v * 0.9, pan, 'triangle');
        tt += d + rnd(0.03, 0.08);
      }
    } else {
      /* gaivota ao longe */
      nota(t, 1400, 900, 0.35, v * 0.6, pan, 'sawtooth');
      nota(t + 0.42, 1350, 850, 0.3, v * 0.5, pan, 'sawtooth');
    }
    timer = setTimeout(passarinho, rnd(1400, 4200));
  }

  const aoOcultar = () => {
    if (ac && ligado) (document.hidden ? ac.suspend() : ac.resume()).catch(() => {});
  };
  document.addEventListener('visibilitychange', aoOcultar);

  return {
    get ligado() {
      return ligado;
    },
    ligar(on) {
      ligado = on;
      clearTimeout(timer);
      if (on) {
        iniciar();
        if (!ac) return;
        ac.resume().catch(() => {});
        master.gain.cancelScheduledValues(ac.currentTime);
        master.gain.setTargetAtTime(0.9, ac.currentTime, 0.6);
        timer = setTimeout(passarinho, 600);
      } else if (ac) {
        master.gain.setTargetAtTime(0, ac.currentTime, 0.3);
      }
    },
    /** O sino de quando um ponto abre. Só toca com o som ligado. */
    sino() {
      if (!ligado || !ac) return;
      const t = ac.currentTime;
      [784, 1175].forEach((f, k) => nota(t + k * 0.09, f, f, 0.9, 0.02, 0, 'sine'));
    },
    destruir() {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', aoOcultar);
      if (ac) ac.close().catch(() => {});
    },
  };
}
