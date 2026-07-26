import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  useStore, fmt, trunc, tipoTx, TIPOS_TX, disponivelCofre,
  BONUS_POR_CRIANCA, SIGNATARIOS, signatarioPor, REDE, MOEDA, PROVIDER_CARTEIRA, TAXA_SOLANA,
} from '../store.jsx';
import { useToast, Modal, Badge, EstadoVazio, ValorAnimado } from '../ui.jsx';
import { useDestaque } from '../demo.jsx';
import OnchainDevnet from '../OnchainDevnet.jsx';

const STATUS = {
  pendente: ['pend', 'aguardando comprovação'],
  comprovada: ['info', 'em validação (Vivá)'],
  'aguardando-assinaturas': ['prop', 'aguardando assinaturas'],
  liberada: ['ok', 'liberado'],
  'validada-aguardando': ['info', 'reservado'],
};

/* ---------- proposta pendente com os 3 signatários ---------- */
function CardProposta({ proposta, familia }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const limiar = state.cofre.limiar;
  const executada = proposta.status === 'executada';
  const faltam = Math.max(0, limiar - proposta.assinaturas.length);

  const assinar = sig => {
    const ultima = proposta.assinaturas.length + 1 >= limiar;
    dispatch({ type: 'ASSINAR_PROPOSTA', propostaId: proposta.id, signatario: sig.id });
    toast(ultima
      ? `Limiar ${limiar}/3 atingido — ${fmt(proposta.valor)} liberado 🎉`
      : `${sig.nome} assinou (${proposta.assinaturas.length + 1}/${limiar}) ✍️`, ultima ? 'ok' : 'info');
  };

  return (
    <div className={'card proposta' + (executada ? ' executando' : '')}>
      <div className="proposta-topo">
        <div>
          <span className="tag prop">proposta #{proposta.id}</span>
          <b style={{ marginLeft: 8 }}>{familia?.resp || 'família de outro aparelho'}</b>
          {/* sem a família no cadastro local (proposta criada em outro aparelho e
              trazida pela nuvem), não invento "0 criança(s) × R$ 30" — isso lia
              como bônus de zero real. Diz o valor, que é o dado que existe. */}
          <div className="mini">
            {familia
              ? `bônus de ${familia.criancas} criança(s) × ${fmt(BONUS_POR_CRIANCA)} · destino: conta ${PROVIDER_CARTEIRA} ${trunc(familia.carteira?.end, 4, 4)}`
              : `proposta registrada em outro aparelho · o cadastro da família fica só no aparelho da operação`}
          </div>
        </div>
        <div className="proposta-valor">{fmt(proposta.valor)}</div>
      </div>

      <div className="assinaturas-contador">
        {Array.from({ length: 3 }, (_, i) => (
          <span key={i} className={'pip' + (i < proposta.assinaturas.length ? ' on' : '') + (i < limiar ? '' : ' opcional')} />
        ))}
        {/* acima do limiar, "3/2 assinaturas" fica absurdo na tela — e acontece
            de verdade quando um terceiro signatário assina depois da execução.
            Nesse caso o texto passa a dizer o total e qual era o mínimo. */}
        <span className="mini">
          {proposta.assinaturas.length > limiar
            ? `${proposta.assinaturas.length} assinaturas (mínimo ${limiar})`
            : `${proposta.assinaturas.length}/${limiar} assinaturas`}
          {executada ? ' · executada ✅' : faltam > 0 ? ` · faltam ${faltam}` : ' · executando…'}
        </span>
      </div>

      <div className="signatarios">
        {SIGNATARIOS.map(s => {
          const assinou = proposta.assinaturas.includes(s.id);
          return (
            <div key={s.id} className={'signatario' + (assinou ? ' assinou' : '')}>
              <div className="avatar">{assinou ? '✓' : s.emoji}</div>
              <div className="signatario-info">
                <b>{s.nome}</b>
                <span className="mini">{s.papel}</span>
                <span className="hash">{trunc(s.endereco, 4, 4)}</span>
              </div>
              {assinou
                ? <span className="tag ok">assinou</span>
                : executada
                  ? <span className="mini">não foi necessário</span>
                  : <button className="acao sec" onClick={() => assinar(s)}>Assinar como {s.nome.split(' ')[0]}</button>}
            </div>
          );
        })}
      </div>

      {executada && (
        <div className="executando-faixa">
          ⚡ Limiar atingido — cofre executou a transferência de {fmt(proposta.valor)} na {REDE}
          {proposta.signature && <div className="hash" style={{ marginTop: 4 }}>{trunc(proposta.signature, 12, 12)}</div>}
        </div>
      )}
    </div>
  );
}

