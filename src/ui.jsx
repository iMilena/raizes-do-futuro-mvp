import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';

/* ---------------------------------------------------------------- toasts ---- */
const ToastCtx = createContext(() => {});
let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remover = useCallback(id => setToasts(ts => ts.filter(t => t.id !== id)), []);

  const toast = useCallback((msg, tipo = 'ok', duracao = 3600) => {
    const id = ++toastId;
    setToasts(ts => [...ts.slice(-3), { id, msg, tipo }]);
    setTimeout(() => remover(id), duracao);
  }, [remover]);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={'toast ' + t.tipo} onClick={() => remover(t.id)}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** toast('Coleta enviada ✔') · tipos: ok | info | alerta */
export const useToast = () => useContext(ToastCtx);

/* ------------------------------------------------------------------ modal ---- */
export function Modal({ titulo, sub, onFechar, largura = 560, children }) {
  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);

  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className="modal" style={{ maxWidth: largura }} onClick={e => e.stopPropagation()}>
        <div className="modal-topo">
          <div>
            <h3 style={{ margin: 0 }}>{titulo}</h3>
            {sub && <div style={{ fontSize: 12, color: 'var(--cinza)', marginTop: 2 }}>{sub}</div>}
          </div>
          <button className="modal-x" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>
        <div className="modal-corpo">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------- contador animado (rAF) ---- */
/** Anima de um valor ao outro sempre que `valor` muda. */
export function useContagem(valor, duracao = 900) {
  const [mostrado, setMostrado] = useState(valor);
  const atualRef = useRef(valor); // acompanha o quadro exibido, para não pular ao mudar de alvo no meio
  const rafRef = useRef(0);

  useEffect(() => {
    const de = atualRef.current;
    const para = Number(valor) || 0;
    if (de === para) { setMostrado(para); return; }

    let inicio = null;
    const passo = agora => {
      if (inicio === null) inicio = agora;
      const t = Math.min(1, (agora - inicio) / duracao);
      const v = de + (para - de) * (1 - Math.pow(1 - t, 3));
      atualRef.current = v;
      setMostrado(v);
      if (t < 1) rafRef.current = requestAnimationFrame(passo);
      else atualRef.current = para;
    };
    rafRef.current = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(rafRef.current);
  }, [valor, duracao]);

  return mostrado;
}

/** Número em reais que anima com contagem crescente. */
export function ValorAnimado({ valor, className, style, prefixo = 'R$ ' }) {
  const v = useContagem(valor);
  const subindo = v < valor - 0.01;
  return (
    <span className={(className || '') + (subindo ? ' subindo' : '')} style={style}>
      {prefixo}{v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

/* ------------------------------------------------------------ badge/status ---- */
/** Badge que pulsa quando o status muda (pendente → em validação → …). */
export function Badge({ tom = 'info', children }) {
  const [pulso, setPulso] = useState(false);
  const anterior = useRef(children);

  useEffect(() => {
    if (anterior.current !== children) {
      anterior.current = children;
      setPulso(true);
      const t = setTimeout(() => setPulso(false), 900);
      return () => clearTimeout(t);
    }
  }, [children]);

  return <span className={`tag ${tom}${pulso ? ' trocou' : ''}`}>{children}</span>;
}

/* ------------------------------------------------------------ estado vazio ---- */
export function EstadoVazio({ icone = '🌱', titulo, dica, acao }) {
  return (
    <div className="vazio">
      <div className="vazio-icone">{icone}</div>
      <b>{titulo}</b>
      {dica && <p>{dica}</p>}
      {acao}
    </div>
  );
}

/* ---------------------------------------------------------------- confete ---- */
const CORES_CONFETE = ['#1b7a43', '#1cabe2', '#f2c14e', '#e8734a', '#8a5cf6'];

/** Confete em CSS puro — 34 pedaços com atraso e trajetória variados. */
export function Confete({ pecas = 34 }) {
  const itens = useRef(
    Array.from({ length: pecas }, (_, i) => ({
      esq: (i * 37 % 100),
      atraso: (i % 11) * 0.12,
      dur: 1.9 + (i % 7) * 0.16,
      cor: CORES_CONFETE[i % CORES_CONFETE.length],
      giro: (i % 2 ? 1 : -1) * (280 + (i % 5) * 90),
      tam: 6 + (i % 4) * 2,
    }))
  ).current;

  return (
    <div className="confete" aria-hidden="true">
      {itens.map((p, i) => (
        <span key={i} style={{
          left: p.esq + '%',
          background: p.cor,
          width: p.tam,
          height: p.tam * 1.6,
          animationDelay: p.atraso + 's',
          animationDuration: p.dur + 's',
          '--giro': p.giro + 'deg',
        }} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- progresso ---- */
export function BarraProgresso({ pct, rot }) {
  return (
    <div className="progresso">
      <div className="progresso-trilha"><div className="progresso-fill" style={{ width: Math.min(100, Math.max(0, pct)) + '%' }} /></div>
      {rot && <span className="progresso-rot">{rot}</span>}
    </div>
  );
}
