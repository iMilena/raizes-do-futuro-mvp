import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useStore, fmt, trunc, tipoTx, TIPOS_TX, disponivelCofre,
  BONUS_POR_CRIANCA, SIGNATARIOS, signatarioPor, REDE, MOEDA, PROVIDER_CARTEIRA, TAXA_SOLANA,
} from '../estado/store.jsx';
import { useToast, Modal, ValorAnimado } from '../componentes/ui.jsx';
import { Icon } from '../painel/ui/Icones.jsx';
import {
  Card, CardCabecalho, CardNota, Campo, Botao, Grade, Nota, Pill, Vazio,
  Secao, RotuloSecao, Tabela, Ledger, LedgerLinha, LinkAuditoria, HashChip, Medidor, Mono,
} from '../painel/ui/primitivos.jsx';
import { TelaCabecalho } from '../painel/ui/TelaCabecalho.jsx';
import { tomDaTransacao } from '../painel/ui/tons.js';
import { useDestaque } from '../componentes/demo.jsx';
import OnchainDevnet from '../componentes/OnchainDevnet.jsx';
import {
  assinaturaValida, comandoLiberacao, comandoDecisao, hashDecisaoColetiva,
} from '../lib/ancoragem.js';
import * as auth from '../lib/auth.js';
import './fundo.css';

const STATUS = {
  pendente: ['warn', 'aguardando comprovação'],
  comprovada: ['wait', 'em validação (Vivá)'],
  'aguardando-assinaturas': ['warn', 'aguardando assinaturas'],
  liberada: ['ok', 'liberado'],
  'validada-aguardando': ['wait', 'reservado'],
};

/* ---------- proposta pendente com os 3 signatários ---------- */
/**
 * Esta pessoa pode assinar em nome desta organização?
 *
 * SEM sessão (modo local, demonstração) todos os três botões aparecem: é o modo
 * em que o app é uma simulação da jornada e nada sobe. COM sessão, só a
 * organização do papel: o banco recusa as outras, e a recusada entupia a fila.
 */
function podeAssinarComo(idSignatario) {
  const s = auth.atual();
  if (!s?.papel) return true;            // modo local: a demo mostra o ciclo todo
  return s.papel.signatario === idSignatario;
}

