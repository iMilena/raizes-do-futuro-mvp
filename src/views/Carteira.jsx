import { useEffect, useState } from 'react';
import {
  useStore, fmt, trunc, BONUS_POR_CRIANCA, REDE, MOEDA, PROVIDER_CARTEIRA,
  VERSAO_TERMO, TEXTO_TERMO, hashTermo, consentimentoAtivo, consentimentoMaisRecente,
  situacaoConsentimento, venceEm, VALIDADE_MESES, CARENCIA_DIAS,
  temPin, MAX_TENTATIVAS_PIN,
} from '../estado/store.jsx';
import { useToast, ValorAnimado } from '../componentes/ui.jsx';
import {
  Card, CardCabecalho, CardNota, Campo, Botao, Grade, Nota, Pill, Vazio,
  Secao, RotuloSecao, Ledger, LedgerLinha, HashChip, Mono,
} from '../painel/ui/primitivos.jsx';
import { TelaCabecalho } from '../painel/ui/TelaCabecalho.jsx';
import { useDestaque } from '../componentes/demo.jsx';
import * as auth from '../lib/auth.js';
import './carteira.css';

const STATUS = {
  pendente: ['warn', 'enviar comprovação'],
  comprovada: ['wait', 'em validação no Instituto Vivá'],
  'aguardando-assinaturas': ['warn', 'aguardando assinaturas (2 de 3)'],
  liberada: ['ok', 'bônus recebido'],
  'validada-aguardando': ['wait', 'validado, reservado'],
};

/* ---------- consentimento do responsável (LGPD) ----------
   Fica ANTES de tudo na tela por um motivo prático: é o que autoriza o resto.
   Sem consentimento ativo, os dados desta família não vão para a base
   compartilhada, e a policy do banco recusa, não é só a tela que evita. */