/* ---------- explorador de transações ---------- */
function ExploradorTx({ transacoes }) {
  const [filtro, setFiltro] = useState('todos');
  const [aberta, setAberta] = useState(null);
  const [busca, setBusca] = useState('');

  const tipos = useMemo(() => ['todos', ...Object.keys(TIPOS_TX).filter(t => transacoes.some(x => x.tipo === t))], [transacoes]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return [...transacoes].reverse()
      .filter(t => filtro === 'todos' || t.tipo === filtro)
      .filter(t => !q || t.desc.toLowerCase().includes(q) || t.signature.toLowerCase().includes(q) || String(t.slot) === q);
  }, [transacoes, filtro, busca]);

  return (
    <>
      <div className="explorador-barra">
        <div className="filtros">
          {tipos.map(t => (
            <button key={t} className={'filtro' + (filtro === t ? ' on' : '')} onClick={() => setFiltro(t)}
              style={filtro === t && t !== 'todos' ? { background: tipoTx(t).cor, borderColor: tipoTx(t).cor } : undefined}>
              {t === 'todos' ? `todos (${transacoes.length})` : t}
            </button>
          ))}
        </div>
        <input className="busca" value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 buscar por descrição, signature ou slot" />
      </div>

      {lista.length === 0 && (
        <EstadoVazio icone="🔍" titulo="Nenhuma transação com esse filtro" dica="Limpe a busca ou escolha outro tipo." />
      )}

      <div className="tx-lista">
        {lista.map(t => {
          const meta = tipoTx(t.tipo);
          return (
            <button className="tx" key={t.signature} onClick={() => setAberta(t)} style={{ '--cor-tx': meta.cor }}>
              <div className="tx-slot">
                <span className="slot-num">{t.slot}</span>
                <span className="mini">slot</span>
              </div>
              <div className="tx-meio">
                <span className="tx-tipo" style={{ color: meta.cor }}>{t.tipo}</span>
                <div className="tx-desc">{t.desc}</div>
                <div className="hash">{trunc(t.signature, 10, 10)}</div>
              </div>
              <div className="tx-dir">
                {t.valor > 0 && <b>{fmt(t.valor)}</b>}
                <span className="mini">{new Date(t.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="tx-abrir">detalhes ›</span>
              </div>
            </button>
          );
        })}
      </div>

      {aberta && (
        <Modal titulo={`Transação · ${aberta.tipo}`} sub={`${tipoTx(aberta.tipo).rot} · slot ${aberta.slot}`} onFechar={() => setAberta(null)} largura={620}>
          <div className="tx-detalhe">
            <div className="linha-det"><span>Status</span><b className="ok-txt">✅ Finalizada (confirmada)</b></div>
            <div className="linha-det"><span>Slot</span><b>{aberta.slot}</b></div>
            <div className="linha-det"><span>Sequência</span><b>#{aberta.seq}</b></div>
            <div className="linha-det"><span>Horário</span><b>{new Date(aberta.ts).toLocaleString('pt-BR')}</b></div>
            <div className="linha-det"><span>Rede</span><b>{REDE} · devnet</b></div>
            <div className="linha-det"><span>Taxa</span><b>{(aberta.taxa ?? TAXA_SOLANA).toFixed(6)} SOL</b></div>
            {aberta.valor > 0 && <div className="linha-det"><span>Valor</span><b>{fmt(aberta.valor)} <span className="mini">({MOEDA})</span></b></div>}
            {aberta.propostaId && <div className="linha-det"><span>Proposta</span><b>#{aberta.propostaId}</b></div>}
            {aberta.signatario && <div className="linha-det"><span>Signatário</span><b>{signatarioPor(aberta.signatario)?.nome}</b></div>}

            <div className="bloco-det">
              <span>Descrição</span>
              <p>{aberta.desc}</p>
            </div>
            <div className="bloco-det">
              <span>Signature</span>
              <p className="hash sel">{aberta.signature}</p>
            </div>
            <div className="bloco-det">
              <span>Transação anterior (cadeia)</span>
              <p className="hash sel">{aberta.prevSignature}</p>
            </div>
            <p className="mini">
              Cada transação carrega a signature da anterior: alterar um registro antigo quebraria toda a cadeia seguinte.
              É o que torna o histórico do fundo auditável por qualquer pessoa.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ---------- página ---------- */
/** Mantém a proposta recém-executada em tela por alguns segundos, para a animação ser vista. */
function useRecemExecutadas(propostas) {
  const [ids, setIds] = useState([]);
  const antesRef = useRef(propostas);

  useEffect(() => {
    const antes = antesRef.current;
    antesRef.current = propostas;
    const novas = propostas
      .filter(p => p.status === 'executada' && antes.some(a => a.id === p.id && a.status === 'aguardando'))
      .map(p => p.id);
    if (novas.length === 0) return;
    setIds(atual => [...atual, ...novas]);
    const t = setTimeout(() => setIds(atual => atual.filter(id => !novas.includes(id))), 2600);
    return () => clearTimeout(t);
  }, [propostas]);

  return ids;
}

export default function Fundo() {
  const { state } = useStore();
  const focoPropostas = useDestaque('propostas');
  const recem = useRecemExecutadas(state.propostas);
  const pendentes = state.propostas.filter(p => p.status === 'aguardando' || recem.includes(p.id));
  const reservadas = state.propostas.filter(p => p.status === 'reservada');
  const disponivel = disponivelCofre(state);
  const familiaDe = id => state.familias.find(f => f.id === id);

  return (
    <>
      <h2>Fundo Infância — cofre multisig ({REDE})</h2>

      <OnchainDevnet />

      <div className="grid g4">
        <div className="card kpi">
          <ValorAnimado valor={state.caixas.fundo} className="num" />
          <div className="rot">saldo do cofre</div>
          <div className="meta">livre para novas propostas: {fmt(disponivel)}</div>
        </div>
        <div className="card kpi">
          <ValorAnimado valor={state.caixas.fundoLiberado} className="num" />
          <div className="rot">já liberado às famílias</div>
        </div>
        <div className="card kpi"><div className="num">{state.cofre.limiar}/3</div><div className="rot">assinaturas exigidas por transferência</div></div>
        <div className="card kpi"><div className="num">{state.transacoes.length}</div><div className="rot">transações na {REDE}</div><div className="meta">slot atual: {state.slot}</div></div>
      </div>

      <div className="card cofre-id">
        <div>
          <span className="mini">endereço do cofre</span>
          <div className="hash sel">{state.cofre.endereco}</div>
        </div>
        <div>
          <span className="mini">programa multisig (padrão Squads)</span>
          <div className="hash sel">{state.cofre.programa}</div>
        </div>
      </div>

      <div className="aviso">
        <b>Regras do cofre:</b> (1) receita entra com split 60/25/15 automático; (2) bônus de {fmt(BONUS_POR_CRIANCA)}/criança/mês exige
        validação do Instituto Vivá <b>e {state.cofre.limiar} de 3 assinaturas</b> — nenhuma organização move o dinheiro sozinha;
        (3) condição não cumprida → valor fica <b>reservado</b>, liberável retroativamente no semestre;
        (4) saldo residual do ciclo → ações coletivas de saúde e educação definidas com a comunidade.
      </div>

      <h3 className={'ancora' + focoPropostas}>
        🗳️ Propostas aguardando assinatura ({state.propostas.filter(p => p.status === 'aguardando').length})
        {recem.length > 0 && <span className="mini"> · {recem.length} acabou de executar</span>}
      </h3>
      <div className={'propostas-area' + focoPropostas}>
        {pendentes.length === 0 && (
          <EstadoVazio icone="🗳️" titulo="Nenhuma proposta pendente"
            dica="Valide uma comprovação na aba Instituto Vivá para o cofre criar uma proposta de transferência." />
        )}
        {pendentes.map(p => <CardProposta key={p.id} proposta={p} familia={familiaDe(p.familiaId)} />)}
      </div>

      {reservadas.length > 0 && (
        <>
          <h3>🔒 Bônus reservados (nunca perdidos)</h3>
          <div className="card">
            {reservadas.map(p => {
              const f = familiaDe(p.familiaId);
              return (
                <div key={p.id} className="reservada">
                  <div>
                    <b>{f?.resp}</b> <span className="mini">· proposta #{p.id}</span>
                    <div className="mini">aguardando {!f?.carteira ? `conta ${PROVIDER_CARTEIRA} da família` : 'saldo no cofre'} — liberação retroativa garantida</div>
                  </div>
                  <b>{fmt(p.valor)}</b>
                </div>
              );
            })}
          </div>
        </>
      )}

      <h3>Condições por família</h3>
      <div className="card">
        <table>
          <thead><tr><th>Família</th><th>Condição</th><th>Mês</th><th>Bônus</th><th>Status</th></tr></thead>
          <tbody>
            {state.familias.flatMap(f => f.condicoes.map(c => {
              const [tom, rot] = STATUS[c.status] || ['info', c.status];
              return (
                <tr key={c.id}>
                  <td>{f.resp}</td><td>{c.tipo}</td><td>{c.mes}</td><td>{fmt(BONUS_POR_CRIANCA * f.criancas)}</td>
                  <td><Badge tom={tom}>{rot}</Badge></td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>

      <h3>🔍 Explorador de transações</h3>
      <ExploradorTx transacoes={state.transacoes} />
    </>
  );
}
