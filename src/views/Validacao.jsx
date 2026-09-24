import { useEffect, useState } from 'react';
import { useStore, fmt, trunc, disponivelCofre, BONUS_POR_CRIANCA, PROVIDER_CARTEIRA } from '../estado/store.jsx';
import { useToast, Modal } from '../componentes/ui.jsx';
import {
  Card, CardCabecalho, CardNota, Campo, Botao, Grade, Nota, Pill, Vazio,
  Secao, RotuloSecao, Ledger, LedgerLinha, LinkAuditoria, HashChip, Mono,
} from '../painel/ui/primitivos.jsx';
import { TelaCabecalho } from '../painel/ui/TelaCabecalho.jsx';
import { useDestaque } from '../componentes/demo.jsx';
import { hashRelatorio, comandoAncoragem, assinaturaValida, urlExplorer, REDE_ANCORAGEM } from '../lib/ancoragem.js';
import './validacao.css';

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

  useEffect(() => {
    hashRelatorio(relatorio).then(setHash).catch(() => setHash(null));
  }, [relatorio]);

  const confirmar = () => {
    const s = assinatura.trim();
    if (!assinaturaValida(s)) {
      toast('Assinatura inválida: esperado base58 de ~88 caracteres', 'alerta', 5000);
      return;
    }
    dispatch({ type: 'ANCORAR_RELATORIO', id: relatorio.id, hash, txId: s });
    toast(`Relatório ancorado na ${REDE_ANCORAGEM}`);
    setAberto(false);
    setAssinatura('');
  };

  if (relatorio.ancoragem) {
    const a = relatorio.ancoragem;
    return (
      <Ledger className="pn-ancoragem">
        <LedgerLinha
          chave={`Ancorado na ${a.rede}`}
          valor={<Pill tom="ok">registro real</Pill>}
        />
        <LedgerLinha chave="SHA-256" valor={<HashChip texto={trunc(a.hash, 12, 12)} copia={a.hash} rotulo="Copiar hash" />} />
        <LedgerLinha chave="Transação" valor={<HashChip texto={trunc(a.txId, 10, 10)} copia={a.txId} rotulo="Copiar id da transação" />} />
        <LedgerLinha chave="Auditoria" valor={<LinkAuditoria href={a.url}>conferir no explorer</LinkAuditoria>} />
      </Ledger>
    );
  }

  if (!hash) return <p className="pn-hint">calculando o hash do relatório…</p>;

  return (
    <>
      <Ledger className="pn-ancoragem">
        <LedgerLinha chave="Ancoragem" valor={<Pill tom="warn">não ancorado</Pill>} />
        <LedgerLinha chave="SHA-256" valor={<HashChip texto={trunc(hash, 12, 12)} copia={hash} rotulo="Copiar hash" />} />
        <LedgerLinha
          chave=""
          valor={<Botao tom="ghost" pequeno onClick={() => setAberto(true)}>Ancorar na {REDE_ANCORAGEM}</Botao>}
        />
      </Ledger>

      {aberto && (
        <Modal
          titulo="Ancorar na Solana devnet"
          sub="registro público e verificável do relatório"
          onFechar={() => setAberto(false)}
          largura={560}
        >
          <p className="pn-hint">
            A assinatura exige chave privada, e chave privada não entra no navegador. Então são
            três passos: copie o hash, rode o comando na máquina da operação, e cole a assinatura de volta.
          </p>

          <Campo id="anc-hash" rotulo="1 · hash do relatório (SHA-256 real)">
            <div id="anc-hash">
              <HashChip texto={hash} rotulo="Copiar hash" className="pn-chip-largo" />
            </div>
          </Campo>

          <Campo id="anc-cmd" rotulo="2 · rode em onchain/">
            <div id="anc-cmd">
              <HashChip
                texto={comandoAncoragem(hash, relatorio.periodo)}
                rotulo="Copiar comando"
                className="pn-chip-largo"
              />
            </div>
          </Campo>

          <Campo id="anc-sig" rotulo="3 · cole aqui a assinatura que o script imprimiu">
            <input
              id="anc-sig"
              className="pn-inp"
              value={assinatura}
              onChange={e => setAssinatura(e.target.value)}
              placeholder="5a1v34R8Tqpk1du9UAJdexypcUFou5ARHSCTy6nFshS6…"
            />
          </Campo>

          {assinatura.trim() && !assinaturaValida(assinatura) && (
            <Nota tipo="w" icone="alert">
              Isso não parece uma assinatura Solana (base58, ~88 caracteres).
            </Nota>
          )}
          {assinaturaValida(assinatura) && (
            <p className="pn-hint">
              Vai registrar:{' '}
              <LinkAuditoria href={urlExplorer(assinatura.trim())}>conferir no explorer</LinkAuditoria>
            </p>
          )}
          <Botao
            style={{ width: '100%', marginTop: 14 }}
            disabled={!assinaturaValida(assinatura)}
            onClick={confirmar}
          >
            Registrar ancoragem
          </Botao>
        </Modal>
      )}
    </>
  );
}

