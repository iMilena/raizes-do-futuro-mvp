import React, { useEffect, useState } from 'react';
import { useStore, fmt, trunc, disponivelCofre, BONUS_POR_CRIANCA, PROVIDER_CARTEIRA } from '../store.jsx';
import { useToast, EstadoVazio, Modal } from '../ui.jsx';
import { useDestaque } from '../demo.jsx';
import { hashRelatorio, comandoAncoragem, assinaturaValida, urlExplorer, REDE_ANCORAGEM } from '../ancoragem.js';

/* ---------------------------------------------------------------------------
   Ancoragem do relatório na Solana devnet.

   O app calcula o SHA-256 de verdade e mostra o comando; quem assina é o
   script em onchain/, com a chave na máquina de quem opera. Depois o operador
   cola a assinatura aqui e o selo aparece. Nenhuma chave privada no navegador.
--------------------------------------------------------------------------- */
function Ancoragem({ relatorio }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [hash, setHash] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [assinatura, setAssinatura] = useState('');
  const [copiado, setCopiado] = useState(null);

  useEffect(() => {
    hashRelatorio(relatorio).then(setHash).catch(() => setHash(null));
  }, [relatorio]);

  const copiar = async (texto, qual) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
      setTimeout(() => setCopiado(null), 1600);
    } catch {
      toast('Não foi possível copiar — selecione e copie à mão', 'alerta');
    }
  };

  const confirmar = () => {
    const s = assinatura.trim();
    if (!assinaturaValida(s)) {
      toast('Assinatura inválida: esperado base58 de ~88 caracteres', 'alerta', 5000);
      return;
    }
    dispatch({ type: 'ANCORAR_RELATORIO', id: relatorio.id, hash, txId: s });
    toast(`Relatório ancorado na ${REDE_ANCORAGEM} ⚓`);
    setAberto(false);
    setAssinatura('');
  };

  if (relatorio.ancoragem) {
    const a = relatorio.ancoragem;
    return (
      <div className="ancorado">
        ⚓ <b>ancorado na {a.rede}</b> <span className="tag ok">registro real</span>
        <div className="hash">SHA-256 {trunc(a.hash, 12, 12)}</div>
        <div className="hash">tx {trunc(a.txId, 10, 10)}</div>
        <a href={a.url} target="_blank" rel="noreferrer noopener">conferir no explorer ↗</a>
      </div>
    );
  }

  if (!hash) return <div className="mini">calculando o hash do relatório…</div>;

  return (
    <>
      <div className="nao-ancorado">
        ⚓ ainda não ancorado ·{' '}
        <button className="link-rastreio" onClick={() => setAberto(true)}>ancorar na {REDE_ANCORAGEM}</button>
        <div className="hash">SHA-256 {trunc(hash, 12, 12)}</div>
      </div>

      {aberto && (
        <Modal titulo="⚓ Ancorar na Solana devnet" sub="registro público e verificável do relatório"
          onFechar={() => setAberto(false)} largura={560}>
          <p className="mini">
            A assinatura exige chave privada, e chave privada não entra no navegador. Então são
            três passos: copie o hash, rode o comando na máquina da operação, e cole a assinatura de volta.
          </p>

          <label>1 · hash do relatório (SHA-256 real)</label>
          <div className="linha-copiar">
            <code className="hash sel">{hash}</code>
            <button className="acao sec" onClick={() => copiar(hash, 'hash')}>
              {copiado === 'hash' ? 'copiado ✓' : 'copiar'}
            </button>
          </div>

          <label>2 · rode em <code>onchain/</code></label>
          <div className="linha-copiar">
            <code className="hash sel">{comandoAncoragem(hash, relatorio.periodo)}</code>
            <button className="acao sec" onClick={() => copiar(comandoAncoragem(hash, relatorio.periodo), 'cmd')}>
              {copiado === 'cmd' ? 'copiado ✓' : 'copiar'}
            </button>
          </div>

          <label>3 · cole aqui a assinatura que o script imprimiu</label>
          <input value={assinatura} onChange={e => setAssinatura(e.target.value)}
            placeholder="5a1v34R8Tqpk1du9UAJdexypcUFou5ARHSCTy6nFshS6…" />
          {assinatura.trim() && !assinaturaValida(assinatura) && (
            <p className="mini alerta-txt">
              Isso não parece uma assinatura Solana (base58, ~88 caracteres).
            </p>
          )}
          {assinaturaValida(assinatura) && (
            <p className="mini">
              Vai registrar: <a href={urlExplorer(assinatura.trim())} target="_blank" rel="noreferrer noopener">
                conferir no explorer ↗</a>
            </p>
          )}
          <button className="acao grande" disabled={!assinaturaValida(assinatura)} onClick={confirmar}>
            Registrar ancoragem
          </button>
        </Modal>
      )}
    </>
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
            O comprovante nunca sai do aparelho da família: o app calcula o SHA-256 e só o hash é registrado. Ao validar, o cofre multisig
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
                {c.evidHash && (
                  <div className="hash" title="SHA-256 real do documento, calculado no aparelho da família — o arquivo não foi enviado a lugar nenhum">
                    🔐 evidência sha256: {trunc(c.evidHash, 14, 14)}{c.arquivo ? ` · ${c.arquivo}` : ''}
                  </div>
                )}
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
