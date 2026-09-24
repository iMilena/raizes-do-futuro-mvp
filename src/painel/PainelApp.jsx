import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { StoreProvider, useStore, fmt, trunc } from '../estado/store.jsx';
import * as auth from '../lib/auth.js';
import * as nuvem from '../lib/nuvem.js';
import { IdiomaProvider, useIdioma, TRADUZIDAS } from '../lib/i18n.jsx';
import { ToastProvider, useToast } from '../componentes/ui.jsx';
import { DemoProvider, DemoNarrador } from '../componentes/demo.jsx';
import { TourPainel, tourVisto, encerrarTour, alvoDoPasso } from '../componentes/tour.jsx';
import { Icon, SpriteIcones } from './ui/Icones';
import { SeletorTema } from './ui/SeletorTema';
import { ModoProvider, SeletorModo, useModo } from './ui/modo';
import { CamadaDeDicas } from './ui/Dica';
import { NavEtapa } from './ui/TelaCabecalho';
import '../estilos/styles.css';
import '../estilos/estilos-rastreio.css'; // rastreio do produto, em arquivo proprio
/* Os tokens entram DEPOIS da folha antiga, de proposito. As variaveis em si
   resolvem na hora do uso, entao a ordem nao as afeta; o que precisa vir por
   ultimo e a regra de `body`, que pinta o fundo do tema por cima do fundo fixo
   que o styles.css do MVP declara. Quando a folha antiga for podada, no fim da
   migracao, esta linha pode subir para o topo. */
import '../styles/tokens.css';
import './ui/painel.css'; // os primitivos: as telas novas não passam por primitivos.jsx
import './ui/shell.css';

/* ---------------------------------------------------------------------------
   O painel da operação e as duas telas públicas que dependem do mesmo estado.

   Este arquivo existe por um motivo de carregamento, não de organização: a
   landing e a porta do painel moram no mesmo bundle, e enquanto o painel era
   importado direto pelo `App`, quem abria a página de apresentação no celular
   baixava e interpretava a operação inteira — reducer, sincronização, nuvem,
   nove telas — antes de ler a primeira linha. Aqui dentro, tudo isso vira um
   pedaço separado que só é buscado quando alguém entra numa rota do painel.

   Por isso o `StoreProvider` também mudou de lugar: ele saiu do `main.jsx`,
   onde envolvia até a landing (que não usa estado nenhum), e passou a envolver
   só as rotas que de fato leem o estado da operação.
--------------------------------------------------------------------------- */

/* Dentro do pedaço do painel, cada tela é ainda um pedaço próprio: quem entra
   para ver o Dashboard não precisa do Cadastro nem do App da Família junto. */
const VisaoGeral = lazy(() => import('../views/VisaoGeral.jsx'));
const Trilha = lazy(() => import('../views/Trilha.jsx'));
const Coleta = lazy(() => import('../views/Coleta.jsx'));
const Validacao = lazy(() => import('../views/Validacao.jsx'));
/* Do módulo de Validação de Coleta. É TSX no meio do JSX, e o Vite não se
   incomoda: o que muda é só o carregador. Mora em src/validacao/ porque também
   é servido como página própria (revisao.html), para a coordenação que prefere
   abrir direto. Ver VALIDACAO.md. */
const Conferencia = lazy(() => import('../validacao/revisao/PainelRevisao.tsx'));
const Mercado = lazy(() => import('../views/Mercado.jsx'));
const Fundo = lazy(() => import('../views/Fundo.jsx'));
const Carteira = lazy(() => import('../views/Carteira.jsx'));
const Cadastro = lazy(() => import('../views/Cadastro.jsx'));
const PaginaFamilia = lazy(() => import('../views/PaginaFamilia.jsx'));
const PaginaRastreio = lazy(() => import('../views/Rastreio.jsx'));

/** O que aparece no lugar de uma tela enquanto o pedaço dela chega. */
function Carregando() {
  return <p className="mini" style={{ padding: '28px 4px' }}>Carregando…</p>;
}

