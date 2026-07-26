import React from 'react';
import { useStore, fmt, disponivelCofre, REDE, PROVIDER_CARTEIRA, BONUS_POR_CRIANCA } from '../store.jsx';
import { ValorAnimado, EstadoVazio } from '../ui.jsx';
import { BarrasKgSemana, DonutReceita } from '../graficos.jsx';
import { useDemo, useDestaque } from '../demo.jsx';

const METAS = { kg: 12000, familias: 30, criancas: 60, receita: 42000 };

function Kpi({ num, valor, rot, meta, pct }) {
  return (
    <div className="card kpi">
      {valor != null ? <ValorAnimado valor={valor} className="num" /> : <div className="num">{num}</div>}
      <div className="rot">{rot}</div>
      {meta && <div className="meta">Meta do piloto: {meta}</div>}
      {pct != null && <div className="barra"><div style={{ width: Math.min(100, pct) + '%' }} /></div>}
    </div>
  );
}

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

  return (
    <>
      <div className="dash-topo">
        <h2 style={{ margin: 0 }}>Dashboard de Impacto — Piloto Boipeba</h2>
        {rodando
          ? <button className="acao sec" onClick={parar}>■ Parar demonstração</button>
          : <button className="acao btn-demo" onClick={iniciar}>▶ Ver o ciclo completo</button>}
      </div>
      <p className="mini so-sim">
        O modo guiado executa a jornada inteira — coleta, validação, venda, split, comprovação, multisig 2-de-3 e saque —
        trocando de aba automaticamente. Ideal para gravar a apresentação.
      </p>

      <div className={'fluxo' + focoFluxo}>
        <span className="et">Resíduo</span><span className="seta">→</span>
        <span className="et">Coleta</span><span className="seta">→</span>
        <span className="et">Validação</span><span className="seta">→</span>
        <span className="et">Circularidade</span><span className="seta">→</span>
        <span className="et">Receita</span><span className="seta">→</span>
        <span className="et">Cofre 2-de-3</span><span className="seta">→</span>
        <span className="et">Saúde + Educação</span>
      </div>

      <div className={'grid g2 graficos-area' + focoGraf}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>♻️ Quilos validados por semana</h3>
          <BarrasKgSemana coletas={state.coletas} />
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>💰 Receita por fonte</h3>
          <DonutReceita vendas={state.vendas} />
        </div>
      </div>

      <h3>🌊 Ambiental</h3>
      <div className="grid g4">
        <Kpi num={(kg / 1000).toLocaleString('pt-BR')} rot="toneladas validadas" meta="12 t" pct={kg / METAS.kg * 100} />
        <Kpi num={validadas.length} rot="ações de coleta validadas" meta="24 ações" />
        <Kpi num={state.relatorios.length} rot="Relatórios de Circularidade" meta="6 relatórios" />
        <Kpi num={pendentesColeta} rot="coletas aguardando validação" />
      </div>

      <h3>💰 Econômico</h3>
      <div className="grid g4">
        <Kpi valor={receita} rot="receita total gerada" meta="R$ 42 mil" pct={receita / METAS.receita * 100} />
        <Kpi valor={state.caixas.renda} rot="renda direta (60%, incondicional)" />
        <Kpi valor={state.caixas.fundo} rot="cofre Fundo Infância (25%)" meta={`livre: ${fmt(disponivelCofre(state))}`} />
        <Kpi num={state.vendas.length} rot="vendas realizadas" />
      </div>

      <h3>🧒 Social</h3>
      <div className="grid g4">
        <Kpi num={state.familias.length} rot="famílias participantes" meta="30 famílias" pct={state.familias.length / METAS.familias * 100} />
        <Kpi num={criancas} rot="crianças acompanhadas" meta="60 crianças" pct={criancas / METAS.criancas * 100} />
        <Kpi valor={state.caixas.fundoLiberado} rot="bônus liberados às famílias" />
        <Kpi num={`${condOk}/${condicoes.length}`} rot="condições cumpridas e liberadas" />
      </div>

      <h3>🔗 Confiança digital ({REDE})</h3>
      <div className="grid g4">
        <Kpi num={state.transacoes.length} rot="transações rastreáveis" meta={`slot atual: ${state.slot}`} />
        <Kpi num={comCarteira + '/' + state.familias.length} rot={`famílias com conta ${PROVIDER_CARTEIRA}`} />
        <Kpi num={propostasAbertas} rot="propostas aguardando assinatura" meta="limiar 2 de 3" />
        <Kpi valor={reservado} rot="bônus reservado (nunca perdido)" />
      </div>

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
