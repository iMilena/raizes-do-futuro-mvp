import React from 'react';
import { useStore, fmt, trunc, tipoTx, disponivelCofre, REDE, PROVIDER_CARTEIRA, BONUS_POR_CRIANCA } from '../store.jsx';
import { ValorAnimado, EstadoVazio, useContagem } from '../ui.jsx';
import { BarrasKgSemana, DonutReceita } from '../graficos.jsx';
import { useDemo, useDestaque } from '../demo.jsx';

const METAS = { kg: 12000, familias: 30, criancas: 60, receita: 42000 };

/* ---------- anel de progresso geral do piloto ---------- */
function AnelProgresso({ pct }) {
  const mostrado = useContagem(pct, 1100);
  const R = 42, C = 2 * Math.PI * R;
  return (
    <div className="anel-wrap" title="Média de avanço das 4 metas do piloto">
      <svg viewBox="0 0 100 100" className="anel">
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="9" />
        <circle cx="50" cy="50" r={R} fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(100, mostrado) / 100)}
          transform="rotate(-90 50 50)" />
        <text x="50" y="47" textAnchor="middle" fontSize="20" fontWeight="900" fill="#fff">
          {Math.round(mostrado)}%
        </text>
        <text x="50" y="62" textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,.85)">do piloto</text>
      </svg>
    </div>
  );
}

/* ---------- KPI com meta ---------- */
function Kpi({ num, valor, rot, meta, pct, icone }) {
  return (
    <div className="card kpi">
      {icone && <span className="kpi-ico" aria-hidden="true">{icone}</span>}
      {valor != null ? <ValorAnimado valor={valor} className="num" /> : <div className="num">{num}</div>}
      <div className="rot">{rot}</div>
      {meta && (
        <div className="meta">
          Meta: {meta}{pct != null && <b className="kpi-pct"> · {Math.min(100, Math.round(pct))}%</b>}
        </div>
      )}
      {pct != null && <div className="barra"><div style={{ width: Math.min(100, pct) + '%' }} /></div>}
    </div>
  );
}

/* ---------- painel por dimensão de impacto ---------- */
function Dimensao({ classe, icone, titulo, resumo, children }) {
  return (
    <section className={'dim ' + classe}>
      <header className="dim-topo">
        <span className="dim-ico" aria-hidden="true">{icone}</span>
        <div className="dim-tit">
          <b>{titulo}</b>
          {resumo && <span>{resumo}</span>}
        </div>
      </header>
      <div className="grid g4">{children}</div>
    </section>
  );
}

/* ---------- etapas da jornada ---------- */
const ETAPAS = [
  ['🌊', 'Resíduo', 'chega à praia'],
  ['🧹', 'Coleta', 'comunidade age'],
  ['✅', 'Validação', 'DeTrash confere'],
  ['📄', 'Circularidade', 'vira evidência'],
  ['💰', 'Receita', 'turista + empresa'],
  ['🔗', 'Cofre 2-de-3', 'split 60/25/15'],
  ['🧒', 'Infância', 'saúde + educação'],
];

