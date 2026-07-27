import React, { useEffect, useState } from 'react';
import {
  useStore, fmt, trunc, BONUS_POR_CRIANCA, REDE, MOEDA, PROVIDER_CARTEIRA,
  VERSAO_TERMO, TEXTO_TERMO, hashTermo, consentimentoAtivo, consentimentoMaisRecente,
  situacaoConsentimento, venceEm, VALIDADE_MESES, CARENCIA_DIAS,
  temPin, MAX_TENTATIVAS_PIN,
} from '../store.jsx';
import { useToast, Badge, EstadoVazio, ValorAnimado } from '../ui.jsx';
import { useDestaque } from '../demo.jsx';
import * as auth from '../auth.js';

const STATUS = {
  pendente: ['pend', 'enviar comprovação'],
  comprovada: ['info', 'em validação no Instituto Vivá'],
  'aguardando-assinaturas': ['prop', 'aguardando assinaturas (2 de 3)'],
  liberada: ['ok', 'bônus recebido'],
  'validada-aguardando': ['info', 'validado — reservado'],
};

/* ---------- consentimento do responsável (LGPD) ----------
   Fica ANTES de tudo na tela por um motivo prático: é o que autoriza o resto.
   Sem consentimento ativo, os dados desta família não vão para a base
   compartilhada — e a policy do banco recusa, não é só a tela que evita. */
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
    toast('Consentimento registrado ✍️ — dados desta família passam a ser compartilhados', 'info', 5000);
    setAberto(false);
  };

  const revogar = () => {
    const motivo = prompt('Motivo da revogação (opcional):') ?? '';
    dispatch({ type: 'REVOGAR_CONSENTIMENTO', familiaId: familia.id, motivo });
    toast('Consentimento revogado — os dados desta família param de ser compartilhados', 'alerta', 6000);
  };

  if (ativo) {
    const sit = situacaoConsentimento(ativo);
    const vence = venceEm(ativo);
    const dias = Math.ceil((vence - Date.now()) / 86_400_000);
    return (
      <div className="card" style={{ borderLeft: `3px solid var(--${sit === 'vencendo' ? 'alerta' : 'verde'})` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <b style={{ fontSize: 14 }}>
              {sit === 'vencendo' ? '⏳ Consentimento vencendo' : '✍️ Consentimento ativo'}
            </b>
            <div className="mini">
              {ativo.versaoTermo} · {ativo.forma.replace('-', ' ')} · registrado em {new Date(ativo.coletadoEm).toLocaleDateString('pt-BR')}
            </div>
            {/* prazo em destaque: consentimento sem prazo visível é consentimento
                que ninguém renova, e aí o dado fica para sempre por descuido */}
            <div className={'mini' + (sit === 'vencendo' ? ' alerta-txt' : '')} style={{ fontWeight: 600 }}>
              Vale até {vence.toLocaleDateString('pt-BR')} ({dias} dia{dias === 1 ? '' : 's'})
              {ativo.renovadoDe ? ' · renovação' : ''}
            </div>
            <div className="hash" style={{ marginTop: 4 }}>termo SHA-256 {ativo.termoHash ? trunc(ativo.termoHash, 12, 12) : '—'}</div>
          </div>
          <button className="acao sec" onClick={revogar}>Revogar a pedido da família</button>
        </div>
        {sit === 'vencendo' && (
          <p className="mini" style={{ marginTop: 10 }}>
            Renove na próxima visita. Vencido, os dados desta família saem da base
            compartilhada, e {CARENCIA_DIAS} dias depois são expurgados.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="card" style={{ borderLeft: '3px solid var(--alerta)' }}>
      <b style={{ fontSize: 14 }}>
        {recente && situacaoConsentimento(recente) === 'vencido'
          ? '⌛ Consentimento vencido'
          : '⚠️ Sem consentimento registrado'}
      </b>
      <p className="mini" style={{ marginTop: 4 }}>
        {revogado
          ? `A família revogou o consentimento em ${new Date(revogado.revogadoEm).toLocaleDateString('pt-BR')}. Os dados dela não são compartilhados.`
          : recente && situacaoConsentimento(recente) === 'vencido'
            ? `O prazo terminou em ${venceEm(recente).toLocaleDateString('pt-BR')}. Os dados saíram da base compartilhada; renove para voltar a acompanhar.`
            : 'Os dados desta família ficam só neste aparelho. A base compartilhada recusa família sem consentimento — é regra do banco, não da tela.'}
      </p>
      {!aberto && (
        <button className="acao" style={{ marginTop: 10 }} onClick={() => setAberto(true)}>
          {recente ? 'Renovar consentimento' : 'Registrar consentimento'}
        </button>
      )}
      {aberto && (
        <>
          <label style={{ marginTop: 14 }}>Termo apresentado ({VERSAO_TERMO})</label>
          <pre className="termo">{TEXTO_TERMO}</pre>
          <div className="hash">SHA-256 do termo: {hash ? trunc(hash, 16, 16) : 'calculando…'}</div>
          <label htmlFor="forma-consent">Como o consentimento foi colhido</label>
          <select id="forma-consent" value={forma} onChange={e => setForma(e.target.value)}>
            <option value="presencial-assinado">Presencial, com assinatura no papel</option>
            <option value="presencial-verbal">Presencial, verbal com testemunha</option>
            <option value="whatsapp">Por WhatsApp, com confirmação escrita</option>
            <option value="formulario">Formulário preenchido pela família</option>
          </select>
          <p className="mini" style={{ marginTop: 8 }}>
            O sistema guarda a <b>forma</b> e o <b>hash do termo</b> — nunca foto de documento
            nem assinatura digitalizada. Validade de <b>{VALIDADE_MESES} meses</b>, renovável
            em visita de campo; vencido, os dados saem da base e são expurgados
            após {CARENCIA_DIAS} dias.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="acao" onClick={registrar} disabled={!hash}>Confirmar consentimento</button>
            <button className="acao sec" onClick={() => setAberto(false)}>Cancelar</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- destravar o PIN da família (presencial) ----------
   Existe porque o PIN é hash local e não tem recuperação remota — de propósito.
   Destravar APAGA o PIN: a família escolhe outro no próximo acesso. O agente
   nunca vê nem define o PIN de ninguém. */
function DestravarPin({ familia }) {
  const { dispatch } = useStore();
  const toast = useToast();
  if (!temPin(familia)) {
    return (
      <p className="mini" style={{ marginTop: 10 }}>
        🔓 Esta família ainda não definiu PIN — ela escolhe um no primeiro acesso ao app.
      </p>
    );
  }
  const bloqueado = familia.pin.bloqueado;
  const tentativas = familia.pin.tentativas || 0;
  return (
    <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span className={'tag ' + (bloqueado ? 'pend' : 'ok')}>
        {bloqueado ? `PIN travado (${tentativas} erros)` : 'PIN definido'}
      </span>
      <span className="mini" style={{ flex: 1, minWidth: 180, margin: 0 }}>
        {bloqueado
          ? `Travou depois de ${MAX_TENTATIVAS_PIN} tentativas. Destravar apaga o PIN e a família escolhe outro.`
          : 'O PIN fica só no celular da família — ninguém do projeto consegue vê-lo.'}
      </span>
      <button className="acao sec" onClick={() => {
        if (!confirm('Apagar o PIN desta família? Ela definirá um novo no próximo acesso.')) return;
        dispatch({ type: 'DESTRAVAR_PIN', familiaId: familia.id });
        toast('PIN apagado 🔓 — a família define um novo no próximo acesso', 'info');
      }}>
        {bloqueado ? 'Destravar' : 'Apagar PIN'}
      </button>
    </div>
  );
}

/* ---------- conectar carteira Picnic (sem seed phrase) ---------- */
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
      toast(`Carteira ${PROVIDER_CARTEIRA} conectada na ${REDE} 🧺`);
      setConectando(false);
      setPasso(3);
    }, 900);
  };

  return (
    <div className="card destaque" style={{ maxWidth: 540 }}>
      <h3>Conectar carteira {PROVIDER_CARTEIRA} — família de {familia.resp}</h3>
      <div className="wizard-passo">
        <span className={passo >= 1 ? 'on' : ''}>1 · Entender</span>
        <span className={passo >= 2 ? 'on' : ''}>2 · Proteger</span>
        <span className={passo >= 3 ? 'on' : ''}>3 · Pronto</span>
      </div>

      {passo === 1 && (
        <>
          <p style={{ fontSize: 14 }}>
            A carteira <b>{PROVIDER_CARTEIRA}</b> é uma <b>conta digital da família</b> na {REDE}. É nela que chegam os bônus do
            Fundo Infância. A família não decora senha nenhuma — só o celular e um PIN de 4 números.
          </p>
          <ul style={{ fontSize: 13, color: 'var(--cinza)' }}>
            <li>O dinheiro chega em <b>{MOEDA}</b> (1 = R$ 1, sem variação de preço)</li>
            <li><b>Sem seed phrase</b> de 12 palavras — barreira comum de exclusão digital</li>
            <li>Sem taxa de rede para a família: a operação patrocina as taxas ({REDE} custa fração de centavo)</li>
            <li>Saque <b>via Pix</b> a qualquer momento, em reais</li>
          </ul>
          <label>Celular (para recuperar o acesso)</label>
          <input value={tel} onChange={e => setTel(e.target.value)} inputMode="tel" placeholder="(75) 9 9999-9999" />
          <button className="acao" style={{ marginTop: 12 }} disabled={tel.replace(/\D/g, '').length < 10} onClick={() => setPasso(2)}>Continuar</button>
        </>
      )}

      {passo === 2 && (
        <>
          <p style={{ fontSize: 14 }}>Escolha um <b>PIN de 4 números</b>. É ele que protege a carteira — como o PIN do cartão do banco.</p>
          <div className="pin">
            {pin.map((d, i) => (
              <input key={i} type="password" inputMode="numeric" maxLength={1} value={d}
                onChange={e => setDigito(i, e.target.value)} aria-label={`Número ${i + 1} do PIN`} />
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--cinza)' }}>
            🔐 Custódia simplificada da {PROVIDER_CARTEIRA}: a chave fica protegida pelo provedor e é recuperável com
            celular + agente Vivá. O PIN não é guardado em texto — só a marca de que foi definido.
          </p>
          <button className="acao" disabled={!pinOk || conectando} onClick={conectar}>
            {conectando ? 'Conectando…' : `Conectar com ${PROVIDER_CARTEIRA} 🧺`}
          </button>
        </>
      )}

      {passo === 3 && (
        <>
          <p style={{ fontSize: 15 }}>🎉 <b>Carteira {PROVIDER_CARTEIRA} conectada!</b></p>
          <p style={{ fontSize: 13, color: 'var(--cinza)' }}>
            Endereço {REDE} gerado e registrado na rede (sem nenhum dado pessoal). A partir de agora, os bônus do
            Fundo Infância chegam aqui quando as comprovações forem validadas e o cofre 2-de-3 assinar.
          </p>
          <button className="acao" onClick={onDone}>Abrir carteira</button>
        </>
      )}
    </div>
  );
}

/* ---------- Carteira ---------- */
export default function Carteira() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [famId, setFamId] = useState(state.familias[0].id);
  const [wizardDe, setWizardDe] = useState(null); // família com o wizard aberto
  const [feito, setFeito] = useState(false);
  const focoSaldo = useDestaque('saldo');
  const f = state.familias.find(f => f.id === Number(famId));

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
    toast(`Pix de ${fmt(f.saldo)} enviado 💸`);
  };

  const enviar = c => {
    dispatch({ type: 'ENVIAR_COMPROVACAO', familiaId: f.id, condicaoId: c.id });
    toast('Comprovação enviada ao Instituto Vivá 📎');
  };

  return (
    <>
      <h2>Carteira da Família — {PROVIDER_CARTEIRA} ({REDE})</h2>
      <label>Simular como:</label>
      <select style={{ maxWidth: 340 }} value={famId} onChange={e => trocarFamilia(Number(e.target.value))}>
        {state.familias.map(fa => <option key={fa.id} value={fa.id}>{fa.resp} ({fa.criancas} criança{fa.criancas > 1 ? 's' : ''})</option>)}
      </select>
      <div style={{ height: 14 }} />

      <Consentimento familia={f} />

      {noWizard && <Onboarding familia={f} onDone={() => setFeito(true)} />}

      {f.carteira && !noWizard && (
        <div className="grid g2">
          <div className={'card destaque' + focoSaldo}>
            <h3>Saldo</h3>
            <ValorAnimado valor={f.saldo} className="saldo-big" prefixo="" />
            <div style={{ fontSize: 13, color: 'var(--cinza)' }}>
              {MOEDA} · = {fmt(f.saldo)} · 1 {MOEDA.split('/')[0]} = R$ 1,00 (moeda estável)
            </div>

            <div className="meta-carteira">
              <div><span className="mini">endereço {REDE}</span><div className="hash sel">{f.carteira.end}</div></div>
              <div className="meta-linha">
                <span className="tag info">rede: {f.carteira.rede || REDE}</span>
                <span className="tag info">provider: {f.carteira.provider || PROVIDER_CARTEIRA}</span>
                <span className="tag ok">PIN definido</span>
              </div>
              <span className="mini">criada em {f.carteira.criadaEm}{f.carteira.celular ? ` · recuperação: ${f.carteira.celular}` : ''}</span>
            </div>

            <DestravarPin familia={f} />

            <button className="acao" style={{ marginTop: 14 }} disabled={f.saldo <= 0} onClick={sacar}>
              💸 Sacar tudo via Pix
            </button>

            <h3 style={{ marginTop: 20 }}>Extrato</h3>
            {f.extrato.length === 0 && (
              <EstadoVazio icone="🧾" titulo="Sem movimentações ainda"
                dica="O primeiro bônus aparece aqui quando o cofre 2-de-3 executar a proposta." />
            )}
            {[...f.extrato].reverse().map((e, i) => (
              <div key={i} className="extrato-linha">
                <span>{e.desc}</span>
                <b className={e.valor >= 0 ? 'entrou' : 'saiu'}>{e.valor >= 0 ? '+' : '−'}{fmt(Math.abs(e.valor))}</b>
              </div>
            ))}
          </div>

          <div className="card destaque">
            <h3>Compromissos de saúde e educação</h3>
            <p style={{ fontSize: 12, color: 'var(--cinza)' }}>
              Envie a comprovação (foto da carteira de vacinação, declaração da escola…). O documento fica em ambiente
              seguro — <b>nunca na rede</b>. Se ainda não der para comprovar, o bônus fica reservado, não é perdido.
            </p>
            {f.condicoes.length === 0 && <EstadoVazio icone="📋" titulo="Nenhum compromisso cadastrado" />}
            {f.condicoes.map(c => {
              const [tom, rot] = STATUS[c.status] || ['info', c.status];
              return (
                <div key={c.id} style={{ borderBottom: '1px solid var(--borda)', padding: '8px 0' }}>
                  <b>{c.tipo}</b> <span className="tag info">{c.mes}</span>
                  <div style={{ marginTop: 4 }}>
                    <Badge tom={tom}>{rot}</Badge>
                    {c.status === 'pendente' && (
                      <button className="acao sec" style={{ marginLeft: 10 }} onClick={() => enviar(c)}>
                        📎 Enviar comprovação
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="aviso" style={{ marginTop: 14 }}>
              <b>Lembrete:</b> a renda do trabalho de coleta é paga por fora e <b>não depende</b> destes compromissos.
              Aqui é só o bônus adicional do Fundo Infância ({fmt(BONUS_POR_CRIANCA)}/criança/mês).
            </div>
            <p className="mini">
              👉 Para ver a tela que a família usa no celular, abra a aba <b>📱 App da Família</b> ou acesse
              <b> {location.origin}/#/familia</b>.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
