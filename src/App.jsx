import React, { useEffect, useState } from 'react';
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

const TABS = [
  ['dashboard', '📊', 'Dashboard', 'visão geral do piloto'],
  ['coleta', '🧹', 'Coletor', 'registrar coleta'],
  ['validacao', '✅', 'Instituto Vivá', 'validar & aprovar'],
  ['mercado', '🛒', 'Mercado', 'turista & empresa'],
  ['fundo', '🔗', 'Cofre Multisig', 'Solana · 2-de-3'],
  ['carteira', '👨‍👩‍👧', 'Família (operação)', 'visão do agente'],
  ['familia', '📱', 'App da Família', 'como a família vê'],
];

/* navegação sequencial da jornada, no rodapé de cada tela */
function NavJornada({ tab, setTab }) {
  const i = TABS.findIndex(t => t[0] === tab);
  const ant = TABS[i - 1];
  const prox = TABS[i + 1];
  return (
    <div className="nav-jornada">
      {ant ? (
        <button className="nav-passo" onClick={() => setTab(ant[0])}>
          <small>← etapa anterior</small>
          <b>{ant[1]} {ant[2]}</b>
        </button>
      ) : <span />}
      {prox ? (
        <button className="nav-passo dir" onClick={() => setTab(prox[0])}>
          <small>próxima etapa →</small>
          <b>{prox[1]} {prox[2]}</b>
        </button>
      ) : <span />}
    </div>
  );
}

/* ------------------------------------------------------------ painel ---- */
function Painel({ tab, setTab }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [tourAberto, setTourAberto] = useState(() => !tourVisto());
  const [tourIdx, setTourIdx] = useState(0);
  const [gravando, setGravando] = useState(false);

  // trocar de etapa sempre começa do topo da tela
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [tab]);

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
                <p>Do resíduo à proteção da infância · Boipeba, BA</p>
              </div>
            </div>
            <button className="btn-tour" onClick={() => { setTourIdx(0); setTourAberto(true); }}>❔ Como funciona</button>
          </div>
          <nav className="tabs">
            {TABS.map(([id, ico, rot, sub], i) => (
              <button key={id}
                className={(tab === id ? 'on' : '') + (alvo === id ? ' tour-alvo' : '')}
                onClick={() => setTab(id)}>
                <span className="tab-ico">{ico}</span>
                <span className="tab-txt">
                  <span className="tab-rot">{rot}</span>
                  <span className="tab-sub">{i + 1} · {sub}</span>
                </span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="shell">
        <div key={tab} className="vista">
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'coleta' && <Coleta />}
          {tab === 'validacao' && <Validacao />}
          {tab === 'mercado' && <Mercado />}
          {tab === 'fundo' && <Fundo />}
          {tab === 'carteira' && <Carteira />}
          {tab === 'familia' && <PaginaFamilia />}
        </div>

        <NavJornada tab={tab} setTab={setTab} />

        <footer>
          <span>Plataforma Raízes do Futuro · Youth Challenge Blockchain — UNICEF Brasil · ambiente de demonstração em testnet (Solana devnet · Sepolia via Rede Recy)</span>
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

  // rota standalone da família: abre só o app do celular, sem o painel
  if (rota.startsWith('#/familia')) {
    return (
      <ToastProvider>
        <DemoProvider setTab={() => {}}>
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
        <Painel tab={tab} setTab={setTab} />
      </DemoProvider>
    </ToastProvider>
  );
}
