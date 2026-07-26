import React, { useEffect, useState } from 'react';
import { useStore, fmt, trunc, disponivelCofre, BONUS_POR_CRIANCA, PROVIDER_CARTEIRA } from '../store.jsx';
import { useToast, EstadoVazio } from '../ui.jsx';
import { useDestaque } from '../demo.jsx';
import { statusAncoragem, ancorarRelatorio, motivoLegivel } from '../recy.js';

/* ---------- ancoragem real do relatório na Rede Recy ---------- */
function Ancoragem({ relatorio }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { statusAncoragem().then(setStatus); }, []);

  if (relatorio.ancoragem) {
    const a = relatorio.ancoragem;
    return (
      <div className="ancorado">
        ⚓ <b>ancorado na {a.rede}</b>
        <span className="tag ok">registro real</span>
        <div className="hash">SHA-256 {trunc(a.hash, 12, 12)}</div>
        <div className="hash">tx {trunc(a.txId, 10, 10)}</div>
        {a.url && <a href={a.url} target="_blank" rel="noreferrer noopener">conferir na Recy ↗</a>}
      </div>
    );
  }

  const ancorar = async () => {
    setOcupado(true);
    const r = await ancorarRelatorio(relatorio);
    setOcupado(false);
    if (r.ok) {
      dispatch({ type: 'ANCORAR_RELATORIO', id: relatorio.id, ancoragem: r });
      toast('Relatório ancorado na Rede Recy ⚓');
    } else {
      toast(`Não foi possível ancorar: ${motivoLegivel(r.motivo)}`, 'alerta', 5000);
    }
  };

  if (!status) return <div className="mini">verificando ancoragem…</div>;

  if (!status.disponivel) {
    return (
      <div className="mini nao-ancorado">
        ⚓ ancoragem real indisponível ({motivoLegivel(status.motivo)}) — o relatório vale
        normalmente na demo, apenas sem registro externo
      </div>
    );
  }

  return (
    <button className="acao sec" style={{ marginTop: 6 }} disabled={ocupado} onClick={ancorar}>
      {ocupado ? 'ancorando…' : '⚓ Ancorar na Rede Recy (real)'}
    </button>
  );
}

export default function Validacao() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [periodo, setPeriodo] = useState('Julho 2026 — quinzena 2');
  const focoColetas = useDestaque('validar-coletas');
  const focoRel = useDestaque('relatorio');
  const focoComp = useDestaque('comprovacoes');

  const pendentes = state.coletas.filter(c => c.status === 'pendente');
  const comprovadas = state.familias.flatMap(f => f.condicoes.filter(c => c.status === 'comprovada').map(c => ({ f, c })));
  const livre = disponivelCofre(state);

  const validarColeta = c => {
    dispatch({ type: 'VALIDAR_COLETA', id: c.id });
    toast(`Coleta de ${c.kg} kg validada ✔`);
  };

  const emitir = () => {
    dispatch({ type: 'EMITIR_RELATORIO', periodo });
    toast('Relatório de Circularidade emitido 📄');
  };

  const validarCondicao = (f, c) => {
    const valor = BONUS_POR_CRIANCA * f.criancas;
    const reserva = !f.carteira || livre < valor;
    dispatch({ type: 'VALIDAR_CONDICAO', familiaId: f.id, condicaoId: c.id });
    toast(reserva
      ? `Validado — ${fmt(valor)} reservado para ${f.resp} 🔒`
      : `Proposta criada no cofre — aguardando 2 de 3 assinaturas 🗳️`, reserva ? 'alerta' : 'info');
  };

  return (
    <>
      <h2>Instituto Vivá — validação (oráculo credenciado)</h2>

      <div className="grid g2">
        <div className={'card destaque' + focoColetas + focoRel}>
          <h3>1 · Coletas aguardando validação DeTrash</h3>
          {pendentes.length === 0 && (
            <EstadoVazio icone="✅" titulo="Nenhuma coleta pendente" dica="Registre uma nova ação na aba 🧹 Coletor." />
          )}
          {pendentes.map(c => (
            <div key={c.id} className="item-validar">
              <b>{c.kg} kg — {c.material}</b>
              <div className="mini">{c.coletor} · {c.local} · {c.data}</div>
              <button className="acao" style={{ marginTop: 6 }} onClick={() => validarColeta(c)}>
                Validar (critérios DeTrash)
              </button>
            </div>
          ))}

          <h3 style={{ marginTop: 20 }}>Emitir Relatório de Circularidade</h3>
          <label>Período</label>
          <input value={periodo} onChange={e => setPeriodo(e.target.value)} />
          <button className="acao sec" style={{ marginTop: 8 }} onClick={emitir}>
            Consolidar coletas validadas em relatório
          </button>
          {state.relatorios.length === 0 && <p className="mini">Nenhum relatório emitido ainda.</p>}
          {[...state.relatorios].reverse().map(r => (
            <div key={r.id} style={{ marginTop: 10, fontSize: 13 }}>
              📄 <b>{r.periodo}</b> — {r.kg} kg, {r.acoes} ações
              <div className="hash">{trunc(r.signature, 12, 12)}</div>
              <Ancoragem relatorio={r} />
            </div>
          ))}
        </div>

        <div className={'card destaque' + focoComp}>
          <h3>2 · Comprovações de saúde/educação (dupla checagem)</h3>
          <p className="mini">
            Documentos ficam no ambiente seguro (off-chain). Ao validar, só o hash vai à rede e o cofre multisig
            <b> cria uma proposta</b> de transferência — que ainda precisa de 2 das 3 assinaturas para executar.
          </p>
          <div className="cofre-livre">
            💰 Livre no cofre para novas propostas: <b>{fmt(livre)}</b>
          </div>
          {comprovadas.length === 0 && (
            <EstadoVazio icone="📭" titulo="Nenhuma comprovação aguardando validação"
              dica="As famílias enviam as fotos pela aba 📱 App da Família." />
          )}
          {comprovadas.map(({ f, c }) => {
            const valor = BONUS_POR_CRIANCA * f.criancas;
            const reserva = !f.carteira || livre < valor;
            return (
              <div key={c.id} className="item-validar">
                <b>{f.resp}</b> — {c.tipo} <span className="tag info">{c.mes}</span>
                <div className="mini">{f.criancas} criança(s) · bônus previsto: {fmt(valor)}</div>
                {reserva && (
                  <div className="mini alerta-txt">
                    ⚠️ {!f.carteira ? `família sem conta ${PROVIDER_CARTEIRA}` : 'cofre sem saldo livre'} — o bônus será <b>reservado</b>, não perdido
                  </div>
                )}
                <button className="acao" style={{ marginTop: 6 }} onClick={() => validarCondicao(f, c)}>
                  {reserva ? 'Validar → reservar bônus' : 'Validar → criar proposta no cofre'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="aviso">
        <b>Governança:</b> cada comprovação passa por dois agentes do Instituto Vivá; a liberação do dinheiro exige
        <b> 2 de 3 assinaturas</b> no cofre (Instituto Vivá, DeTrash e Representante Comunitário); auditoria trimestral por
        parceiro externo; a família tem canal de recurso com resposta em até 15 dias.
      </div>
    </>
  );
}