/* ---------------------------------------------------------------------------
   O menu do redesign: oito telas em quatro grupos, na ordem do ciclo.

   "Famílias e carteiras" reúne três telas que já existiam (Cadastro, Família
   na visão do agente e App da Família) em subabas. Os ids antigos continuam
   valendo em `setTab` (o tour, a busca, as notificações e o modo demo usam
   'carteira' e 'familia'), e a tela ativa do menu é deduzida deles.

   O `id` da Visão geral continua 'dashboard' porque é por ele que o seletor de
   idioma sabe que a tela tem versão em inglês.
--------------------------------------------------------------------------- */
const TELAS = [
  { id: 'dashboard', icone: 'home', rotulo: 'Visão geral', grupo: 'Visão geral' },
  { id: 'trilha', icone: 'trilha', rotulo: 'Trilha de prova', grupo: 'Visão geral' },
  { id: 'coleta', icone: 'bag', rotulo: 'Coleta', grupo: 'Operação' },
  { id: 'conferencia', icone: 'ia', rotulo: 'Conferência da IA', grupo: 'Operação' },
  { id: 'validacao', icone: 'viva', rotulo: 'Validação do Vivá', grupo: 'Operação' },
  { id: 'mercado', icone: 'mercado', rotulo: 'Mercado', grupo: 'Operação' },
  { id: 'fundo', icone: 'cofre', rotulo: 'Cofre 2-de-3', grupo: 'Governança' },
  { id: 'familias', icone: 'casa', rotulo: 'Famílias e carteiras', grupo: 'Famílias' },
];

/** As subabas de "Famílias e carteiras". */
const SUBABAS = [
  ['cadastro', 'Cadastro'],
  ['carteira', 'Família (operação)'],
  ['familia', 'App da Família'],
];
const ehSubaba = tab => SUBABAS.some(([id]) => id === tab);
/** A tela do menu que corresponde a uma aba (as subabas caem em Famílias). */
const telaDe = tab => (ehSubaba(tab) ? 'familias' : tab);

/**
 * O que está parado esperando alguém, por tela. Só aparece no modo Operação,
 * e só com número que o store sabe contar: contador inventado seria ruído.
 */
