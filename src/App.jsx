import React, { useEffect, useRef, useState } from 'react';
import { useStore } from './store.jsx';
import { ToastProvider, useToast } from './ui.jsx';
import { DemoProvider, DemoNarrador } from './demo.jsx';
import { TourPainel, tourVisto, encerrarTour, alvoDoPasso } from './tour.jsx';
import Dashboard from './views/Dashboard.jsx';
import Coleta from './views/Coleta.jsx';
import Validacao from './views/Validacao.jsx';
import Mercado from './views/Mercado.jsx';
import Fundo from './views/Fundo.jsx';
import Carteira from './views/Carteira.jsx';
import PaginaFamilia from './views/PaginaFamilia.jsx';
import Rastreio from './views/Rastreio.jsx';

const TABS = [
  ['dashboard', '📊 Dashboard'],
  ['coleta', '🧹 Coletor'],
  ['validacao', '✅ Instituto Vivá'],
  ['mercado', '🛒 Mercado'],
  ['fundo', '🔗 Cofre Multisig'],
  ['carteira', '👨‍👩‍👧 Família (operação)'],
  ['familia', '📱 App da Família'],
];

/** Anuncia cada nova transação registrada na rede simulada. */
function AvisosDeRede() {
  const { state } = useStore();
  const toast = useToast();
  const nRef = useRef(state.transacoes.length);

  useEffect(() => {
    const n = state.transacoes.length;
    if (n > nRef.current) {
      const tx = state.transacoes[n - 1];
      toast(`Transação registrada no slot ${tx.slot} · ${tx.tipo}`, 'info', 2800);
    }
    nRef.current = n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.transacoes.length]);

  return null;
}

/* ------------------------------------------------------------ painel ---- */
function Painel({ tab, setTab }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [tourAberto, setTourAberto] = useState(() => !tourVisto());
  const [tourIdx, setTourIdx] = useState(0);
  const [gravando, setGravando] = useState(false);

  // modo gravação: esconde tudo que denuncia a simulação (para gravar o pitch)
  useEffect(() => {
    document.body.classList.toggle('gravando', gravando);
    return () => document.body.classList.remove('gravando');
  }, [gravando]);

  const ligarGravacao = () => {
    setGravando(true);
    setTourAberto(false);
    toast('Modo gravação ligado 🎥 — controles de simulação ocultos', 'info');
  };

  const fecharTour = persistir => {
    encerrarTour(persistir);
    setTourAberto(false);
    setTourIdx(0);
  };

  const alvo = tourAberto ? alvoDoPasso(tourIdx) : null;

  const resetar = () => {
    if (confirm('Restaurar dados iniciais da demo?')) {
      dispatch({ type: 'RESET' });
      toast('Demo restaurada ao estado inicial 🌱', 'info');
    }
  };

  return (
    <>
      <header className="top">
        <div className="inner">
          <div className="top-linha">
            <div className="marca">
              <img className="logo-emblema" src="./emblema.png" alt="Raízes do Futuro" />
              <div>
                <h1>Raízes do Futuro</h1>
                <p>Do impacto ambiental à proteção da infância — Boipeba, BA · MVP (Solana simulada · cofre multisig 2-de-3 · carteira Picnic)</p>
              </div>
            </div>
            <button className="btn-tour" onClick={() => { setTourIdx(0); setTourAberto(true); }}>❔ Como funciona</button>
          </div>
          <nav className="tabs">
            {TABS.map(([id, rot]) => (
              <button key={id}
                className={(tab === id ? 'on' : '') + (alvo === id ? ' tour-alvo' : '')}
                onClick={() => setTab(id)}>
                {rot}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="shell">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'coleta' && <Coleta />}
        {tab === 'validacao' && <Validacao />}
        {tab === 'mercado' && <Mercado />}
        {tab === 'fundo' && <Fundo />}
        {tab === 'carteira' && <Carteira />}
        {tab === 'familia' && <PaginaFamilia />}

        <footer>
          <span>Youth Challenge Blockchain — UNICEF Brasil · protótipo demonstrativo · blockchain simulada (produção: cofre multisig na Solana + carteira Picnic)</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="acao sec" onClick={ligarGravacao}>🎥 Modo gravação</button>
            <button className="acao sec" onClick={resetar}>Resetar demo</button>
          </span>
        </footer>
      </div>

      {gravando && (
        <button className="sair-gravacao" title="Sair do modo gravação" onClick={() => setGravando(false)}>🎥 ✕</button>
      )}

      <DemoNarrador />
      {tourAberto && (
        <TourPainel indice={tourIdx} setIndice={setTourIdx} setTab={setTab} aoFechar={fecharTour} />
      )}
    </>
  );
}

/* --------------------------------------------------------------- app ---- */
export default function App() {
  const [rota, setRota] = useState(() => window.location.hash);
  const [tab, setTab] = useState('dashboard');

  useEffect(() => {
    const aoMudar = () => setRota(window.location.hash);
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, []);

  // rota pública do rastreio: o turista escaneia o QR da peça e cai aqui, sem painel nenhum
  if (rota.startsWith('#/rastreio/')) {
    const codigo = decodeURIComponent(rota.slice('#/rastreio/'.length)).trim();
    return (
      <ToastProvider>
        <DemoProvider setTab={() => {}}>
          <Rastreio codigo={codigo} />
        </DemoProvider>
      </ToastProvider>
    );
  }

  // rota standalone da família: abre só o app do celular, sem o painel
  if (rota.startsWith('#/familia')) {
    return (
      <ToastProvider>
        <DemoProvider setTab={() => {}}>
          <AvisosDeRede />
          <div className="rota-familia">
            <PaginaFamilia standalone />
            <a className="voltar-painel" href="#" onClick={() => setRota('')}>← Voltar ao painel do projeto</a>
          </div>
        </DemoProvider>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <DemoProvider setTab={setTab}>
        <AvisosDeRede />
        <Painel tab={tab} setTab={setTab} />
      </DemoProvider>
    </ToastProvider>
  );
}