export default function Dashboard() {
  const { state } = useStore();
  const { rodando, iniciar, parar } = useDemo();
  const focoFluxo = useDestaque('fluxo');
  const focoGraf = useDestaque('graficos');

  const validadas = state.coletas.filter(c => c.status === 'validada');
  const kg = validadas.reduce((a, c) => a + Number(c.kg), 0);
  const receita = state.vendas.reduce((a, v) => a + v.valor, 0);
  const comCarteira = state.familias.filter(f => f.carteira).length;
  const criancas = state.familias.reduce((a, f) => a + f.criancas, 0);
  const condicoes = state.familias.flatMap(f => f.condicoes);
  const condOk = condicoes.filter(c => c.status === 'liberada').length;
  const pendentesColeta = state.coletas.filter(c => c.status === 'pendente').length;
  const propostasAbertas = state.propostas.filter(p => p.status === 'aguardando').length;
  const reservado = state.propostas.filter(p => p.status === 'reservada').reduce((a, p) => a + p.valor, 0);
  const paraFamilias = state.caixas.renda + state.caixas.fundoLiberado;

  const pctGeral = (
    Math.min(1, kg / METAS.kg) +
    Math.min(1, receita / METAS.receita) +
    Math.min(1, state.familias.length / METAS.familias) +
    Math.min(1, criancas / METAS.criancas)
  ) / 4 * 100;

  const feed = [...state.transacoes].slice(-4).reverse();

  return (
    <>
      {/* ---------------- hero de impacto ---------------- */}
      <div className="hero-dash">
        <div className="hero-info">
          <span className="hero-chip">📍 Piloto Boipeba, BA · cofre 2-de-3 real na {REDE} devnet</span>
          <h2 className="hero-titulo">Impacto em tempo real</h2>
          <div className="hero-nums">
            <div>
              <b>{(kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t</b>
              <span>resíduos validados</span>
            </div>
            <div>
              <b><ValorAnimado valor={paraFamilias} /></b>
              <span>direto para as famílias</span>
            </div>
            <div>
              <b>{criancas}</b>
              <span>crianças acompanhadas</span>
            </div>
          </div>
          {rodando
            ? <button className="acao sec hero-btn" onClick={parar}>■ Parar demonstração</button>
            : <button className="acao btn-demo hero-btn" onClick={iniciar}>▶ Ver o ciclo completo</button>}
        </div>
        <AnelProgresso pct={pctGeral} />
      </div>
      <p className="mini so-sim centro">
        O modo guiado executa a jornada inteira — coleta, validação, venda, split, multisig 2-de-3 e saque — trocando de aba sozinho. Ideal para gravar a apresentação.
      </p>

      {/* ---------------- jornada do ciclo ---------------- */}
      <div className={'jornada' + focoFluxo}>
        {ETAPAS.map(([ic, rot, sub], i) => (
          <React.Fragment key={rot}>
            <div className="jornada-etapa">
              <span className="jornada-num">{i + 1}</span>
              <span className="jornada-icone">{ic}</span>
              <b>{rot}</b>
              <small>{sub}</small>
            </div>
            {i < ETAPAS.length - 1 && <span className="jornada-seta" aria-hidden="true">›</span>}
          </React.Fragment>
        ))}
      </div>

      {/* ---------------- gráficos + feed ---------------- */}
      <div className={'grid g2 graficos-area' + focoGraf} style={{ marginTop: 14 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>♻️ Quilos validados por semana</h3>
          <BarrasKgSemana coletas={state.coletas} />
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>💰 Receita por fonte</h3>
          <DonutReceita vendas={state.vendas} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="feed-topo">
          <h3 style={{ margin: 0 }}>⚡ Últimas atividades na rede</h3>
          <span className="mini">slot atual: {state.slot} · {state.transacoes.length} transações</span>
        </div>
        {feed.length === 0 && <EstadoVazio icone="🌱" titulo="Nenhuma atividade ainda" />}
        <div className="feed">
          {feed.map(t => (
            <div className="feed-item" key={t.seq}>
              <i style={{ background: tipoTx(t.tipo).cor }} />
              <div className="feed-meio">
                <b style={{ color: tipoTx(t.tipo).cor }}>{t.tipo}</b>
                <span>{t.desc}</span>
              </div>
              <div className="feed-dir">
                {t.valor > 0 && <b>{fmt(t.valor)}</b>}
                <span className="hash">{trunc(t.signature, 4, 4)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- metas por dimensão ---------------- */}
      <Dimensao classe="dim-ambiental" icone="🌊" titulo="Ambiental"
        resumo={`${(kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t de resíduos fora da praia e da natureza`}>
        <Kpi icone="⚖️" num={(kg / 1000).toLocaleString('pt-BR')} rot="toneladas validadas" meta="12 t" pct={kg / METAS.kg * 100} />
        <Kpi icone="🧹" num={validadas.length} rot="ações de coleta validadas" meta="24 ações" pct={validadas.length / 24 * 100} />
        <Kpi icone="📄" num={state.relatorios.length} rot="Relatórios de Circularidade" meta="6 relatórios" pct={state.relatorios.length / 6 * 100} />
        <Kpi icone="⏳" num={pendentesColeta} rot="coletas aguardando validação" />
      </Dimensao>

      <Dimensao classe="dim-economico" icone="💰" titulo="Econômico"
        resumo={`${fmt(receita)} movimentados por turismo responsável e ESG`}>
        <Kpi icone="📈" valor={receita} rot="receita total gerada" meta="R$ 42 mil" pct={receita / METAS.receita * 100} />
        <Kpi icone="🤲" valor={state.caixas.renda} rot="renda direta (60%, incondicional)" />
        <Kpi icone="🔐" valor={state.caixas.fundo} rot="cofre Fundo Infância (25%)" meta={`livre: ${fmt(disponivelCofre(state))}`} />
        <Kpi icone="🛒" num={state.vendas.length} rot="vendas realizadas" />
      </Dimensao>

      <Dimensao classe="dim-social" icone="🧒" titulo="Social"
        resumo={`${criancas} crianças com saúde e escola acompanhadas`}>
        <Kpi icone="👨‍👩‍👧" num={state.familias.length} rot="famílias participantes" meta="30 famílias" pct={state.familias.length / METAS.familias * 100} />
        <Kpi icone="🎒" num={criancas} rot="crianças acompanhadas" meta="60 crianças" pct={criancas / METAS.criancas * 100} />
        <Kpi icone="🎁" valor={state.caixas.fundoLiberado} rot="bônus liberados às famílias" />
        <Kpi icone="✅" num={`${condOk}/${condicoes.length}`} rot="condições cumpridas e liberadas" />
      </Dimensao>

      <Dimensao classe="dim-confianca" icone="🔗" titulo={`Confiança digital (${REDE})`}
        resumo="cada centavo rastreável, nenhuma organização decide sozinha">
        <Kpi icone="🧾" num={state.transacoes.length} rot="transações rastreáveis" meta={`slot atual: ${state.slot}`} />
        <Kpi icone="🧺" num={comCarteira + '/' + state.familias.length} rot={`famílias com conta ${PROVIDER_CARTEIRA}`} />
        <Kpi icone="🗳️" num={propostasAbertas} rot="propostas aguardando assinatura" meta="limiar 2 de 3" />
        <Kpi icone="🔒" valor={reservado} rot="bônus reservado (nunca perdido)" />
      </Dimensao>

      {condicoes.length === 0 && (
        <EstadoVazio icone="👨‍👩‍👧" titulo="Nenhuma família cadastrada com compromissos"
          dica="Use o botão Resetar demo no rodapé para restaurar os dados do piloto." />
      )}

      <div className="aviso">
        <b>Princípio do modelo:</b> a renda do trabalho (60%) é paga diretamente e é <b>incondicional</b>.
        O cofre multisig administra apenas o <b>Fundo Infância</b> (25%) — um bônus adicional de {fmt(BONUS_POR_CRIANCA)} por
        criança/mês por compromissos de saúde e educação, que fica <b>reservado (nunca perdido)</b> quando a condição ainda não foi comprovada.
        Nenhuma organização move esse dinheiro sozinha: são necessárias <b>2 das 3 assinaturas</b> (Instituto Vivá, DeTrash e Representante Comunitário).
      </div>
    </>
  );
}