function usePendencias() {
  const { state } = useStore();
  return useMemo(() => {
    const cond = state.familias.flatMap(f => f.condicoes || []);
    return {
      validacao:
        state.coletas.filter(c => c.status === 'pendente').length +
        cond.filter(c => c.status === 'pendente' || c.status === 'validada-aguardando').length,
      fundo: state.propostas.filter(p => p.status === 'aguardando').length,
    };
  }, [state]);
}

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
        r.push({ tab: 'coleta', ico: 'scan', tit: `${c.material} · ${c.kg} kg`, sub: `${c.coletor} · ${c.local}` });
      }
    }
    for (const f of state.familias) {
      if (bate(f.resp) || bate(f.codigo) || (f.condicoes || []).some(c => bate(c.tipo))) {
        r.push({ tab: 'carteira', ico: 'guide', tit: f.resp, sub: `${f.criancas} criança(s) · saldo ${fmt(f.saldo)}` });
      }
    }
    for (const v of state.vendas) {
      if (bate(v.descricao) || bate(v.comprador) || bate(v.rastreio)) {
        r.push({ tab: 'mercado', ico: 'coin', tit: v.descricao, sub: `${v.comprador} · ${fmt(v.valor)}` });
      }
    }
    for (const tx of [...state.transacoes].reverse()) {
      if (bate(tx.desc) || bate(tx.tipo) || bate(tx.signature)) {
        r.push({ tab: 'fundo', ico: 'shield', tit: tx.desc, sub: `slot ${tx.slot} · ${trunc(tx.signature, 10)}` });
      }
    }
    return r.slice(0, 8);
  }, [q, state]);

  return (
    <div className="busca-global" ref={caixa}>
      <Icon name="search" className="busca-ico" />
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
              <Icon name={a.ico} className="busca-item-ico" />
              <span className="busca-item-txt"><b>{a.tit}</b><small>{a.sub}</small></span>
              <span className="busca-item-ir">abrir<Icon name="right" className="sm" /></span>
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
  const { state, recusadas, listaRecusadas } = useStore();
  const [aberto, setAberto] = useState(false);

  const itens = useMemo(() => {
    const l = [];
    /* PRIMEIRO da lista: operação que o servidor recusou em definitivo. Ela saiu
       da fila para não travar o resto (ver escoarFila), e por isso alguém tem de
       ficar sabendo — recusa que desaparece em silêncio é dado perdido sem
       ninguém notar. */
    if (recusadas > 0) {
      const ultima = (listaRecusadas?.() || []).slice(-1)[0];
      l.push({
        tab: 'fundo', cor: 'atencao',
        tit: `${recusadas} operação(ões) recusadas pelo servidor`,
        sub: ultima ? String(ultima.motivo).slice(0, 90) : 'não serão reenviadas, veja Configurações',
      });
    }
    const cts = (state.contestacoes || []).filter(c => c.status === 'aberta');
    if (cts.length) {
      l.push({
        tab: 'validacao', cor: 'atencao',
        tit: `${cts.length} contestação(ões) de família em aberto`,
        sub: 'a família está esperando resposta',
      });
    }
    const coletasPend = state.coletas.filter(c => c.status === 'pendente').length;
    if (coletasPend) l.push({ tab: 'validacao', cor: 'atencao', tit: `${coletasPend} coleta(s) aguardando validação`, sub: 'Instituto Vivá' });
    const cond = state.familias.flatMap(f => (f.condicoes || []).map(c => ({ ...c, f })));
    const aguardando = cond.filter(c => c.status === 'validada-aguardando').length;
    if (aguardando) l.push({ tab: 'validacao', cor: 'atencao', tit: `${aguardando} condição(ões) validada(s) sem repasse`, sub: 'precisa de proposta no cofre' });
    const props = state.propostas.filter(p => p.status === 'aguardando');
    for (const p of props) {
      l.push({ tab: 'fundo', cor: 'info', tit: `Proposta #${p.id} com ${p.assinaturas.length}/2 assinaturas`, sub: `${fmt(p.valor)}, falta assinar` });
    }
    const pend = cond.filter(c => c.status === 'pendente').length;
    if (pend) l.push({ tab: 'carteira', cor: 'neutro', tit: `${pend} compromisso(s) sem evidência`, sub: 'agente de campo' });
    return l;
  }, [state, recusadas, listaRecusadas]);

  return (
    <div className="sino-wrap">
      <button className="sino" aria-label={`Notificações (${itens.length})`} onClick={() => setAberto(a => !a)}>
        <Icon name="bell" />{itens.length > 0 && <i className="sino-conta">{itens.length}</i>}
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
 * Perfil e sessão da operação.
 *
 * Duas situações honestas, e a tela diz qual é:
 *  · sem sessão → o app roda LOCAL. Nada é lido nem enviado à nuvem, e está
 *    escrito assim. Este é o modo da demonstração e do júri.
 *  · com sessão → sincroniza sob o papel da pessoa (coletor, validador, gestor).
 *
 * Não existe login de família aqui: a família usa o app dela com PIN e não tem
 * conta. Ver src/lib/auth.js.
 */
function Perfil() {
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({ email: '', senha: '' });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [sessao, setSessao] = useState(() => auth.atual());
  const toast = useToast();

  useEffect(() => auth.aoMudar(setSessao), []);

  const papel = sessao?.papel;
  const iniciais = (papel?.nome || sessao?.usuario?.email || 'operação')
    .split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');

  const submeter = async e => {
    e.preventDefault();
    setErro('');
    setOcupado(true);
    try {
      const cfg = await nuvem.configurar();
      if (!cfg) throw new Error('Este aparelho não tem projeto de nuvem configurado (public/supabase.json). O app segue funcionando local.');
      const s = await auth.entrar(cfg, form.email.trim(), form.senha);
      toast(`Sessão aberta: ${s.papel.nome} (${s.papel.papel})`, 'info');
      setForm({ email: '', senha: '' });
      setAberto(false);
    } catch (e2) {
      setErro(e2.message);
      if (e2.semPapel) toast('Login válido, mas sem papel definido', 'alerta', 6000);
    } finally {
      setOcupado(false);
    }
  };

  const sair = async () => {
    await auth.sair(await nuvem.configurar());
    toast('Sessão encerrada. O app continua funcionando local.', 'info');
    setAberto(false);
  };

  return (
    <div className="perfil-wrap">
      <button className="perfil" onClick={() => setAberto(a => !a)}>
        <span className={'perfil-av' + (papel ? '' : ' anon')}>{papel ? iniciais : <Icon name="lock" />}</span>
        <span className="perfil-txt">
          <b>{papel?.nome || 'Modo local'}</b>
          <small>{papel ? `${papel.papel} · ${papel.organizacao || 'operação'}` : 'sem sincronização'}</small>
        </span>
        <Icon name="right" className="perfil-seta sm" />
      </button>
      {aberto && (
        <div className="perfil-painel">
          {papel ? (
            <>
              <div className="perfil-linha"><span>Pessoa</span><b>{papel.nome}</b></div>
              <div className="perfil-linha"><span>E-mail</span><b className="hash">{sessao.usuario?.email}</b></div>
              <div className="perfil-linha"><span>Papel</span><b>{papel.papel}</b></div>
              <div className="perfil-linha"><span>Organização</span><b>{papel.organizacao || 'não informada'}</b></div>
              <div className="perfil-linha">
                <span>Assina no cofre</span>
                <b>{papel.signatario ? `sim, como ${papel.signatario}` : 'não'}</b>
              </div>
              <p className="perfil-nota" style={{ marginTop: 11 }}>
                A base só aceita a sua assinatura em nome de <b>{papel.signatario || 'nenhuma organização'}</b>.
                Por isso o 2-de-3 exige duas organizações de verdade.
              </p>
              <button className="acao sec bloco" onClick={sair}>Sair da sessão</button>
            </>
          ) : (
            <>
              <p className="perfil-nota">
                <b>O app está rodando local.</b> Sem sessão ele não lê nem envia nada
                para a base compartilhada, e funciona inteiro assim, inclusive offline.
                Entrar serve para sincronizar entre os aparelhos da operação.
              </p>
              <form onSubmit={submeter}>
                <label htmlFor="op-email">E-mail da operação</label>
                <input id="op-email" type="email" autoComplete="username" required
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                <label htmlFor="op-senha">Senha</label>
                <input id="op-senha" type="password" autoComplete="current-password" required
                  value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} />
                {erro && <p className="mini alerta-txt" style={{ marginTop: 9 }}>{erro}</p>}
                <button className="acao bloco" type="submit" disabled={ocupado}>
                  {ocupado ? 'Entrando…' : 'Entrar e sincronizar'}
                </button>
              </form>
              <p className="mini" style={{ marginTop: 10 }}>
                A família <b>não</b> usa senha: ela entra no app dela com PIN, no celular.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------- idioma ------- */
/**
 * Seletor PT/EN que AVISA quando a tela aberta não tem versão em inglês.
 *
 * Sem esse aviso, o avaliador clica em EN, cai em português no meio de um fluxo
 * e conclui que a tradução foi feita com descuido. Dizer o que está e o que não
 * está traduzido custa uma linha e evita essa leitura.
 */
function SeletorIdioma({ tab }) {
  const { idioma, trocar, t } = useIdioma();
  const parcial = idioma === 'en' && !TRADUZIDAS.includes(tab);
  return (
    <div className="idioma-wrap">
      <div className="idioma" role="group" aria-label="Idioma / Language">
        {['pt', 'en'].map(l => (
          <button key={l} className={idioma === l ? 'on' : ''} onClick={() => trocar(l)}
            aria-pressed={idioma === l} lang={l}>
            {l === 'pt' ? 'PT' : 'EN'}
          </button>
        ))}
      </div>
      {parcial && (
        <span className="idioma-aviso" title={t('As telas de operação são usadas pela equipe local. O Dashboard e a página pública de rastreio têm versão completa em inglês.')}>
          {t('Esta tela existe apenas em português')}
        </span>
      )}
    </div>
  );
}

/* Navegação sequencial da jornada, no rodapé de cada tela. A ordem de TELAS é
   a ordem do ciclo, então "anterior" e "próxima" são a etapa de fato. */
function NavJornada({ tab, setTab }) {
  const { t } = useIdioma();
  const i = TELAS.findIndex(x => x.id === telaDe(tab));
  const comoEtapa = e => (e ? { id: e.id, titulo: t(e.rotulo) } : null);
  return (
    <NavEtapa
      anterior={comoEtapa(TELAS[i - 1])}
      proxima={comoEtapa(TELAS[i + 1])}
      aoIr={id => setTab(id === 'familias' ? 'cadastro' : id)}
    />
  );
}

/* ------------------------------------------------------------ painel ---- */
function Painel({ tab, setTab }) {
  const { state, dispatch, recusadas: recusadasApp, listaRecusadas: listaRecusadasApp } = useStore();
  const { t } = useIdioma();
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
    toast('Modo gravação ligado: controles de simulação ocultos', 'info');
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
      toast('Demo restaurada ao estado inicial', 'info');
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
    toast('Dados exportados em JSON', 'info');
  };

  const { modo } = useModo();
  const pendencias = usePendencias();
  const irPara = id => setTab(id === 'familias' ? 'cadastro' : id);

  const grupos = [];
  for (const tela of TELAS) {
    const g = grupos.find(x => x.nome === tela.grupo);
    (g || (grupos.push({ nome: tela.grupo, itens: [] }), grupos[grupos.length - 1])).itens.push(tela);
  }
  const telaAtual = TELAS.find(x => x.id === telaDe(tab)) || TELAS[0];

  return (
    <div className={'painel-raizes pn-app modo-' + modo + (menuAberto ? ' menu-aberto' : '')}>
      <SpriteIcones />
      <aside className="pn-rail">
        <div className="pn-brand">
          <span className="pn-seal" aria-hidden="true">
            <img src="./imagens/emblema.png" alt="" />
          </span>
          <div>
            <p className="pn-brand-name">Raízes do Futuro</p>
            <p className="pn-brand-sub">{t('Boipeba · Cairu/BA')}</p>
          </div>
        </div>

        <nav className="pn-journey" aria-label={t('Telas do painel')}>
          {grupos.map(g => (
            <div className="pn-jgrupo" key={g.nome}>
              <div className="pn-jgroup">{t(g.nome)}</div>
              <ul className="pn-jlist">
                {g.itens.map(tela => {
                  const n = pendencias[tela.id];
                  const ativo = telaAtual.id === tela.id;
                  return (
                    <li key={tela.id} className="pn-jitem">
                      <button
                        type="button"
                        className={'pn-jbtn' + (alvo && telaDe(alvo) === tela.id ? ' tour-alvo' : '')}
                        aria-current={ativo ? 'page' : undefined}
                        onClick={() => irPara(tela.id)}
                      >
                        <Icon name={tela.icone} />
                        <span className="pn-jlabel">{t(tela.rotulo)}</span>
                        {n > 0 && (
                          <span className="pn-jbadge mode-op" aria-label={`${n} ${t('pendências')}`}>{n}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="pn-netfoot">
          <div className="pn-netline">
            <span className="pn-pulse" aria-hidden="true" />
            {t('Cofre real na Solana devnet')}
          </div>
          <p className="pn-netnote">
            {t('Multisig 2-de-3 assinando de verdade. A jornada do app é simulada para demonstração.')}
          </p>
        </div>
      </aside>

      <div className="pn-main">
        <header className="pn-topbar">
          <button
            type="button"
            className="menu-hamb pn-menu-btn"
            aria-label={t('Abrir menu')}
            onClick={() => setMenuAberto(a => !a)}
          >
            <Icon name="menu" />
          </button>
          {/* Contexto antes de tudo: em que grupo estou, e que tela é esta. */}
          <div className="pn-ctx">
            <p className="pn-crumb">
              <span className="pn-crumb-g">{t(telaAtual.grupo)}</span>
              <span className="pn-crumb-g" aria-hidden="true"> / </span>
              <b>{t(telaAtual.rotulo)}</b>
            </p>
          </div>
          <SeletorModo />
          <BuscaGlobal setTab={setTab} />
          <div className="top-acoes">
            <SeletorIdioma tab={tab} />
            <SeletorTema />
            <button
              type="button"
              className="pn-tbtn"
              onClick={() => { setTourIdx(0); setTourAberto(true); }}
            >
              <Icon name="help" />
              <span className="rotulo-longo">{t('Como funciona')}</span>
            </button>
            <Notificacoes setTab={setTab} />
            <Perfil />
          </div>
          {/* Status da rede: ponto pulsante, slot e contagem de transações, tudo
              lido do estado, e não escrito à mão. */}
          <div className="pn-netpill">
            <span className="pn-pulse" aria-hidden="true" />
            <div>
              <b>{t('Devnet ativa')}</b>
              <span>slot {state.slot} · {state.transacoes.length} {t('transações')}</span>
            </div>
          </div>
        </header>

        <div className="pn-stage">
          {ehSubaba(tab) && (
            <div className="pn-subabas" role="tablist" aria-label={t('Famílias e carteiras')}>
              {SUBABAS.map(([id, rot]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                >
                  {t(rot)}
                </button>
              ))}
            </div>
          )}
          <Suspense fallback={<Carregando />}>
          <div key={tab} className="vista">
            {tab === 'dashboard' && <VisaoGeral irPara={irPara} />}
            {tab === 'trilha' && <Trilha />}
            {tab === 'coleta' && <Coleta />}
            {tab === 'validacao' && <Validacao />}
            {tab === 'conferencia' && <Conferencia embutido />}
            {tab === 'mercado' && <Mercado />}
            {tab === 'fundo' && <Fundo />}
            {tab === 'cadastro' && <Cadastro />}
            {tab === 'carteira' && <Carteira />}
            {tab === 'familia' && <PaginaFamilia />}
          </div>
          </Suspense>

          <NavJornada tab={tab} setTab={setTab} />

          <footer className="pn-footer">
            <p>
              <b>Plataforma Raízes do Futuro</b> · vencedor do Youth Challenge Blockchain (UNICEF Brasil)
              <br />
              Cofre multisig real na Solana devnet · jornada do app simulada
            </p>
            {/* Só quem está de pé.
                A Rede Recy saiu desta faixa: o FundoInfancia.sol foi escrito no
                padrão dela e auditado, mas NÃO está implantado (o cabeçalho do
                contrato diz isso em letras maiúsculas), e não há proxy na
                Sepolia. Logo de parceiro ao lado de Vivá, DeTrash e Solana lê
                como integração ativa — e a submissão afirma o contrário. Quando
                o proxy existir, o logo volta.
                Caminhos relativos: o absoluto `/logos/…` quebra se o MVP for
                publicado sob subcaminho (GitHub Pages). */}
            <div className="pn-footer-logos">
              <img src="./logos/Viva.png" alt="Instituto Vivá" title="Instituto Vivá: presença territorial e validação social" />
              <img src="./logos/Detrash.png" alt="DeTrash" title="DeTrash: metodologia de validação ambiental" />
              <img src="./logos/SOL-logo.png" alt="Solana" title="Solana: cofre multisig 2-de-3 na devnet" />
            </div>
            <div className="pn-fbtns">
              <button type="button" className="pn-tbtn" onClick={exportar}>
                <Icon name="download" />
                {t('Exportar dados')}
              </button>
              <details className="painel-config">
                <summary className="pn-tbtn">
                  <Icon name="gear" />
                  {t('Configurações')}
                </summary>
                <div className="painel-config-corpo">
                  <p className="mini">Controles de apresentação e de simulação.</p>
                  {recusadasApp > 0 && (
                    <div className="recusadas-lista">
                      <b>{recusadasApp} operação(ões) recusadas</b>
                      <p className="mini">
                        O servidor negou em definitivo, e elas não serão reenviadas. Saíram da
                        fila para não travar o resto do trabalho.
                      </p>
                      {(listaRecusadasApp?.() || []).slice(-4).reverse().map((r, i) => (
                        <div key={i} className="mini recusada-item">
                          <b>{r.op?.tipo}</b> · {String(r.motivo).slice(0, 120)}
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="acao sec bloco" onClick={ligarGravacao}>Modo gravação</button>
                  <button className="acao sec bloco" onClick={resetar}>Resetar demo</button>
                </div>
              </details>
            </div>
          </footer>
        </div>
      </div>

      {/* Botao, e nao div com onClick: o veu e uma acao de verdade (fechar o
          menu), e como botao ele recebe foco, responde a Enter e a Espaco, e e
          anunciado com nome. Como div, so servia para quem usa mouse. */}
      {menuAberto && (
        <button
          type="button"
          className="lateral-veu"
          aria-label="Fechar menu"
          onClick={() => setMenuAberto(false)}
        />
      )}

      {gravando && (
        <button className="sair-gravacao" title="Sair do modo gravação" onClick={() => setGravando(false)}><Icon name="close" /></button>
      )}

      <CamadaDeDicas />
      <DemoNarrador />
      {tourAberto && (
        <TourPainel indice={tourIdx} setIndice={setTourIdx} setTab={setTab} aoFechar={fecharTour} />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   As rotas que precisam do estado da operação, com os provedores em volta.
   O `App` decide qual é; aqui só se monta o que ela pede.
--------------------------------------------------------------------------- */
export default function PainelApp({ rota }) {
  const [tab, setTab] = useState('dashboard');

  // rota pública do rastreio: o turista escaneia o QR da peça e cai aqui, sem painel nenhum
  if (rota.startsWith('#/rastreio/')) {
    const codigo = decodeURIComponent(rota.slice('#/rastreio/'.length)).trim();
    return (
      <StoreProvider>
        <IdiomaProvider>
          <ToastProvider>
            <DemoProvider setTab={() => {}}>
              <Suspense fallback={<Carregando />}><PaginaRastreio codigo={codigo} /></Suspense>
            </DemoProvider>
          </ToastProvider>
        </IdiomaProvider>
      </StoreProvider>
    );
  }

  // rota standalone da família: abre só o app do celular, sem o painel
  if (rota.startsWith('#/familia')) {
    return (
      <StoreProvider>
        <ToastProvider>
          <DemoProvider setTab={() => {}}>
            <AvisosDeRede />
            {/* O sprite mora no topo do painel, e esta rota não passa por lá.
                Sem ele, cada `<use>` do app da família aponta para um símbolo
                que não existe e o ícone some sem erro nenhum no console. */}
            <SpriteIcones />
            <div className="rota-familia">
              <Suspense fallback={<Carregando />}><PaginaFamilia standalone /></Suspense>
              {/* `setRota('')` levava ao painel quando o painel morava na raiz.
                  Com a landing na raiz, rota vazia cai no `return <Landing/>` do
                  fim: o link dizia "Voltar ao painel do projeto" e abria a página
                  de apresentação. Agora aponta para onde o painel realmente está.
                  Via hash, para o botão de voltar do navegador continuar servindo. */}
              <a className="voltar-painel" href="#/painel">Voltar ao painel do projeto</a>
            </div>
          </DemoProvider>
        </ToastProvider>
      </StoreProvider>
    );
  }

  // painel operacional — vive em #/painel, não mais na raiz
  return (
    <StoreProvider>
      <IdiomaProvider>
        <ToastProvider>
          <DemoProvider setTab={setTab}>
            <ModoProvider>
              <AvisosDeRede />
              <Painel tab={tab} setTab={setTab} />
            </ModoProvider>
          </DemoProvider>
        </ToastProvider>
      </IdiomaProvider>
    </StoreProvider>
  );
}
