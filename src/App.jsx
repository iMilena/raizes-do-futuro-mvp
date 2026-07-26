import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, fmt, trunc } from './store.jsx';
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
import PaginaRastreio from './views/Rastreio.jsx';

/* [id, ícone, rótulo, subtítulo, grupo do menu]
   O grupo só organiza a barra lateral; a ordem continua sendo a da jornada,
   porque as setas "próxima etapa" e o tour guiado dependem dela. */
const TABS = [
  ['dashboard', '📊', 'Dashboard', 'visão geral do piloto', 'Visão geral'],
  ['coleta', '🧹', 'Coletor', 'registrar coleta', 'Operação'],
  ['validacao', '✅', 'Instituto Vivá', 'validar & aprovar', 'Operação'],
  ['mercado', '🛒', 'Mercado', 'turista & empresa', 'Operação'],
  ['fundo', '🔗', 'Cofre Multisig', 'Solana · 2-de-3', 'Governança'],
  ['carteira', '👨‍👩‍👧', 'Família (operação)', 'visão do agente', 'Famílias'],
  ['familia', '📱', 'App da Família', 'como a família vê', 'Famílias'],
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

/* ------------------------------------------------------ busca global ---- */
/**
 * Busca de verdade, não enfeite de cabeçalho: varre coleta, família, peça
 * vendida e transação, e cada resultado leva à aba onde aquilo vive. Um campo
 * de busca decorativo seria pior do que campo nenhum — promete e não entrega.
 */
function BuscaGlobal({ setTab }) {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const [aberta, setAberta] = useState(false);
  const caixa = useRef(null);

  useEffect(() => {
    const fora = e => { if (caixa.current && !caixa.current.contains(e.target)) setAberta(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  const achados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const bate = s => String(s ?? '').toLowerCase().includes(t);
    const r = [];
    for (const c of state.coletas) {
      if (bate(c.coletor) || bate(c.local) || bate(c.material)) {
        r.push({ tab: 'coleta', ico: '🧹', tit: `${c.material} · ${c.kg} kg`, sub: `${c.coletor} — ${c.local}` });
      }
    }
    for (const f of state.familias) {
      if (bate(f.resp) || bate(f.codigo) || (f.condicoes || []).some(c => bate(c.tipo))) {
        r.push({ tab: 'carteira', ico: '👨‍👩‍👧', tit: f.resp, sub: `${f.criancas} criança(s) · saldo ${fmt(f.saldo)}` });
      }
    }
    for (const v of state.vendas) {
      if (bate(v.descricao) || bate(v.comprador) || bate(v.rastreio)) {
        r.push({ tab: 'mercado', ico: '🛒', tit: v.descricao, sub: `${v.comprador} · ${fmt(v.valor)}` });
      }
    }
    for (const tx of [...state.transacoes].reverse()) {
      if (bate(tx.desc) || bate(tx.tipo) || bate(tx.signature)) {
        r.push({ tab: 'fundo', ico: '🔗', tit: tx.desc, sub: `slot ${tx.slot} · ${trunc(tx.signature, 10)}` });
      }
    }
    return r.slice(0, 8);
  }, [q, state]);

  return (
    <div className="busca-global" ref={caixa}>
      <span className="busca-ico" aria-hidden="true">🔍</span>
      <input
        type="search" className="busca-campo" value={q} placeholder="Buscar coleta, família, peça ou transação…"
        aria-label="Busca global"
        onChange={e => { setQ(e.target.value); setAberta(true); }}
        onFocus={() => setAberta(true)} />
      {aberta && q.trim().length >= 2 && (
        <div className="busca-resultados">
          {achados.length === 0 && <p className="busca-nada">Nada encontrado para “{q.trim()}”.</p>}
          {achados.map((a, i) => (
            <button key={i} className="busca-item" onClick={() => { setTab(a.tab); setAberta(false); setQ(''); }}>
              <span className="busca-item-ico">{a.ico}</span>
              <span className="busca-item-txt"><b>{a.tit}</b><small>{a.sub}</small></span>
              <span className="busca-item-ir">abrir →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------- avisos ------- */
/**
 * Sino de notificações contando o que de fato está parado esperando alguém:
 * coleta sem validar, condição validada esperando o cofre, proposta sem as
 * duas assinaturas. Contador inventado seria ruído.
 */
function Notificacoes({ setTab }) {
  const { state } = useStore();
  const [aberto, setAberto] = useState(false);

  const itens = useMemo(() => {
    const l = [];
    const coletasPend = state.coletas.filter(c => c.status === 'pendente').length;
    if (coletasPend) l.push({ tab: 'validacao', cor: 'atencao', tit: `${coletasPend} coleta(s) aguardando validação`, sub: 'Instituto Vivá' });
    const cond = state.familias.flatMap(f => (f.condicoes || []).map(c => ({ ...c, f })));
    const aguardando = cond.filter(c => c.status === 'validada-aguardando').length;
    if (aguardando) l.push({ tab: 'validacao', cor: 'atencao', tit: `${aguardando} condição(ões) validada(s) sem repasse`, sub: 'precisa de proposta no cofre' });
    const props = state.propostas.filter(p => p.status === 'aguardando');
    for (const p of props) {
      l.push({ tab: 'fundo', cor: 'info', tit: `Proposta #${p.id} com ${p.assinaturas.length}/2 assinaturas`, sub: `${fmt(p.valor)} — falta assinar` });
    }
    const pend = cond.filter(c => c.status === 'pendente').length;
    if (pend) l.push({ tab: 'carteira', cor: 'neutro', tit: `${pend} compromisso(s) sem evidência`, sub: 'agente de campo' });
    return l;
  }, [state]);

  return (
    <div className="sino-wrap">
      <button className="sino" aria-label={`Notificações (${itens.length})`} onClick={() => setAberto(a => !a)}>
        🔔{itens.length > 0 && <i className="sino-conta">{itens.length}</i>}
      </button>
      {aberto && (
        <div className="sino-painel">
          <div className="sino-topo"><b>Pendências</b><span className="mini">{itens.length} em aberto</span></div>
          {itens.length === 0 && <p className="busca-nada">Nada pendente. Ciclo em dia.</p>}
          {itens.map((it, i) => (
            <button key={i} className="sino-item" onClick={() => { setTab(it.tab); setAberto(false); }}>
              <i className={'luz ' + it.cor} />
              <span className="busca-item-txt"><b>{it.tit}</b><small>{it.sub}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------- perfil ------- */
/**
 * O app ainda NÃO tem autenticação — ver README, seção de limites. Então este
 * bloco mostra o papel de operação, e o menu diz em voz alta que é perfil de
 * demonstração. Desenhar um usuário logado com nome próprio faria a tela
 * afirmar um login que não existe.
 */
function Perfil() {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="perfil-wrap">
      <button className="perfil" onClick={() => setAberto(a => !a)}>
        <span className="perfil-av">IV</span>
        <span className="perfil-txt">
          <b>Instituto Vivá</b>
          <small>Operação · Boipeba</small>
        </span>
        <span className="perfil-seta">▾</span>
      </button>
      {aberto && (
        <div className="perfil-painel">
          <p className="perfil-nota so-sim">
            <b>Perfil de demonstração.</b> Esta versão não tem login: qualquer pessoa
            com o endereço abre o painel inteiro. Autenticação por papel é o passo
            anterior ao uso com famílias reais.
          </p>
          <div className="perfil-linha"><span>Organização</span><b>Instituto Vivá</b></div>
          <div className="perfil-linha"><span>Papel no cofre</span><b>Signatário 1 de 3</b></div>
          <div className="perfil-linha"><span>Piloto</span><b>Boipeba · Cairu/BA</b></div>
        </div>
      )}
    </div>
  );
}

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
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [tourAberto, setTourAberto] = useState(() => !tourVisto());
  const [tourIdx, setTourIdx] = useState(0);
  const [gravando, setGravando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);

  // trocar de etapa sempre começa do topo da tela
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setMenuAberto(false); }, [tab]);

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

  /* exportar: baixa o estado como JSON. É o que uma auditoria pediria — e
     funciona offline, sem servidor. */
  const exportar = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `raizes-do-futuro-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Dados exportados em JSON 📄', 'info');
  };

  const grupos = [];
  for (const t of TABS) {
    const g = grupos.find(x => x.nome === t[4]);
    (g || (grupos.push({ nome: t[4], itens: [] }), grupos[grupos.length - 1])).itens.push(t);
  }
  const atual = TABS.find(t => t[0] === tab);

  return (
    <div className={'app-shell' + (menuAberto ? ' menu-aberto' : '')}>
      <aside className="lateral">
        <div className="lat-marca">
          <img className="logo-emblema" src="./emblema.png" alt="Raízes do Futuro" />
          <div>
            <h1>Raízes do Futuro</h1>
            <p>Boipeba · Cairu/BA</p>
          </div>
        </div>

        <nav className="tabs">
          {grupos.map(g => (
            <React.Fragment key={g.nome}>
              <span className="lat-grupo">{g.nome}</span>
              {g.itens.map(([id, ico, rot, sub]) => (
                <button key={id}
                  className={(tab === id ? 'on' : '') + (alvo === id ? ' tour-alvo' : '')}
                  onClick={() => setTab(id)}>
                  <span className="tab-ico">{ico}</span>
                  <span className="tab-txt">
                    <span className="tab-rot">{rot}</span>
                    <span className="tab-sub">{TABS.findIndex(t => t[0] === id) + 1} · {sub}</span>
                  </span>
                </button>
              ))}
            </React.Fragment>
          ))}
        </nav>

        <div className="lat-rodape">
          <div className="lat-rede">
            <i className="luz ok" />
            <span>Cofre na Solana devnet</span>
          </div>
          <p className="so-sim">Jornada do app simulada · cofre 2-de-3 real</p>
        </div>
      </aside>

      <div className="principal">
        <header className="top">
          <button className="menu-hamb" aria-label="Abrir menu" onClick={() => setMenuAberto(a => !a)}>☰</button>
          <div className="top-titulo">
            <span className="top-trilha">{atual?.[4]}</span>
            <h2 className="top-h">{atual?.[1]} {atual?.[2]}</h2>
          </div>
          <BuscaGlobal setTab={setTab} />
          <div className="top-acoes">
            <button className="btn-tour" onClick={() => { setTourIdx(0); setTourAberto(true); }}>❔ Como funciona</button>
            <Notificacoes setTab={setTab} />
            <Perfil />
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
            <span className="rodape-txt">
              Plataforma Raízes do Futuro · Youth Challenge Blockchain — UNICEF Brasil
              <small>Cofre multisig real na Solana devnet · jornada do app simulada</small>
            </span>
            <div className="rodape-acoes">
              <button className="acao sec" onClick={exportar}>⭳ Exportar dados</button>
              <details className="painel-config">
                <summary>⚙︎ Configurações</summary>
                <div className="painel-config-corpo">
                  <p className="mini">Controles de apresentação e de simulação.</p>
                  <button className="acao sec bloco" onClick={ligarGravacao}>🎥 Modo gravação</button>
                  <button className="acao sec bloco" onClick={resetar}>Resetar demo</button>
                </div>
              </details>
            </div>
          </footer>
        </div>
      </div>

      {menuAberto && <div className="lateral-veu" onClick={() => setMenuAberto(false)} />}

      {gravando && (
        <button className="sair-gravacao" title="Sair do modo gravação" onClick={() => setGravando(false)}>🎥 ✕</button>
      )}

      <DemoNarrador />
      {tourAberto && (
        <TourPainel indice={tourIdx} setIndice={setTourIdx} setTab={setTab} aoFechar={fecharTour} />
      )}
    </div>
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
          <PaginaRastreio codigo={codigo} />
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
