import React, { useEffect, useRef, useState } from 'react';
import { useStore, fmt, SPLIT } from '../store.jsx';
import { useToast, ValorAnimado, EstadoVazio } from '../ui.jsx';
import { useDestaque } from '../demo.jsx';

const PRODUTOS = [
  { nome: 'Luminária de vidro reaproveitado', preco: 80 },
  { nome: 'Bolsa de lona de vela reciclada', preco: 65 },
  { nome: 'Vaso de plástico prensado', preco: 40 },
  { nome: 'Chaveiro-lembrança de rede de pesca', preco: 25 },
];

const FATIAS = [
  { chave: 'renda', rot: 'Renda direta', sub: 'ao coletor, incondicional', pct: SPLIT.renda, cor: 'var(--azul)' },
  { chave: 'fundo', rot: 'Fundo Infância', sub: 'cofre multisig 2-de-3', pct: SPLIT.fundo, cor: 'var(--verde)' },
  { chave: 'operacao', rot: 'Operação', sub: 'logística e equipe local', pct: SPLIT.operacao, cor: '#f2c14e' },
];

/* ---------------------------------------------------------------------------
   Animação do split: a cada venda o valor "se divide" em 3 barras, com
   contadores movidos por requestAnimationFrame.
--------------------------------------------------------------------------- */
function AnimacaoSplit({ venda }) {
  const [t, setT] = useState(0); // 0 → 1
  const rafRef = useRef(0);

  useEffect(() => {
    if (!venda) return;
    setT(0);
    let inicio = null;
    const passo = agora => {
      if (inicio === null) inicio = agora;
      const p = Math.min(1, (agora - inicio) / 1500);
      setT(1 - Math.pow(1 - p, 3));
      if (p < 1) rafRef.current = requestAnimationFrame(passo);
    };
    rafRef.current = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(rafRef.current);
  }, [venda]);

  if (!venda) {
    return (
      <EstadoVazio icone="🔀" titulo="Nenhuma venda nesta sessão"
        dica="Compre um produto ou financie um relatório ESG para ver a divisão automática acontecer." />
    );
  }

  const max = Math.max(...FATIAS.map(f => f.pct));

  return (
    <div className="split-anim" key={venda.id}>
      <div className="split-origem">
        <span className="mini">{venda.descricao}</span>
        <div className="split-total">{fmt(venda.valor)}</div>
        <span className="mini">{venda.comprador}</span>
      </div>
      <div className="split-setas" aria-hidden="true">
        {FATIAS.map((f, i) => <span key={f.chave} style={{ animationDelay: i * 0.12 + 's' }} />)}
      </div>
      <div className="split-barras">
        {FATIAS.map(f => {
          const valor = venda.valor * f.pct * t;
          return (
            <div className="split-linha" key={f.chave}>
              <div className="split-rot">
                <b>{Math.round(f.pct * 100)}% · {f.rot}</b>
                <span className="mini">{f.sub}</span>
              </div>
              <div className="split-trilha">
                <div className="split-fill" style={{ width: (f.pct / max) * 100 * t + '%', background: f.cor }} />
              </div>
              <div className="split-valor" style={{ color: f.cor }}>
                {fmt(valor)}
              </div>
            </div>
          );
        })}
      </div>
      {t >= 1 && <div className="split-ok">✅ Divisão executada pelo contrato — sem intermediário decidindo</div>}
    </div>
  );
}