function Consentimento({ familia }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [aberto, setAberto] = useState(false);
  const [forma, setForma] = useState('presencial-assinado');
  const [hash, setHash] = useState('');
  const ativo = consentimentoAtivo(familia);
  const recente = consentimentoMaisRecente(familia);
  const revogado = (familia.consentimentos || []).find(c => c.revogadoEm);

  useEffect(() => { hashTermo().then(setHash).catch(() => setHash('')); }, []);

  const registrar = () => {
    dispatch({
      type: 'REGISTRAR_CONSENTIMENTO',
      familiaId: familia.id,
      forma,
      termoHash: hash,
      coletadoPor: auth.atual()?.usuario?.id || null,
    });
    toast('Consentimento registrado: dados desta família passam a ser compartilhados', 'info', 5000);
    setAberto(false);
  };

  const revogar = () => {
    const motivo = prompt('Motivo da revogação (opcional):') ?? '';
    dispatch({ type: 'REVOGAR_CONSENTIMENTO', familiaId: familia.id, motivo });
    toast('Consentimento revogado: os dados desta família param de ser compartilhados', 'alerta', 6000);
  };

  if (ativo) {
    const sit = situacaoConsentimento(ativo);
    const vence = venceEm(ativo);
    const dias = Math.ceil((vence - Date.now()) / 86_400_000);
    return (
      <Card className={'pn-consent ' + (sit === 'vencendo' ? 'atencao' : 'ok')}>
        <div className="pn-consent-topo">
          <div>
            <Pill tom={sit === 'vencendo' ? 'warn' : 'ok'}>
              {sit === 'vencendo' ? 'Consentimento vencendo' : 'Consentimento ativo'}
            </Pill>
            <div className="pn-hint" style={{ marginTop: 8 }}>
              {ativo.versaoTermo} · {ativo.forma.replace('-', ' ')} · registrado em {new Date(ativo.coletadoEm).toLocaleDateString('pt-BR')}
            </div>
            {/* prazo em destaque: consentimento sem prazo visível é consentimento
                que ninguém renova, e aí o dado fica para sempre por descuido */}
            <div className={'pn-prazo' + (sit === 'vencendo' ? ' atencao' : '')}>
              Vale até {vence.toLocaleDateString('pt-BR')} ({dias} dia{dias === 1 ? '' : 's'})
              {ativo.renovadoDe ? ' · renovação' : ''}
            </div>
            <div style={{ marginTop: 10 }}>
              {ativo.termoHash
                ? <HashChip
                  texto={`termo SHA-256 ${trunc(ativo.termoHash, 12, 12)}`}
                  copia={ativo.termoHash}
                  rotulo="Copiar hash do termo"
                />
                : <Mono style={{ color: 'var(--t4)' }}>termo sem hash registrado</Mono>}
            </div>
          </div>
          <Botao tom="ghost" onClick={revogar}>Revogar a pedido da família</Botao>
        </div>
        {sit === 'vencendo' && (
          <Nota tipo="w" icone="alert">
            Renove na próxima visita. Vencido, os dados desta família saem da base
            compartilhada, e {CARENCIA_DIAS} dias depois são expurgados.
          </Nota>
        )}
      </Card>
    );
  }

  return (
    <Card className="pn-consent atencao">
      <Pill tom="warn">
        {recente && situacaoConsentimento(recente) === 'vencido'
          ? 'Consentimento vencido'
          : 'Sem consentimento registrado'}
      </Pill>
      <CardNota>
        {revogado
          ? `A família revogou o consentimento em ${new Date(revogado.revogadoEm).toLocaleDateString('pt-BR')}. Os dados dela não são compartilhados.`
          : recente && situacaoConsentimento(recente) === 'vencido'
            ? `O prazo terminou em ${venceEm(recente).toLocaleDateString('pt-BR')}. Os dados saíram da base compartilhada; renove para voltar a acompanhar.`
            : 'Os dados desta família ficam só neste aparelho. A base compartilhada recusa família sem consentimento: é regra do banco, não da tela.'}
      </CardNota>
      {!aberto && (
        <Botao style={{ marginTop: 14 }} onClick={() => setAberto(true)}>
          {recente ? 'Renovar consentimento' : 'Registrar consentimento'}
        </Botao>
      )}
      {aberto && (
        <>
          <div className="pn-bloco-det">
            <span>Termo apresentado ({VERSAO_TERMO})</span>
            <pre
              className="pn-termo"
              tabIndex={0}
              role="region"
              aria-label={`Termo de consentimento ${VERSAO_TERMO}`}
            >{TEXTO_TERMO}</pre>
          </div>
          <div className="pn-bloco-det">
            <span>SHA-256 do termo</span>
            <div>
              {hash
                ? <HashChip texto={trunc(hash, 16, 16)} copia={hash} rotulo="Copiar hash do termo" />
                : <Mono>calculando…</Mono>}
            </div>
          </div>

          <Campo id="forma-consent" rotulo="Como o consentimento foi colhido" className="pn-mt">
            <select
              id="forma-consent"
              className="pn-inp"
              value={forma}
              onChange={e => setForma(e.target.value)}
            >
              <option value="presencial-assinado">Presencial, com assinatura no papel</option>
              <option value="presencial-verbal">Presencial, verbal com testemunha</option>
              <option value="whatsapp">Por WhatsApp, com confirmação escrita</option>
              <option value="formulario">Formulário preenchido pela família</option>
            </select>
          </Campo>

          <Nota tipo="i" icone="shield">
            O sistema guarda a <b>forma</b> e o <b>hash do termo</b>, nunca foto de documento
            nem assinatura digitalizada. Validade de <b>{VALIDADE_MESES} meses</b>, renovável
            em visita de campo; vencido, os dados saem da base e são expurgados
            após {CARENCIA_DIAS} dias.
          </Nota>

          <div className="pn-acoes-linha">
            <Botao onClick={registrar} disabled={!hash}>Confirmar consentimento</Botao>
            <Botao tom="ghost" onClick={() => setAberto(false)}>Cancelar</Botao>
          </div>
        </>
      )}
    </Card>
  );
}

/* ---------- destravar o PIN da família (presencial) ----------
   Existe porque o PIN é hash local e não tem recuperação remota, de propósito.
   Destravar APAGA o PIN: a família escolhe outro no próximo acesso. O agente
   nunca vê nem define o PIN de ninguém. */