/* ------------------------------------------------ contestações da família --- */
/**
 * O que as famílias contestaram, e o que a operação respondeu.
 *
 * Existe porque contestação sem alguém responsável por responder é caixa de
 * reclamação fechada. Fica na aba do Instituto Vivá, que é quem valida: o mesmo
 * lugar onde o erro foi cometido é onde ele se corrige.
 *
 * Quando é peso de coleta ainda não validada, a correção é ali mesmo: pedir para
 * a agente "lembrar de arrumar depois" é como o problema morre.
 */
function Contestacoes() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [resp, setResp] = useState({});
  const [kg, setKg] = useState({});

  const lista = (state.contestacoes || []).slice().reverse();
  const abertas = lista.filter(c => c.status === 'aberta');
  const familiaDe = id => state.familias.find(f => f.id === id);

  return (
    <Secao>
      <RotuloSecao>Contestações das famílias</RotuloSecao>
      <Card>
        <CardCabecalho
          titulo="O que a família discordou"
          acessorio={
            abertas.length
              ? <Pill tom="warn">{abertas.length} aberta{abertas.length === 1 ? '' : 's'}</Pill>
              : <Pill tom="ok">nenhuma aberta</Pill>
          }
        />
        <CardNota>
          A família pode discordar de qualquer registro no app dela. Num programa que
          condiciona dinheiro a comprovação, quem é avaliado precisa poder contestar a
          avaliação, e alguém tem de responder.
        </CardNota>

        {lista.length === 0 && (
          <Vazio
            titulo="Nenhuma contestação"
            dica="Quando uma família apontar um erro no app dela, ela aparece aqui."
          />
        )}

        {lista.map(c => {
          const f = familiaDe(c.familiaId);
          const coleta = c.tipo === 'coleta' ? state.coletas.find(x => x.id === c.alvoId) : null;
          const podeCorrigirPeso = coleta && coleta.status === 'pendente';
          return (
            <div key={c.id} className={'pn-contest ' + c.status}>
              <div className="pn-contest-cab">
                <div>
                  <b>{f?.resp || 'família'}</b>{' '}
                  <span className="pn-hint">· {new Date(c.criadoEm).toLocaleDateString('pt-BR')}</span>
                  <div className="pn-hint"><b>{c.motivo}</b>: {c.alvoDesc}</div>
                  {c.detalhe && <div className="pn-contest-detalhe">“{c.detalhe}”</div>}
                </div>
                <Pill tom={c.status === 'aberta' ? 'warn' : c.status === 'resolvida' ? 'ok' : 'wait'}>
                  {c.status}
                </Pill>
              </div>

              {c.resposta && (
                <p className="pn-hint" style={{ marginTop: 6 }}>
                  <b>Respondido:</b> {c.resposta}
                </p>
              )}

              {c.status === 'aberta' && (
                <div style={{ marginTop: 10 }}>
                  {podeCorrigirPeso && (
                    <div className="pn-corrigir-peso">
                      <label className="pn-hint" htmlFor={'kg-' + c.id} style={{ margin: 0 }}>
                        peso lançado: <b>{coleta.kg} kg</b>, corrigir para
                      </label>
                      <input
                        id={'kg-' + c.id}
                        className="pn-inp"
                        type="number"
                        min="1"
                        value={kg[c.id] ?? ''}
                        onChange={e => setKg({ ...kg, [c.id]: e.target.value })}
                        placeholder="kg"
                      />
                      <Botao
                        tom="ghost"
                        pequeno
                        disabled={!(Number(kg[c.id]) > 0)}
                        onClick={() => {
                          dispatch({ type: 'CORRIGIR_COLETA', id: coleta.id, kg: Number(kg[c.id]) });
                          toast(`Peso corrigido para ${kg[c.id]} kg`, 'info');
                        }}
                      >
                        corrigir
                      </Botao>
                    </div>
                  )}
                  {coleta && !podeCorrigirPeso && (
                    <Nota tipo="w" icone="alert">
                      Esta coleta já foi validada e entrou em relatório: o peso não é mais
                      editável aqui. Registre a correção na resposta e trate como ajuste do
                      próximo ciclo.
                    </Nota>
                  )}
                  <Campo id={'resp-' + c.id} rotulo="Resposta para a família">
                    <input
                      id={'resp-' + c.id}
                      className="pn-inp"
                      value={resp[c.id] ?? ''}
                      onChange={e => setResp({ ...resp, [c.id]: e.target.value })}
                      placeholder="escreva em linguagem simples: ela lê isto no app"
                    />
                  </Campo>
                  <div className="pn-acoes-linha">
                    <Botao
                      disabled={!resp[c.id]?.trim()}
                      onClick={() => {
                        dispatch({ type: 'RESPONDER_CONTESTACAO', id: c.id, resposta: resp[c.id], resolver: true });
                        toast('Resposta enviada e marcada como resolvida', 'info');
                      }}
                    >
                      Responder e resolver
                    </Botao>
                    <Botao
                      tom="ghost"
                      disabled={!resp[c.id]?.trim()}
                      onClick={() => {
                        dispatch({ type: 'RESPONDER_CONTESTACAO', id: c.id, resposta: resp[c.id], resolver: false });
                        toast('Resposta enviada, segue em acompanhamento', 'info');
                      }}
                    >
                      Responder, ainda apurando
                    </Botao>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </Secao>
  );
}

export default function Validacao() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  /* O texto deste campo entra no SHA-256 do relatório (ver hashRelatorio), e é
     por isso que ele é editável: o hash sempre cobre exatamente o período que
     está escrito aqui. */
  const [periodo, setPeriodo] = useState('Julho 2026, quinzena 2');
  const focoColetas = useDestaque('validar-coletas');
  const focoRel = useDestaque('relatorio');
  const focoComp = useDestaque('comprovacoes');

  const pendentes = state.coletas.filter(c => c.status === 'pendente');
  const comprovadas = state.familias.flatMap(f => f.condicoes.filter(c => c.status === 'comprovada').map(c => ({ f, c })));
  const livre = disponivelCofre(state);

  const validarColeta = c => {
    dispatch({ type: 'VALIDAR_COLETA', id: c.id });
    toast(`Coleta de ${c.kg} kg validada`);
  };

  const emitir = () => {
    dispatch({ type: 'EMITIR_RELATORIO', periodo });
    toast('Relatório de Circularidade emitido');
  };

  const validarCondicao = (f, c) => {
    const valor = BONUS_POR_CRIANCA * f.criancas;
    const reserva = !f.carteira || livre < valor;
    dispatch({ type: 'VALIDAR_CONDICAO', familiaId: f.id, condicaoId: c.id });
    toast(
      reserva
        ? `Validado: ${fmt(valor)} reservado para ${f.resp}`
        : 'Proposta criada no cofre, aguardando 2 de 3 assinaturas',
      reserva ? 'alerta' : 'info'
    );
  };

  return (
    <div className="pn-screen">
      <TelaCabecalho area="Operação · Instituto Vivá" titulo="A comprovação é presencial. O painel só guarda o resultado.">
        O Instituto Vivá é quem transforma uma coleta em evidência e uma comprovação em dinheiro
        proposto. <b>Nada é liberado por uma pessoa sozinha.</b>
      </TelaCabecalho>

      <Grade colunas="5-8">
        {/* ---------------- 1 · coletas ---------------- */}
        <Secao className={focoColetas + focoRel}>
          <RotuloSecao>1 · Coletas aguardando validação DeTrash</RotuloSecao>
          <Card>
            {/* O botão abaixo é o caminho antigo: um clique, sem evidência anexada.
                Continua aqui porque a operação trabalha com ele hoje e aposentá-lo é
                decisão de campo, não de código. O caminho novo, com foto, hash
                perceptual, assinatura do aparelho e conferência humana, está na aba
                Conferência (módulo de Validação de Coleta, ver VALIDACAO.md). */}
            <Nota tipo="w" icone="alert">
              <b>Validação por confiança.</b> Este botão marca a coleta como validada sem
              evidência anexada. As coletas registradas pelo app de campo trazem foto,
              hash perceptual e assinatura do aparelho, e são conferidas na etapa{' '}
              <b>Conferência</b>.
            </Nota>

            {pendentes.length === 0 && (
              <Vazio
                titulo="Nenhuma coleta pendente"
                dica="Registre uma nova ação na etapa Coletor."
              />
            )}
            {pendentes.map(c => (
              <div key={c.id} className="pn-item-validar">
                <div className="pn-item-validar-top">
                  <div>
                    <b>{c.kg} kg · {c.material}</b>
                    <div className="pn-hint">{c.coletor} · {c.local} · {c.data}</div>
                  </div>
                  <Pill tom="warn">pendente</Pill>
                </div>
                <Botao style={{ marginTop: 12 }} onClick={() => validarColeta(c)}>
                  Validar pelos critérios DeTrash
                </Botao>
              </div>
            ))}
          </Card>

          <RotuloSecao>Emitir Relatório de Circularidade</RotuloSecao>
          <Card>
            <Campo
              id="val-periodo"
              rotulo="Período"
              dica="Este texto entra no hash do relatório, então ele descreve exatamente o que foi ancorado."
            >
              <input
                id="val-periodo"
                className="pn-inp"
                value={periodo}
                onChange={e => setPeriodo(e.target.value)}
              />
            </Campo>
            <Botao tom="ghost" style={{ width: '100%' }} onClick={emitir}>
              Consolidar coletas validadas em relatório
            </Botao>

            {state.relatorios.length === 0 && (
              <p className="pn-hint" style={{ marginTop: 12 }}>Nenhum relatório emitido ainda.</p>
            )}
            {[...state.relatorios].reverse().map(r => (
              <div key={r.id} className="pn-relatorio">
                <div className="pn-relatorio-cab">
                  <div>
                    <strong>{r.periodo}</strong>
                    <div className="pn-hint">{r.kg} kg · {r.acoes} ações de coleta</div>
                  </div>
                  <Mono style={{ color: 'var(--t4)' }}>{trunc(r.signature, 8, 8)}</Mono>
                </div>
                <Ancoragem relatorio={r} />
              </div>
            ))}
          </Card>
        </Secao>

        {/* ---------------- 2 · comprovações ---------------- */}
        <Secao className={focoComp}>
          <RotuloSecao>2 · Comprovações de saúde e educação (dupla checagem)</RotuloSecao>
          <Card>
            <CardNota>
              O comprovante nunca sai do aparelho da família: o app calcula o SHA-256 e só o
              hash é registrado. Ao validar, o cofre multisig <b>cria uma proposta</b> de
              transferência, que ainda precisa de 2 das 3 assinaturas para executar.
            </CardNota>

            <Ledger style={{ marginTop: 14 }}>
              <LedgerLinha
                chave="Livre no cofre para novas propostas"
                valor={<Mono style={{ fontSize: 14, color: 'var(--foam)' }}>{fmt(livre)}</Mono>}
              />
            </Ledger>

            {comprovadas.length === 0 && (
              <div style={{ marginTop: 14 }}>
                <Vazio
                  titulo="Nenhuma comprovação aguardando validação"
                  dica="As famílias enviam as fotos pela etapa App da Família."
                />
              </div>
            )}

            {comprovadas.map(({ f, c }) => {
              const valor = BONUS_POR_CRIANCA * f.criancas;
              const reserva = !f.carteira || livre < valor;
              return (
                <div key={c.id} className="pn-item-validar">
                  <div className="pn-item-validar-top">
                    <div>
                      <b>{f.resp}</b>
                      <div className="pn-hint">
                        {c.tipo} · {f.criancas} criança(s) · bônus previsto: {fmt(valor)}
                      </div>
                    </div>
                    <Pill tom="wait">{c.mes}</Pill>
                  </div>

                  {c.evidHash && (
                    <div
                      style={{ marginTop: 10 }}
                      title="SHA-256 real do documento, calculado no aparelho da família. O arquivo não foi enviado a lugar nenhum."
                    >
                      <HashChip
                        texto={`evidência sha256: ${trunc(c.evidHash, 14, 14)}${c.arquivo ? ` · ${c.arquivo}` : ''}`}
                        copia={c.evidHash}
                        rotulo="Copiar hash da evidência"
                      />
                    </div>
                  )}

                  {reserva && (
                    <div style={{ marginTop: 10 }}>
                      <Nota tipo="w" icone="alert">
                        {!f.carteira ? `Família sem conta ${PROVIDER_CARTEIRA}` : 'Cofre sem saldo livre'}:
                        o bônus será <b>reservado</b>, não perdido.
                      </Nota>
                    </div>
                  )}

                  <Botao style={{ marginTop: 12 }} onClick={() => validarCondicao(f, c)}>
                    {reserva ? 'Validar e reservar bônus' : 'Validar e criar proposta no cofre'}
                  </Botao>
                </div>
              );
            })}
          </Card>

          <Nota tipo="i" icone="shield">
            <b>Governança.</b> Cada comprovação passa por dois agentes do Instituto Vivá; a
            liberação do dinheiro exige <b>2 de 3 assinaturas</b> no cofre (Instituto Vivá,
            DeTrash e Representante Comunitário); auditoria trimestral por parceiro externo; a
            família tem canal de recurso com resposta em até 15 dias.
          </Nota>
        </Secao>
      </Grade>

      <Contestacoes />
    </div>
  );
}