function CardProposta({ proposta, familia }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const limiar = state.cofre.limiar;
  const executada = proposta.status === 'executada';
  const faltam = Math.max(0, limiar - proposta.assinaturas.length);

  const assinar = sig => {
    const ultima = proposta.assinaturas.length + 1 >= limiar;
    dispatch({ type: 'ASSINAR_PROPOSTA', propostaId: proposta.id, signatario: sig.id });
    toast(
      ultima
        ? `Limiar ${limiar}/3 atingido: ${fmt(proposta.valor)} liberado`
        : `${sig.nome} assinou (${proposta.assinaturas.length + 1}/${limiar})`,
      ultima ? 'ok' : 'info'
    );
  };

  return (
    <Card className={'pn-proposta' + (executada ? ' executando' : '')}>
      <div className="pn-proposta-topo">
        <div>
          <Pill tom="warn" quadrado>proposta #{proposta.id}</Pill>
          <div className="pn-proposta-nome">{familia?.resp || 'família de outro aparelho'}</div>
          {/* sem a família no cadastro local (proposta criada em outro aparelho e
              trazida pela nuvem), não invento "0 criança(s) × R$ 30": isso lia
              como bônus de zero real. Diz o valor, que é o dado que existe. */}
          <div className="pn-hint">
            {familia
              ? `bônus de ${familia.criancas} criança(s) × ${fmt(BONUS_POR_CRIANCA)} · destino: conta ${PROVIDER_CARTEIRA} ${trunc(familia.carteira?.end, 4, 4)}`
              : 'proposta registrada em outro aparelho · o cadastro da família fica só no aparelho da operação'}
          </div>
        </div>
        <div className="pn-proposta-valor">{fmt(proposta.valor)}</div>
      </div>

      <div className="pn-assinaturas">
        <div className="pn-assinaturas-txt">
          {/* acima do limiar, "3/2 assinaturas" fica absurdo na tela, e acontece
              de verdade quando um terceiro signatário assina depois da execução.
              Nesse caso o texto passa a dizer o total e qual era o mínimo. */}
          <span>
            {proposta.assinaturas.length > limiar
              ? `${proposta.assinaturas.length} assinaturas (mínimo ${limiar})`
              : `${proposta.assinaturas.length} de ${limiar} assinaturas`}
          </span>
          <span>{executada ? 'executada' : faltam > 0 ? `faltam ${faltam}` : 'executando…'}</span>
        </div>
        <Medidor pct={Math.min(100, (proposta.assinaturas.length / limiar) * 100)} />
      </div>

      <div className="pn-signatarios">
        {SIGNATARIOS.map(s => {
          const assinou = proposta.assinaturas.includes(s.id);
          return (
            <div key={s.id} className={'pn-signatario' + (assinou ? ' assinou' : '')}>
              <span className="pn-avatar" aria-hidden="true">
                {assinou ? <Icon name="check" /> : s.iniciais}
              </span>
              <div className="pn-signatario-info">
                <b>{s.nome}</b>
                <span className="pn-hint">{s.papel}</span>
                <Mono style={{ color: 'var(--t4)' }}>{trunc(s.endereco, 4, 4)}</Mono>
              </div>
              {assinou ? (
                <Pill tom="ok">assinou</Pill>
              ) : executada ? (
                <span className="pn-hint">não foi necessário</span>
              ) : podeAssinarComo(s.id) ? (
                <Botao tom="ghost" pequeno onClick={() => assinar(s)}>
                  Assinar como {s.nome.split(' ')[0]}
                </Botao>
              ) : (
                /* Com sessão aberta, só aparece o botão da SUA organização.
                   Antes o app oferecia os três, o banco recusava os outros
                   dois (policy ass_assinar) e a operação recusada entupia a
                   fila de sincronização. Oferecer o que vai ser negado é
                   convidar ao erro. */
                <span
                  className="pn-hint"
                  title="Só a organização registrada no seu papel pode assinar por ela"
                >
                  aguardando {s.nome.split(' ')[0]}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {executada && (
        <div style={{ marginTop: 14 }}>
          <Nota tipo="i" icone="check">
            Limiar atingido: cofre executou a transferência de {fmt(proposta.valor)} na {REDE}
            {proposta.signature && (
              <div style={{ marginTop: 8 }}>
                <HashChip
                  texto={trunc(proposta.signature, 12, 12)}
                  copia={proposta.signature}
                  rotulo="Copiar assinatura"
                />
              </div>
            )}
          </Nota>
        </div>
      )}
    </Card>
  );
}

/* ---------- explorador de transações ---------- */
function ExploradorTx({ transacoes }) {
  const [filtro, setFiltro] = useState('todos');
  const [aberta, setAberta] = useState(null);
  const [busca, setBusca] = useState('');

  const tipos = useMemo(
    () => ['todos', ...Object.keys(TIPOS_TX).filter(t => transacoes.some(x => x.tipo === t))],
    [transacoes]
  );

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return [...transacoes].reverse()
      .filter(t => filtro === 'todos' || t.tipo === filtro)
      .filter(t => !q || t.desc.toLowerCase().includes(q) || t.signature.toLowerCase().includes(q) || String(t.slot) === q);
  }, [transacoes, filtro, busca]);

  return (
    <>
      <div className="pn-explorador-barra">
        {/* Container próprio com rolagem: são 13 tipos de transação, e no celular
            eles não cabem em linha nenhuma. */}
        <div className="pn-filtros" role="group" aria-label="Filtrar por tipo de transação">
          {tipos.map(t => (
            <button
              type="button"
              key={t}
              className={'pn-filtro' + (filtro === t ? ' on' : '')}
              aria-pressed={filtro === t}
              onClick={() => setFiltro(t)}
            >
              {t === 'todos' ? `todos (${transacoes.length})` : t}
            </button>
          ))}
        </div>
        <div className="pn-busca-tx">
          <Icon name="search" className="sm" />
          <label className="pn-so-leitor" htmlFor="tx-busca">
            Buscar por descrição, signature ou slot
          </label>
          <input
            id="tx-busca"
            className="pn-inp"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="buscar por descrição, signature ou slot"
          />
        </div>
      </div>

      {lista.length === 0 && (
        <Vazio titulo="Nenhuma transação com esse filtro" dica="Limpe a busca ou escolha outro tipo." />
      )}

      <div className="pn-tx-lista">
        {lista.map(t => {
          const tom = tomDaTransacao(t.tipo);
          return (
            <button type="button" className={`pn-tx ${tom}`} key={t.signature} onClick={() => setAberta(t)}>
              <span className="pn-tx-slot">
                <b>{t.slot}</b>
                <span>slot</span>
              </span>
              <span className="pn-tx-meio">
                <span className={`pn-fk ${tom}`}>{t.tipo}</span>
                <span className="pn-tx-desc">{t.desc}</span>
                <Mono style={{ color: 'var(--t4)' }}>{trunc(t.signature, 10, 10)}</Mono>
              </span>
              <span className="pn-tx-dir">
                {t.valor > 0 && <b>{fmt(t.valor)}</b>}
                <span>{new Date(t.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="pn-tx-abrir">detalhes<Icon name="right" className="sm" /></span>
              </span>
            </button>
          );
        })}
      </div>

      {aberta && (
        <Modal
          titulo={`Transação · ${aberta.tipo}`}
          sub={`${tipoTx(aberta.tipo).rot} · slot ${aberta.slot}`}
          onFechar={() => setAberta(null)}
          largura={620}
        >
          <Ledger>
            <LedgerLinha chave="Status" valor={<Pill tom="ok">Finalizada (confirmada)</Pill>} />
            <LedgerLinha chave="Slot" valor={<Mono>{aberta.slot}</Mono>} />
            <LedgerLinha chave="Sequência" valor={<Mono>#{aberta.seq}</Mono>} />
            <LedgerLinha chave="Horário" valor={<Mono>{new Date(aberta.ts).toLocaleString('pt-BR')}</Mono>} />
            <LedgerLinha chave="Rede" valor={<Mono>{REDE} · devnet</Mono>} />
            <LedgerLinha chave="Taxa" valor={<Mono>{(aberta.taxa ?? TAXA_SOLANA).toFixed(6)} SOL</Mono>} />
            {aberta.valor > 0 && (
              <LedgerLinha chave="Valor" valor={<Mono>{fmt(aberta.valor)} ({MOEDA})</Mono>} />
            )}
            {aberta.propostaId && <LedgerLinha chave="Proposta" valor={<Mono>#{aberta.propostaId}</Mono>} />}
            {aberta.signatario && (
              <LedgerLinha chave="Signatário" valor={<Mono>{signatarioPor(aberta.signatario)?.nome}</Mono>} />
            )}
          </Ledger>

          {/* Rótulo micro em cima, dado embaixo: é ficha, não formulário. Um
              `<label>` aqui apontaria para um parágrafo, e rótulo que não leva
              a lugar nenhum atrapalha quem navega por teclado. */}
          <div className="pn-bloco-det">
            <span>Descrição</span>
            <p className="pn-bloco-texto">{aberta.desc}</p>
          </div>
          <div className="pn-bloco-det">
            <span>Signature</span>
            <HashChip texto={aberta.signature} rotulo="Copiar signature" className="pn-chip-largo" />
          </div>
          <div className="pn-bloco-det">
            <span>Transação anterior (cadeia)</span>
            <HashChip texto={aberta.prevSignature} rotulo="Copiar signature anterior" className="pn-chip-largo" />
          </div>

          <Nota tipo="i" icone="shield">
            Cada transação carrega a signature da anterior: alterar um registro antigo quebraria
            toda a cadeia seguinte. É o que torna o histórico do fundo auditável por qualquer pessoa.
          </Nota>
        </Modal>
      )}
    </>
  );
}

/* ---------- comprovante on-chain das liberações executadas ----------
   O app NÃO assina: assinar exige chave privada, e chave de signatário do cofre
   em bundle de navegador é chave pública. Então a etapa é humana: a operação
   roda o comando com a chave dela e cola a assinatura de volta. Menos cômodo, e
   é o que permite dizer "executado na rede" sem mentir. */
function ExecutadasOnchain() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [aberta, setAberta] = useState(null);
  const [sig, setSig] = useState('');

  const executadas = state.propostas.filter(p => p.status === 'executada');
  if (executadas.length === 0) return null;

  const naRede = executadas.filter(p => p.execucaoOnchain);

  const confirmar = p => {
    const s = sig.trim();
    if (!assinaturaValida(s)) {
      toast('Assinatura inválida: são ~88 caracteres em base58', 'alerta');
      return;
    }
    dispatch({ type: 'REGISTRAR_EXECUCAO_ONCHAIN', propostaId: p.id, txId: s });
    toast('Liberação comprovada na Solana devnet', 'info', 5000);
    setAberta(null);
    setSig('');
  };

  return (
    <Secao>
      <RotuloSecao>Liberações no cofre real</RotuloSecao>
      <Card>
        <Pill tom={naRede.length === executadas.length ? 'ok' : 'warn'}>
          {naRede.length} de {executadas.length} com comprovante
        </Pill>
        <CardNota>
          A jornada do app é simulada; o cofre <b>existe na Solana devnet</b>. Cada liberação
          pode ser executada de verdade lá, e o comprovante fica aqui. Quem assina são as
          organizações, nas máquinas delas: o site não tem chave privada, e não deveria ter.
        </CardNota>

        {executadas.map(p => {
          const f = state.familias.find(x => x.id === p.familiaId);
          return (
            <div key={p.id} className="pn-linha-item">
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>proposta #{p.id}</b>
                <span className="pn-hint"> · {fmt(p.valor)}{f ? ` · ${f.resp}` : ''}</span>

                {p.execucaoOnchain ? (
                  <div className="pn-linha-det">
                    <Pill tom="ok">executado na devnet</Pill>
                    <LinkAuditoria href={p.execucaoOnchain.url}>ver no explorer</LinkAuditoria>
                    <Mono style={{ color: 'var(--t4)' }}>{trunc(p.execucaoOnchain.txId, 10, 10)}</Mono>
                  </div>
                ) : aberta === p.id ? (
                  <div style={{ marginTop: 10 }}>
                    <p className="pn-hint">
                      1. Uma organização prepara e assina, em <code>onchain/</code>:
                    </p>
                    <HashChip
                      texto={comandoLiberacao(p.valor, p.id, 'viva')}
                      rotulo="Copiar comando"
                      className="pn-chip-largo"
                    />
                    <p className="pn-hint" style={{ marginTop: 10 }}>
                      2. A saída é uma transação parcialmente assinada. A <b>segunda</b> organização
                      confere o valor e o destino, assina e envia: o multisig do SPL Token exige
                      as duas assinaturas na mesma transação.
                    </p>
                    <Campo id={'sig-' + p.id} rotulo="3. Cole a assinatura devolvida">
                      <input
                        id={'sig-' + p.id}
                        className="pn-inp"
                        value={sig}
                        onChange={e => setSig(e.target.value)}
                        placeholder="assinatura base58 (~88 caracteres)"
                      />
                    </Campo>
                    <div className="pn-acoes-linha">
                      <Botao onClick={() => confirmar(p)}>Confirmar comprovante</Botao>
                      <Botao tom="ghost" onClick={() => { setAberta(null); setSig(''); }}>Cancelar</Botao>
                    </div>
                  </div>
                ) : (
                  <div className="pn-linha-det">
                    <Pill tom="wait">só no app (simulado)</Pill>
                  </div>
                )}
              </div>
              {!p.execucaoOnchain && aberta !== p.id && (
                <Botao tom="ghost" pequeno onClick={() => { setAberta(p.id); setSig(''); }}>
                  Executar na devnet
                </Botao>
              )}
            </div>
          );
        })}
      </Card>
    </Secao>
  );
}

/* ---------- regra 4: saldo residual vira ações coletivas ----------
   A decisão é da assembleia. Um contrato que distribuísse o residual sozinho
   tomaria a decisão no lugar das pessoas: o que precisa ser imutável é o
   REGISTRO de qual decisão foi tomada, não a decisão. */
function FechamentoCiclo() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({ acao: '', comoFoiDecidido: 'assembleia comunitária', participantes: '', valor: '' });
  const [sigCiclo, setSigCiclo] = useState({});

  const residual = disponivelCofre(state);
  const ciclos = state.ciclos || [];

  const registrar = async () => {
    const valor = Number(form.valor);
    if (!form.acao.trim() || !(valor > 0) || valor > residual) {
      toast('Informe a ação e um valor até o saldo residual', 'alerta');
      return;
    }
    const ciclo = new Date().toISOString().slice(0, 7);
    const hash = await hashDecisaoColetiva({
      ciclo, acao: form.acao.trim(), valor,
      comoFoiDecidido: form.comoFoiDecidido, participantes: form.participantes,
      data: new Date().toISOString().slice(0, 10),
    });
    dispatch({ type: 'FECHAR_CICLO', ...form, valor, ciclo, hash });
    toast(`Fechamento registrado: ${fmt(valor)} para ações coletivas`, 'info', 5000);
    setAberto(false);
    setForm({ acao: '', comoFoiDecidido: 'assembleia comunitária', participantes: '', valor: '' });
  };

  const ancorar = c => {
    const s = (sigCiclo[c.id] || '').trim();
    if (!assinaturaValida(s)) { toast('Assinatura inválida', 'alerta'); return; }
    dispatch({ type: 'ANCORAR_DECISAO', cicloId: c.id, txId: s });
    toast('Decisão ancorada na Solana devnet', 'info', 5000);
  };

  return (
    <Secao>
      <RotuloSecao>Fechamento de ciclo (regra 4)</RotuloSecao>
      <Card>
        <Pill tom="wait">{ciclos.length} registrado{ciclos.length === 1 ? '' : 's'}</Pill>
        <CardNota>
          Saldo residual disponível: <b>{fmt(residual)}</b>. Pela regra 4, ele vai para ações
          coletivas de saúde e educação <b>definidas com a comunidade</b>: a decisão é da
          assembleia, e o que a rede registra é a prova pública de qual decisão foi tomada.
        </CardNota>

        {ciclos.length === 0 && !aberto && (
          <Vazio
            titulo="Nenhum ciclo fechado ainda"
            dica="No fim do ciclo, registre aqui a destinação decidida em assembleia."
          />
        )}

        {ciclos.map(c => (
          <div key={c.id} className="pn-linha-item">
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{c.acao}</b>
              <div className="pn-hint">ciclo {c.ciclo} · {c.comoFoiDecidido}</div>
              {c.participantes && <div className="pn-hint">quem participou: {c.participantes}</div>}
              <div style={{ marginTop: 8 }}>
                <HashChip texto={`SHA-256 ${trunc(c.hash, 12, 12)}`} copia={c.hash} rotulo="Copiar hash da decisão" />
              </div>
              {c.ancoragem ? (
                <div className="pn-linha-det">
                  <Pill tom="ok">ancorado na devnet</Pill>
                  <LinkAuditoria href={c.ancoragem.url}>ver no explorer</LinkAuditoria>
                </div>
              ) : (
                <div style={{ marginTop: 10 }}>
                  <HashChip texto={comandoDecisao(c.hash, c.ciclo)} rotulo="Copiar comando" className="pn-chip-largo" />
                  <Campo id={'sigc-' + c.id} rotulo="Assinatura devolvida">
                    <input
                      id={'sigc-' + c.id}
                      className="pn-inp"
                      value={sigCiclo[c.id] || ''}
                      onChange={e => setSigCiclo({ ...sigCiclo, [c.id]: e.target.value })}
                      placeholder="cole a assinatura devolvida"
                    />
                  </Campo>
                  <Botao tom="ghost" onClick={() => ancorar(c)}>Ancorar decisão</Botao>
                </div>
              )}
            </div>
            <b className="pn-mono">{fmt(c.valor)}</b>
          </div>
        ))}

        {!aberto ? (
          <Botao style={{ marginTop: 14 }} disabled={residual <= 0} onClick={() => setAberto(true)}>
            Registrar destinação do residual
          </Botao>
        ) : (
          <div style={{ marginTop: 14 }}>
            <Campo id="fc-acao" rotulo="Ação coletiva decidida">
              <input
                id="fc-acao"
                className="pn-inp"
                value={form.acao}
                onChange={e => setForm({ ...form, acao: e.target.value })}
                placeholder="ex.: kit de higiene bucal para a escola municipal"
              />
            </Campo>
            <Campo id="fc-valor" rotulo={`Valor destinado (até ${fmt(residual)})`}>
              <input
                id="fc-valor"
                className="pn-inp"
                type="number"
                min="1"
                max={residual}
                value={form.valor}
                onChange={e => setForm({ ...form, valor: e.target.value })}
              />
            </Campo>
            <Campo id="fc-como" rotulo="Como foi decidido">
              <select
                id="fc-como"
                className="pn-inp"
                value={form.comoFoiDecidido}
                onChange={e => setForm({ ...form, comoFoiDecidido: e.target.value })}
              >
                <option value="assembleia comunitária">Assembleia comunitária</option>
                <option value="reunião do conselho local">Reunião do conselho local</option>
                <option value="consulta às famílias participantes">Consulta às famílias participantes</option>
              </select>
            </Campo>
            <Campo id="fc-quem" rotulo="Quem participou (sem nomes de crianças)">
              <input
                id="fc-quem"
                className="pn-inp"
                value={form.participantes}
                onChange={e => setForm({ ...form, participantes: e.target.value })}
                placeholder="ex.: 14 famílias, Instituto Vivá, escola municipal"
              />
            </Campo>
            <div className="pn-acoes-linha">
              <Botao onClick={registrar}>Registrar e gerar prova</Botao>
              <Botao tom="ghost" onClick={() => setAberto(false)}>Cancelar</Botao>
            </div>
          </div>
        )}
      </Card>
    </Secao>
  );
}

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

  /* Quatro, e nessa ordem: o fechamento de ciclo, mais abaixo, se chama
     "regra 4" em tela. Aqui a numeração é conteúdo, não enfeite. */
  const REGRAS = [
    <>receita entra com split 60/25/15 automático</>,
    <>
      bônus de {fmt(BONUS_POR_CRIANCA)}/criança/mês exige validação do Instituto Vivá{' '}
      <b>e {state.cofre.limiar} de 3 assinaturas</b>: nenhuma organização move o dinheiro sozinha
    </>,
    <>condição não cumprida deixa o valor <b>reservado</b>, liberável retroativamente no semestre</>,
    <>saldo residual do ciclo vai para ações coletivas de saúde e educação definidas com a comunidade</>,
  ];

  return (
    <div className="pn-screen">
      <TelaCabecalho area={`Governança · Cofre 2-de-3 · ${REDE}`} titulo="Nenhuma organização mexe no dinheiro sozinha.">
        Toda liberação do Fundo Infância exige duas de três assinaturas. A comunidade tem uma
        delas. <b>Isso está no contrato, não numa promessa.</b>
      </TelaCabecalho>

      <OnchainDevnet />

      <Grade colunas={4}>
        <Card>
          <div className="pn-kpi">
            <div className="l">saldo do cofre</div>
            <ValorAnimado valor={state.caixas.fundo} className="v" />
            <div className="m">livre para novas propostas: {fmt(disponivel)}</div>
          </div>
        </Card>
        <Card>
          <div className="pn-kpi">
            <div className="l">já liberado às famílias</div>
            <ValorAnimado valor={state.caixas.fundoLiberado} className="v" />
          </div>
        </Card>
        <Card>
          <div className="pn-kpi">
            <div className="l">assinaturas exigidas por transferência</div>
            <div className="v">{state.cofre.limiar}/3</div>
          </div>
        </Card>
        <Card>
          <div className="pn-kpi">
            <div className="l">transações na {REDE}</div>
            <div className="v">{state.transacoes.length}</div>
            <div className="m">slot atual: {state.slot}</div>
          </div>
        </Card>
      </Grade>

      <Grade colunas="5-8">
        <Card>
          <CardCabecalho titulo="Endereços auditáveis" />
          <Ledger style={{ marginTop: 14 }}>
            <LedgerLinha>
              <div>
                <span className="k">Endereço do cofre</span>
                <div style={{ marginTop: 6 }}>
                  <HashChip texto={state.cofre.endereco} rotulo="Copiar endereço do cofre" className="pn-chip-largo" />
                </div>
              </div>
            </LedgerLinha>
            <LedgerLinha>
              <div>
                <span className="k">Programa multisig (SPL Token, nativo)</span>
                <div style={{ marginTop: 6 }}>
                  <HashChip texto={state.cofre.programa} rotulo="Copiar programa multisig" className="pn-chip-largo" />
                </div>
              </div>
            </LedgerLinha>
          </Ledger>
        </Card>

        <Secao>
          <RotuloSecao>Regras do cofre</RotuloSecao>
          <div className="pn-regras">
            {REGRAS.map((r, i) => (
              <Nota key={i} tipo="i" icone={<span>{i + 1}</span>}>{r}</Nota>
            ))}
          </div>
        </Secao>
      </Grade>

      <Secao className={focoPropostas}>
        <RotuloSecao>
          Propostas aguardando assinatura ({state.propostas.filter(p => p.status === 'aguardando').length})
          {recem.length > 0 && <span> · {recem.length} acabou de executar</span>}
        </RotuloSecao>
        {pendentes.length === 0 ? (
          <Vazio
            titulo="Nenhuma proposta pendente"
            dica="Valide uma comprovação na aba Instituto Vivá para o cofre criar uma proposta de transferência."
          />
        ) : (
          pendentes.map(p => <CardProposta key={p.id} proposta={p} familia={familiaDe(p.familiaId)} />)
        )}
      </Secao>

      <ExecutadasOnchain />
      <FechamentoCiclo />

      {reservadas.length > 0 && (
        <Secao>
          <RotuloSecao>Bônus reservados (nunca perdidos)</RotuloSecao>
          <Card>
            {reservadas.map(p => {
              const f = familiaDe(p.familiaId);
              return (
                <div key={p.id} className="pn-linha-item">
                  <div>
                    <b>{f?.resp}</b>
                    <span className="pn-hint"> · proposta #{p.id}</span>
                    <div className="pn-hint">
                      aguardando {!f?.carteira ? `conta ${PROVIDER_CARTEIRA} da família` : 'saldo no cofre'}:
                      liberação retroativa garantida
                    </div>
                  </div>
                  <b className="pn-mono">{fmt(p.valor)}</b>
                </div>
              );
            })}
          </Card>
        </Secao>
      )}

      <Secao>
        <RotuloSecao>Condições por família</RotuloSecao>
        <Tabela>
          <thead>
            <tr>
              <th>Família</th><th>Condição</th><th>Mês</th>
              <th style={{ textAlign: 'right' }}>Bônus</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {state.familias.flatMap(f => f.condicoes.map(c => {
              const [tom, rot] = STATUS[c.status] || ['wait', c.status];
              const faixa = tom === 'ok' ? 'done' : tom === 'warn' ? 'needs' : '';
              return (
                <tr key={c.id} className={faixa}>
                  <td><strong>{f.resp}</strong></td>
                  <td>{c.tipo}</td>
                  <td>{c.mes}</td>
                  <td className="num">{fmt(BONUS_POR_CRIANCA * f.criancas)}</td>
                  <td><Pill tom={tom}>{rot}</Pill></td>
                </tr>
              );
            }))}
          </tbody>
        </Tabela>
      </Secao>

      <Secao>
        <RotuloSecao>Explorador de transações</RotuloSecao>
        <Card>
          <ExploradorTx transacoes={state.transacoes} />
        </Card>
      </Secao>
    </div>
  );
}
