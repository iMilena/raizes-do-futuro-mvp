import { useState } from 'react';
import { useStore, trunc } from '../estado/store.jsx';
import { Icon } from '../painel/ui/Icones.jsx';
import { TRILHAS } from '../painel/demo/setembro.js';
import './visao-geral.css';

/* ---------------------------------------------------------------------------
   Trilha de prova: um valor pago, e todas as provas que ele atravessou.

   As trilhas vêm de `painel/demo/setembro.js` (DEMONSTRAÇÃO). As etapas que
   são transações do cofre (a divisão da venda, a liberação do bônus) trocam o
   código de exemplo pela assinatura real da última transação do mesmo tipo no
   store, quando houver uma, e dizem que o código é real.
--------------------------------------------------------------------------- */
export default function Trilha() {
  const { state } = useStore();
  const [id, setId] = useState(TRILHAS[0].id);
  const trilha = TRILHAS.find((x) => x.id === id);

  const ultimaDoTipo = (tipo) => [...state.transacoes].reverse().find((tx) => tx.tipo === tipo);

  return (
    <div className="pn-screen tr">
      <header className="tr-head">
        <span className="vg-cap">Trilha de prova</span>
        <h1>Um real, do resíduo na praia até a criança.</h1>
        <p className="lead">
          Escolha qualquer valor pago e veja todas as provas que ele atravessou. É a resposta para a pergunta que todo
          investidor faz: como eu sei que o dinheiro chegou?
        </p>
      </header>

      <div className="tr-grid">
        <div className="pn-card pad tr-lado">
          <div className="vg-cap">Rastreando</div>
          <div className="tr-valor">{trilha.valor}</div>
          <p className="vg-sub" style={{ fontSize: 14 }}>
            {trilha.contexto}
          </p>
          <div className="tr-div" />
          <div className="vg-cap" id="tr-outros">
            Outros valores para rastrear
          </div>
          <div className="tr-outros" role="group" aria-labelledby="tr-outros">
            {TRILHAS.map((x) => (
              <button
                key={x.id}
                type="button"
                className="vg-det"
                aria-pressed={x.id === id}
                onClick={() => setId(x.id)}
              >
                {x.rotulo}
              </button>
            ))}
          </div>
          <div className="vg-hint" style={{ marginTop: 16 }}>
            <Icon name="shield" className="sm" />
            <div>
              Os dados das crianças não aparecem aqui. O painel mostra que a comprovação foi feita e por quem, nunca o
              conteúdo.
            </div>
          </div>
        </div>

        <div className="pn-card pad">
          <ol className="tr-tl" key={id}>
            {trilha.etapas.map(([titulo, quando, texto, [tipo, codigo, nota], tipoTx], i) => {
              const real = tipoTx ? ultimaDoTipo(tipoTx) : null;
              return (
                <li key={titulo} style={{ animationDelay: `${i * 0.08}s` }}>
                  <span className="dot" aria-hidden="true">
                    {i + 1}
                  </span>
                  <h3>{titulo}</h3>
                  <div className="when">{quando}</div>
                  <p>{texto}</p>
                  <div className="tr-proof" data-tip={`<b>${tipo}</b>${real ? 'transação real no painel' : nota}`}>
                    <Icon name="guide" className="sm" />
                    {tipo} <span className="mono">{real ? trunc(real.signature, 6, 4) : codigo}</span>
                    {real && <span className="real">registro real · slot {real.slot}</span>}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="vg-demo" style={{ marginTop: 18 }}>
            Trilhas de demonstração. Os códigos marcados como registro real vêm das transações do cofre neste painel.
          </p>
        </div>
      </div>
    </div>
  );
}