function DestravarPin({ familia }) {
  const { dispatch } = useStore();
  const toast = useToast();
  if (!temPin(familia)) {
    return (
      <p className="pn-hint" style={{ marginTop: 12 }}>
        Esta família ainda não definiu PIN: ela escolhe um no primeiro acesso ao app.
      </p>
    );
  }
  const bloqueado = familia.pin.bloqueado;
  const tentativas = familia.pin.tentativas || 0;
  return (
    <div className="pn-pin-linha">
      <Pill tom={bloqueado ? 'warn' : 'ok'}>
        {bloqueado ? `PIN travado (${tentativas} erros)` : 'PIN definido'}
      </Pill>
      <span className="pn-hint">
        {bloqueado
          ? `Travou depois de ${MAX_TENTATIVAS_PIN} tentativas. Destravar apaga o PIN e a família escolhe outro.`
          : 'O PIN fica só no celular da família: ninguém do projeto consegue vê-lo.'}
      </span>
      <Botao tom="ghost" pequeno onClick={() => {
        if (!confirm('Apagar o PIN desta família? Ela definirá um novo no próximo acesso.')) return;
        dispatch({ type: 'DESTRAVAR_PIN', familiaId: familia.id });
        toast('PIN apagado: a família define um novo no próximo acesso', 'info');
      }}>
        {bloqueado ? 'Destravar' : 'Apagar PIN'}
      </Botao>
    </div>
  );
}

/* ---------- conectar carteira Decaf (sem seed phrase) ---------- */
function Onboarding({ familia, onDone }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [passo, setPasso] = useState(1);
  const [tel, setTel] = useState('');
  const [pin, setPin] = useState(['', '', '', '']);
  const [conectando, setConectando] = useState(false);
  const pinOk = pin.every(d => d.length === 1);

  const setDigito = (i, v) => {
    const p = [...pin];
    p[i] = v.replace(/\D/g, '').slice(-1);
    setPin(p);
  };

  const conectar = () => {
    setConectando(true);
    setTimeout(() => {
      dispatch({ type: 'CRIAR_CARTEIRA', id: familia.id, celular: tel });
      toast(`Carteira ${PROVIDER_CARTEIRA} conectada na ${REDE}`);
      setConectando(false);
      setPasso(3);
    }, 900);
  };

  const PASSOS = ['Entender', 'Proteger', 'Pronto'];

  return (
    <Card className="pn-wizard">
      <CardCabecalho titulo={`Conectar carteira ${PROVIDER_CARTEIRA}, família de ${familia.resp}`} />

      {/* Os três passos em linha, com o atual marcado por `aria-current`: a
          posição não é só a cor de fundo, é dito em texto para o leitor. */}
      <ol className="pn-wpassos">
        {PASSOS.map((nome, i) => (
          <li
            key={nome}
            className={passo >= i + 1 ? 'on' : ''}
            aria-current={passo === i + 1 ? 'step' : undefined}
          >
            <span className="n">{i + 1}</span>
            {nome}
          </li>
        ))}
      </ol>

      {passo === 1 && (
        <>
          <p className="pn-texto">
            A carteira <b>{PROVIDER_CARTEIRA}</b> é uma <b>conta digital da família</b> na {REDE}. É nela que chegam os bônus do
            Fundo Infância. A família não decora senha nenhuma, só o celular e um PIN de 4 números.
          </p>
          <ul className="pn-lista">
            <li>O dinheiro chega em <b>{MOEDA}</b> (1 = R$ 1, sem variação de preço)</li>
            <li><b>Sem seed phrase</b> de 12 palavras, barreira comum de exclusão digital</li>
            <li>Sem taxa de rede para a família: a operação patrocina as taxas ({REDE} custa fração de centavo)</li>
            <li>Saque <b>via Pix</b> a qualquer momento, em reais</li>
          </ul>
          <Campo id="wz-tel" rotulo="Celular (para recuperar o acesso)">
            <input
              id="wz-tel"
              className="pn-inp"
              value={tel}
              onChange={e => setTel(e.target.value)}
              inputMode="tel"
              placeholder="(75) 9 9999-9999"
            />
          </Campo>
          <Botao disabled={tel.replace(/\D/g, '').length < 10} onClick={() => setPasso(2)}>
            Continuar
          </Botao>
        </>
      )}

      {passo === 2 && (
        <>
          <p className="pn-texto">
            Escolha um <b>PIN de 4 números</b>. É ele que protege a carteira, como o PIN do cartão do banco.
          </p>
          <div className="pn-pin">
            {pin.map((d, i) => (
              <input
                key={i}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => setDigito(i, e.target.value)}
                aria-label={`Número ${i + 1} do PIN`}
              />
            ))}
          </div>
          <Nota tipo="i" icone="lock">
            Custódia simplificada da {PROVIDER_CARTEIRA}: a chave fica protegida pelo provedor e é recuperável com
            celular + agente Vivá. O PIN não é guardado em texto, só a marca de que foi definido.
          </Nota>
          <Botao style={{ marginTop: 14 }} disabled={!pinOk || conectando} onClick={conectar}>
            {conectando ? 'Conectando…' : `Conectar com ${PROVIDER_CARTEIRA}`}
          </Botao>
        </>
      )}

      {passo === 3 && (
        <>
          <Pill tom="ok">Carteira {PROVIDER_CARTEIRA} conectada</Pill>
          <p className="pn-texto">
            Endereço {REDE} gerado e registrado na rede (sem nenhum dado pessoal). A partir de agora, os bônus do
            Fundo Infância chegam aqui quando as comprovações forem validadas e o cofre 2-de-3 assinar.
          </p>
          <Botao onClick={onDone}>Abrir carteira</Botao>
        </>
      )}
    </Card>
  );
}

