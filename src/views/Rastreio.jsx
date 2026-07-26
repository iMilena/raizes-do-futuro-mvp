import React from 'react';
import { useStore, fmt, trunc, vendaPorRastreio, SPLIT, BONUS_POR_CRIANCA } from '../store.jsx';
import { EstadoVazio, QrCode } from '../ui.jsx';

/* ---------------------------------------------------------------------------
   Página pública de rastreio — o que o turista vê ao escanear o QR do produto.

   Sem login, mobile-first, e escrita para quem acabou de comprar um chaveiro
   na praia: "de onde veio esse material e para onde foi o meu dinheiro".
   Nada de dado de família ou criança aqui — só a jornada do material e a
   divisão da receita.
--------------------------------------------------------------------------- */

function Etapa({ n, icone, titulo, children, ultima }) {
  return (
    <div className={'etapa' + (ultima ? ' ultima' : '')}>
      <div className="etapa-marca">
        <span className="etapa-num">{icone || n}</span>
      </div>
      <div className="etapa-corpo">
        <b>{titulo}</b>
        {children}
      </div>
    </div>
  );
}

export default function Rastreio({ codigo }) {
  const { state } = useStore();
  const venda = vendaPorRastreio(state, codigo);

  if (!venda) {
    return (
      <div className="rastreio-tela">
        <div className="rastreio-topo">
          <div className="fam-marca">🌱 Raízes do Futuro</div>
          <div className="fam-sub">Rastreio de produto · Boipeba, BA</div>
        </div>
        <div className="rastreio-corpo">
          <EstadoVazio icone="🔍" titulo={`Código ${codigo || '—'} não encontrado`}
            dica="Confira o código impresso na etiqueta. Cada produto tem o seu, no formato RF-XXXX." />
          <a className="voltar-painel" href="#/">ver o projeto</a>
        </div>
      </div>
    );
  }

  const coletas = (venda.origem || []).map(id => state.coletas.find(c => c.id === id)).filter(Boolean);
  const kgTotal = coletas.reduce((a, c) => a + Number(c.kg), 0);
  const paraColetor = venda.valor * SPLIT.renda;
  const paraFundo = venda.valor * SPLIT.fundo;
  const paraOperacao = venda.valor * SPLIT.operacao;

  // relatório de circularidade mais recente que já existia quando a peça foi vendida
  const relatorio = [...state.relatorios]
    .filter(r => r.data <= venda.data)
    .sort((a, b) => a.data.localeCompare(b.data))
    .pop();

  const txVenda = state.transacoes.find(t => t.tipo === 'RECEITA' && t.vendaId === venda.id);
  const fracaoBonus = paraFundo / BONUS_POR_CRIANCA;

  return (
    <div className="rastreio-tela">
      <div className="rastreio-topo">
        <div className="fam-marca">🌱 Raízes do Futuro</div>
        <div className="fam-sub">A história desta peça · Boipeba, BA</div>
      </div>

      <div className="rastreio-corpo">
        <div className="card rastreio-cabeca">
          <div className="rastreio-codigo">{venda.rastreio}</div>
          <h2 style={{ margin: '4px 0 2px' }}>{venda.descricao}</h2>
          <div className="mini">vendida em {new Date(venda.data + 'T12:00:00').toLocaleDateString('pt-BR')} · {fmt(venda.valor)}</div>
        </div>

        <h3 className="fam-h3">🧭 A jornada deste material</h3>

        <div className="etapas">
          {coletas.length > 0 ? coletas.map((c, i) => (
            <Etapa key={c.id} icone="🧹" titulo={`Recolhido na ${c.local}`}>
              <div className="mini">
                {c.kg} kg de {c.material.toLowerCase()} · por {c.coletor} ·{' '}
                {new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR')}
              </div>
              {i === coletas.length - 1 && coletas.length > 1 && (
                <div className="mini">total de {kgTotal} kg neste lote</div>
              )}
            </Etapa>
          )) : (
            <Etapa icone="🧹" titulo="Recolhido na ilha de Boipeba">
              <div className="mini">material do estoque já verificado pela DeTrash</div>
            </Etapa>
          )}

          <Etapa icone="✅" titulo="Verificado pela DeTrash">
            <div className="mini">
              A pesagem e a origem foram conferidas pela metodologia da DeTrash antes de virar produto.
            </div>
            {coletas[0]?.signature && (
              <div className="hash">registro: {trunc(coletas[0].signature, 10, 10)}</div>
            )}
          </Etapa>

          {relatorio && (
            <Etapa icone="📄" titulo="Somado ao Relatório de Circularidade">
              <div className="mini">
                {relatorio.periodo} — {relatorio.kg} kg verificados no período
              </div>
              {relatorio.ancoragem && (
                <div className="mini">⚓ relatório ancorado na {relatorio.ancoragem.rede}</div>
              )}
            </Etapa>
          )}

          <Etapa icone="🛒" titulo="Sua compra">
            <div className="mini">{fmt(venda.valor)} entraram no ciclo do projeto.</div>
            {txVenda && <div className="hash">transação registrada no slot {txVenda.slot}</div>}
          </Etapa>

          <Etapa icone="💚" titulo="Para onde foi o seu dinheiro" ultima>
            <div className="divisao">
              <div className="divisao-linha">
                <span>Renda de quem coletou</span>
                <b>{fmt(paraColetor)}</b>
                <i style={{ width: SPLIT.renda * 100 + '%', background: 'var(--azul)' }} />
              </div>
              <div className="divisao-linha">
                <span>Fundo Infância</span>
                <b>{fmt(paraFundo)}</b>
                <i style={{ width: SPLIT.fundo * 100 + '%', background: 'var(--verde)' }} />
              </div>
              <div className="divisao-linha">
                <span>Operação na ilha</span>
                <b>{fmt(paraOperacao)}</b>
                <i style={{ width: SPLIT.operacao * 100 + '%', background: '#f2c14e' }} />
              </div>
            </div>
            <div className="aviso" style={{ marginTop: 10 }}>
              <b>O que isso significa:</b> {fmt(paraColetor)} foram direto para quem tirou esse material da
              praia — sem condição nenhuma. E {fmt(paraFundo)} entraram no Fundo Infância, que paga{' '}
              {fmt(BONUS_POR_CRIANCA)} por criança com saúde e escola em dia. Só esta peça já cobre{' '}
              <b>{Math.round(fracaoBonus * 100)}%</b> de um bônus mensal de uma criança.
            </div>
          </Etapa>
        </div>

        <div className="card centro rastreio-qr">
          <div className="mini">o código desta peça</div>
          <QrCode texto={typeof location !== 'undefined' ? location.href : venda.rastreio} lado={132}
            titulo={`Código de rastreio ${venda.rastreio}`} />
          <div className="mini">Mostre para outra pessoa escanear — a história é pública e verificável.</div>
        </div>

        <a className="voltar-painel" href="#/">conhecer o projeto Raízes do Futuro</a>
      </div>
    </div>
  );
}