export default function Mercado() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [empresa, setEmpresa] = useState('');
  const [tipoEsg, setTipoEsg] = useState('esg');
  const focoSplit = useDestaque('split');

  const kgDisponivel = state.coletas.filter(c => c.status === 'validada').reduce((a, c) => a + Number(c.kg), 0);

  // acompanha a venda mais recente para disparar a animação (inclusive no modo demo)
  const [ultima, setUltima] = useState(null);
  const nRef = useRef(state.vendas.length);
  useEffect(() => {
    if (state.vendas.length > nRef.current) setUltima(state.vendas[state.vendas.length - 1]);
    else if (state.vendas.length < nRef.current) setUltima(null); // reset da demo
    nRef.current = state.vendas.length;
  }, [state.vendas]);

  const comprarProduto = p => {
    dispatch({ type: 'NOVA_VENDA', payload: { tipo: 'produto', descricao: p.nome, comprador: 'Turista', valor: p.preco } });
    toast(`${p.nome} vendido — ${fmt(p.preco)} 🛒`);
  };

  const comprarEsg = () => {
    const t = (kgDisponivel / 1000).toFixed(2);
    const desc = tipoEsg === 'esg' ? 'Relatório de Circularidade (patrocínio ESG)' : `Créditos de reciclagem (${t} t × R$ 250)`;
    const valor = tipoEsg === 'esg' ? 2500 : Math.max(1, Math.round(kgDisponivel / 1000 * 250));
    dispatch({ type: 'NOVA_VENDA', payload: { tipo: tipoEsg, descricao: desc, comprador: empresa || 'Empresa parceira', valor } });
    toast(`Impacto financiado — ${fmt(valor)} entrou no ciclo 🏢`);
    setEmpresa('');
  };

  return (
    <>
      <h2>Mercado — transformando impacto em valor</h2>
      <div className="grid g2">
        <div className="card destaque">
          <h3>🏖️ Turismo responsável</h3>
          <p style={{ fontSize: 13, color: 'var(--cinza)' }}>Produtos feitos com materiais recuperados na ilha. Cada compra alimenta o ciclo.</p>
          {PRODUTOS.map(p => (
            <div key={p.nome} className="produto">
              <div><b>{p.nome}</b><div className="mini">{fmt(p.preco)}</div></div>
              <button className="acao sec" onClick={() => comprarProduto(p)}>Comprar</button>
            </div>
          ))}
        </div>

        <div className="card destaque">
          <h3>🏢 Empresas — ESG</h3>
          <p style={{ fontSize: 13, color: 'var(--cinza)' }}>
            Financie resultados ambientais verificáveis ({(kgDisponivel / 1000).toFixed(2)} t já validadas pela DeTrash).
          </p>
          <label>Empresa</label>
          <input value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Ex.: Pousada Costa Verde" />
          <label>Produto</label>
          <select value={tipoEsg} onChange={e => setTipoEsg(e.target.value)}>
            <option value="esg">Relatório de Circularidade — R$ 2.500</option>
            <option value="credito">Créditos de reciclagem — R$ 250/t validada</option>
          </select>
          <button className="acao" style={{ marginTop: 12 }} onClick={comprarEsg}>Financiar impacto</button>
        </div>
      </div>

      <h3 className="ancora">🔀 Divisão automática da receita</h3>
      <div className={'card' + focoSplit}>
        <AnimacaoSplit venda={ultima} />
      </div>

      <div className="grid g4" style={{ marginTop: 12 }}>
        <div className="card kpi"><div className="num">60%</div><div className="rot">Renda direta</div><ValorAnimado valor={state.caixas.renda} className="meta forte" /></div>
        <div className="card kpi"><div className="num">25%</div><div className="rot">Fundo Infância</div><ValorAnimado valor={state.caixas.fundo + state.caixas.fundoLiberado} className="meta forte" /></div>
        <div className="card kpi"><div className="num">15%</div><div className="rot">Operação</div><ValorAnimado valor={state.caixas.operacao} className="meta forte" /></div>
        <div className="card kpi"><div className="num">{state.vendas.length}</div><div className="rot">vendas no piloto</div></div>
      </div>

      <h3>Vendas realizadas</h3>
      <div className="card">
        {state.vendas.length === 0
          ? <EstadoVazio icone="🛒" titulo="Nenhuma venda registrada" dica="Comece vendendo um produto do turismo responsável acima." />
          : (
            <table>
              <thead><tr><th>Data</th><th>Descrição</th><th>Comprador</th><th>Valor</th></tr></thead>
              <tbody>
                {[...state.vendas].reverse().map(v => (
                  <tr key={v.id}><td>{v.data}</td><td>{v.descricao}</td><td>{v.comprador}</td><td>{fmt(v.valor)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </>
  );
}