/* ---------- Carteira ---------- */
export default function Carteira() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  /* `?.` e a guarda abaixo não são paranoia: uma base sem família passou a ser
     estado possível de verdade. O expurgo da retenção (migração 03) apaga
     famílias, e uma nuvem recém-criada nasce vazia. Sem isso, `familias[0].id`
     derruba a aba inteira com "Cannot read properties of undefined". */
  const [famId, setFamId] = useState(() => state.familias[0]?.id ?? null);
  const [wizardDe, setWizardDe] = useState(null); // família com o wizard aberto
  const [feito, setFeito] = useState(false);
  const focoSaldo = useDestaque('saldo');
  const f = state.familias.find(f => f.id === Number(famId)) ?? state.familias[0] ?? null;

  // abre o wizard para família sem carteira e o mantém aberto até o passo final
  useEffect(() => {
    if (f && !f.carteira) { setWizardDe(f.id); setFeito(false); }
  }, [f]);
  const noWizard = f && wizardDe === f.id && !feito;

  const trocarFamilia = id => {
    setFamId(id);
    setWizardDe(null);
    setFeito(false);
  };

  const sacar = () => {
    dispatch({ type: 'SACAR_PIX', id: f.id, valor: f.saldo });
    toast(`Pix de ${fmt(f.saldo)} enviado`);
  };

  const enviar = c => {
    dispatch({ type: 'ENVIAR_COMPROVACAO', familiaId: f.id, condicaoId: c.id });
    toast('Comprovação enviada ao Instituto Vivá');
  };

  const cabecalho = (
    <TelaCabecalho
      area={`Famílias · Carteira ${PROVIDER_CARTEIRA} (${REDE})`}
      titulo="A conta é da família. A equipe acompanha, nunca gasta."
    >
      A conta é da família e o PIN fica no celular dela. <b>A operação acompanha, registra o
      consentimento e destrava, nunca gasta.</b>
    </TelaCabecalho>
  );

  if (!f) {
    return (
      <div className="pn-screen">
        {cabecalho}
        <Vazio
          titulo="Nenhuma família cadastrada"
          dica="Registre o consentimento de uma família para começar o acompanhamento. Sem consentimento ativo, nada é compartilhado: é regra do banco."
        />
      </div>
    );
  }

  return (
    <div className="pn-screen">
      {cabecalho}

      <Campo id="fam-simular" rotulo="Simular como" className="pn-simular">
        <select
          id="fam-simular"
          className="pn-inp"
          value={famId}
          onChange={e => trocarFamilia(Number(e.target.value))}
        >
          {state.familias.map(fa => (
            <option key={fa.id} value={fa.id}>
              {fa.resp} ({fa.criancas} criança{fa.criancas > 1 ? 's' : ''})
            </option>
          ))}
        </select>
      </Campo>

      <Consentimento familia={f} />

      {noWizard && <Onboarding familia={f} onDone={() => setFeito(true)} />}

      {f.carteira && !noWizard && (
        <Grade colunas={2}>
          <Secao className={focoSaldo}>
            <RotuloSecao>Saldo</RotuloSecao>
            <Card>
              <div className="pn-saldo">
                <ValorAnimado valor={f.saldo} className="v" prefixo="" />
                <div className="pn-hint">
                  {MOEDA} · = {fmt(f.saldo)} · 1 {MOEDA.split('/')[0]} = R$ 1,00 (moeda estável)
                </div>
              </div>

              <Ledger style={{ marginTop: 18 }}>
                <LedgerLinha>
                  <div>
                    <span className="k">endereço {REDE}</span>
                    <div style={{ marginTop: 6 }}>
                      <HashChip texto={f.carteira.end} rotulo="Copiar endereço" className="pn-chip-largo" />
                    </div>
                  </div>
                </LedgerLinha>
                <LedgerLinha chave="rede" valor={<Mono>{f.carteira.rede || REDE}</Mono>} />
                <LedgerLinha chave="provider" valor={<Mono>{f.carteira.provider || PROVIDER_CARTEIRA}</Mono>} />
                <LedgerLinha
                  chave="criada em"
                  valor={<Mono>
                    {f.carteira.criadaEm}{f.carteira.celular ? ` · recuperação: ${f.carteira.celular}` : ''}
                  </Mono>}
                />
              </Ledger>

              <DestravarPin familia={f} />

              <Botao style={{ marginTop: 16 }} disabled={f.saldo <= 0} onClick={sacar}>
                Sacar tudo via Pix
              </Botao>

              <div className="pn-extrato">
                <RotuloSecao>Extrato</RotuloSecao>
                {f.extrato.length === 0 ? (
                  <Vazio
                    titulo="Sem movimentações ainda"
                    dica="O primeiro bônus aparece aqui quando o cofre 2-de-3 executar a proposta."
                  />
                ) : (
                  [...f.extrato].reverse().map((e, i) => (
                    <div key={i} className="pn-extrato-linha">
                      <span>{e.desc}</span>
                      <b className={e.valor >= 0 ? 'entrou' : 'saiu'}>
                        {e.valor >= 0 ? '+' : '−'}{fmt(Math.abs(e.valor))}
                      </b>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </Secao>

          <Secao>
            <RotuloSecao>Compromissos de saúde e educação</RotuloSecao>
            <Card>
              <CardNota>
                Envie a comprovação (foto da carteira de vacinação, declaração da escola…). O documento fica em ambiente
                seguro, <b>nunca na rede</b>. Se ainda não der para comprovar, o bônus fica reservado, não é perdido.
              </CardNota>

              {f.condicoes.length === 0 ? (
                <Vazio titulo="Nenhum compromisso cadastrado" />
              ) : (
                f.condicoes.map(c => {
                  const [tom, rot] = STATUS[c.status] || ['wait', c.status];
                  return (
                    <div key={c.id} className="pn-compromisso">
                      <div>
                        <b>{c.tipo}</b>
                        <Mono style={{ color: 'var(--t4)' }}> {c.mes}</Mono>
                        <div style={{ marginTop: 7 }}><Pill tom={tom}>{rot}</Pill></div>
                      </div>
                      {c.status === 'pendente' && (
                        <Botao tom="ghost" pequeno onClick={() => enviar(c)}>
                          Enviar comprovação
                        </Botao>
                      )}
                    </div>
                  );
                })
              )}

              <Nota tipo="i" icone="lamp">
                <b>Lembrete:</b> a renda do trabalho de coleta é paga por fora e <b>não depende</b> destes compromissos.
                Aqui é só o bônus adicional do Fundo Infância ({fmt(BONUS_POR_CRIANCA)}/criança/mês).
              </Nota>

              <p className="pn-hint" style={{ marginTop: 12 }}>
                Para ver a tela que a família usa no celular, abra a aba <b>App da Família</b> ou acesse
                <b> {location.origin}/#/familia</b>.
              </p>
            </Card>
          </Secao>
        </Grade>
      )}
    </div>
  );
}
