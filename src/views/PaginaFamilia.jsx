import React, { useEffect, useRef, useState } from 'react';
import { useStore, fmt, trunc, BONUS_POR_CRIANCA } from '../store.jsx';
import { useToast, Badge, EstadoVazio, ValorAnimado, Confete, BarraProgresso } from '../ui.jsx';
import { useDemo, useDestaque } from '../demo.jsx';
import { sha256Arquivo } from '../evidencia.js';

/* ---------------------------------------------------------------------------
   App da Família — a tela que a família usa no celular.
   Regra de ouro: nenhum jargão técnico. É "conta da família", "dinheiro",
   "bônus" e "cofre digital" — nunca wallet, token ou blockchain.
--------------------------------------------------------------------------- */

const STATUS = {
  pendente: ['pend', 'enviar comprovante'],
  comprovada: ['info', 'em análise'],
  'aguardando-assinaturas': ['prop', 'aprovado — liberando'],
  liberada: ['ok', 'bônus recebido ✔'],
  'validada-aguardando': ['info', 'guardado para você 🔒'],
};

function Mascote({ fala }) {
  return (
    <div className="mascote">
      <span className="mascote-bicho" style={{ fontSize: 38 }} aria-hidden="true">🐢</span>
      <div className="balao">{fala}</div>
    </div>
  );
}

/* Som suave de "dinheiro recebido" + vibração (quando o aparelho suporta) */
function celebrar() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const nota = (freq, t0, dur) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t0);
      g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
      o.start(ctx.currentTime + t0);
      o.stop(ctx.currentTime + t0 + dur + 0.05);
    };
    nota(880, 0, 0.18);      // lá
    nota(1318.5, 0.12, 0.3); // mi agudo — "din-din" de Pix
  } catch (e) { /* sem áudio, segue o jogo */ }
  try { if (navigator.vibrate) navigator.vibrate([30, 40, 60]); } catch (e) { /* idem */ }
}

/* QR fake determinístico para o recibo do Pix */
function QrFake({ semente = 7 }) {
  const N = 13, cel = 8;
  const quad = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const canto = (x < 4 && y < 4) || (x > N - 5 && y < 4) || (x < 4 && y > N - 5);
      const cheio = canto ? (x % 3 !== 1 || y % 3 !== 1) : ((x * 7 + y * 11 + semente) % 5 < 2);
      if (cheio) quad.push(<rect key={x + '-' + y} x={x * cel} y={y * cel} width={cel - 1} height={cel - 1} fill="#26332b" />);
    }
  }
  return <svg className="qr" width="118" height="118" viewBox={`0 0 ${N * cel} ${N * cel}`} role="img" aria-label="QR code simulado">{quad}</svg>;
}

/* ------------------------------------------- onboarding gamificado (Tuca) ---- */
const MISSOES = [
  { icone: '🧺', rot: 'Escolher onde guardar' },
  { icone: '🔢', rot: 'Criar meu PIN' },
  { icone: '📋', rot: 'Meus compromissos' },
  { icone: '💸', rot: 'Como retirar' },
];

function Onboarding({ familia, onDone }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [missao, setMissao] = useState(0);
  const [provider, setProvider] = useState(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [medalha, setMedalha] = useState(false);
  const [pronto, setPronto] = useState(false);
  const pinOk = pin.every(d => d.length === 1);

  const setDigito = (i, v) => {
    const p = [...pin];
    p[i] = v.replace(/\D/g, '').slice(-1);
    setPin(p);
  };

  const avancar = () => {
    setMedalha(true);
    setTimeout(() => setMedalha(false), 1100);
    setMissao(m => m + 1);
  };

  const concluir = () => {
    dispatch({ type: 'CRIAR_CARTEIRA', id: familia.id, provider: provider || 'Picnic' });
    toast(`Conta da família criada${provider === 'Solana' ? ' no seu aplicativo 📲' : ' na Picnic 🧺'} 🎉`);
    celebrar();
    setPronto(true);
  };

  return (
    <div className="fam-onb">
      {medalha && <span className="medalha-voa" aria-hidden="true">🌟</span>}
      {pronto && <Confete />}

      <BarraProgresso
        pct={pronto ? 100 : ((missao + 1) / MISSOES.length) * 100}
        rot={pronto ? 'Concluído!' : `Missão ${missao + 1} de ${MISSOES.length}`}
      />

      <div className="missoes-trilha" role="list">
        {MISSOES.map((m, i) => (
          <div key={m.rot} role="listitem"
            className={'missao-passo' + (i === missao && !pronto ? ' atual' : '') + (i < missao || pronto ? ' feita' : '')}>
            <span className="missao-icone">{i < missao || pronto ? '✅' : m.icone}</span>
            <span className="missao-rot">{m.rot}</span>
          </div>
        ))}
      </div>

      {!pronto && missao === 0 && (
        <div className="card">
          <Mascote fala={`Oi, ${familia.resp.split(' ')[0]}! Eu sou a Tuca, tartaruga de Boipeba. Vou te ajudar a criar a conta da sua família — leva 2 minutinhos. Primeiro: escolha onde o seu dinheiro vai ficar guardado.`} />
          <button className={'btn-conexao' + (provider === 'Picnic' ? ' sel' : '')} onClick={() => setProvider('Picnic')}>
            <span className="ic" aria-hidden="true">🧺</span>
            <span><b>Conectar com Picnic</b> <span className="tag ok">recomendado</span><br />
              <small>Aplicativo brasileiro, simples, com retirada em reais pelo Pix</small></span>
          </button>
          <button className={'btn-conexao' + (provider === 'Solana' ? ' sel' : '')} onClick={() => setProvider('Solana')}>
            <span className="ic" aria-hidden="true">📲</span>
            <span><b>Já tenho uma conta digital</b><br />
              <small>Receber o dinheiro no aplicativo que você já usa hoje</small></span>
          </button>
          <div className="conceito" style={{ marginTop: 10 }}>
            💡 Seu dinheiro fica num <b>cofre digital</b> que ninguém pode desviar — nem a gente.
          </div>
          <button className="acao bloco" disabled={!provider} onClick={avancar}>Missão cumprida → 🌟</button>
        </div>
      )}

      {!pronto && missao === 1 && (
        <div className="card">
          <Mascote fala="Agora crie um PIN de 4 números. É ele que protege sua conta — igual à senha do cartão. Guarde bem!" />
          <div className="pin">
            {pin.map((d, i) => (
              <input key={i} type="password" inputMode="numeric" maxLength={1} value={d}
                onChange={e => setDigito(i, e.target.value)} aria-label={`Número ${i + 1} do PIN`} />
            ))}
          </div>
          <div className="conceito">
            💡 Nada de senhas complicadas de 12 palavras. Se esquecer o PIN, um agente do Instituto Vivá ajuda a recuperar com o seu celular.
          </div>
          <button className="acao bloco" disabled={!pinOk} onClick={avancar}>Missão cumprida → 🌟</button>
        </div>
      )}

      {!pronto && missao === 2 && (
        <div className="card">
          <Mascote fala="Esses são os compromissos da sua família. Cada um cumprido vira um bônus a mais na conta — e a renda do seu trabalho continua garantida, sempre." />
          <ul className="lista-compromissos">
            {familia.condicoes.map(c => (
              <li key={c.id}>📌 <b>{c.tipo}</b> — bônus de {fmt(BONUS_POR_CRIANCA * familia.criancas)} em {c.mes}</li>
            ))}
            <li className="destaque-item">💡 Não deu para comprovar? O bônus fica <b>guardado para você</b> — não some.</li>
          </ul>
          <button className="acao bloco" onClick={avancar}>Entendi! → 🌟</button>
        </div>
      )}

      {!pronto && missao === 3 && (
        <div className="card">
          <Mascote fala="Última missão: retirar dinheiro é rapidinho. Olha só:" />
          <div className="passo-a-passo">
            <div><span>1</span> Aperte <b>💸 Retirar dinheiro</b></div>
            <div><span>2</span> Escolha o valor</div>
            <div><span>3</span> O dinheiro cai na sua conta pelo <b>Pix</b>, em reais</div>
          </div>
          <button className="acao bloco" onClick={concluir}>Criar minha conta 🎉</button>
        </div>
      )}

      {pronto && (
        <div className="card centro">
          <div className="badge-final">
            <div className="badge-medalha" aria-hidden="true">🏅</div>
            <b>Família Raízes do Futuro</b>
            <span>todas as 4 missões cumpridas ⭐⭐⭐⭐</span>
          </div>
          <Mascote fala="Conta criada! A partir de agora, cada bônus aprovado cai direto aqui. Vamos ver como ficou?" />
          <button className="acao bloco" onClick={onDone}>Abrir minha conta</button>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------- retirar dinheiro ---- */
function Saque({ familia, onFechar }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [valor, setValor] = useState('');
  const [feito, setFeito] = useState(0);
  const v = Math.min(Number(valor) || 0, familia.saldo);

  const confirmar = () => {
    dispatch({ type: 'SACAR_PIX', id: familia.id, valor: v });
    toast(`Pix de ${fmt(v)} enviado 💸`);
    celebrar();
    setFeito(v);
  };

  if (feito > 0) return (
    <div className="card recibo">
      <div className="recibo-check" aria-hidden="true">✅</div>
      <h3 className="fam-h3" style={{ margin: '4px 0' }}>Pix enviado!</h3>
      <div className="recibo-valor">{fmt(feito)}</div>
      <QrFake semente={Math.round(feito)} />
      <table className="recibo-tab" style={{ margin: '0 auto' }}>
        <tbody>
          <tr><td>Para</td><td><b>{familia.resp}</b></td></tr>
          <tr><td>Quando</td><td>{new Date().toLocaleString('pt-BR')}</td></tr>
          <tr><td>Taxa</td><td>R$ 0,00 — sem custo para a família</td></tr>
        </tbody>
      </table>
      <button className="acao bloco" onClick={onFechar}>Voltar</button>
    </div>
  );

  return (
    <div className="card">
      <h3 className="fam-h3" style={{ marginTop: 0 }}>Retirar dinheiro</h3>
      <label>Quanto você quer retirar? (você tem {fmt(familia.saldo)})</label>
      <input className="input-valor" type="number" min="1" max={familia.saldo} value={valor}
        onChange={e => setValor(e.target.value)} placeholder="R$ 0,00" />
      <div className="atalhos-valor">
        {[0.25, 0.5, 1].map(p => (
          <button key={p} className="acao sec" onClick={() => setValor(String(Math.floor(familia.saldo * p)))}>
            {p === 1 ? 'Tudo' : fmt(Math.floor(familia.saldo * p))}
          </button>
        ))}
      </div>
      {v > 0 && <div className="centro" style={{ margin: '10px 0' }}><span className="valor-confirma">{fmt(v)}</span></div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="acao" style={{ flex: 1 }} disabled={v <= 0} onClick={confirmar}>Confirmar Pix</button>
        <button className="acao sec" onClick={onFechar}>Cancelar</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- ajuda (zap) ---- */
function AjudaZap({ onFechar }) {
  const [digitou, setDigitou] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDigitou(true), 1400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="card" style={{ marginTop: 10 }}>
      <b>💬 Instituto Vivá — atendimento pelo WhatsApp</b>
      <div className="zap" style={{ marginTop: 8 }}>
        <div className="zap-msg familia">Oi! Como faço para enviar o comprovante da escola?</div>
        {!digitou
          ? <div className="zap-msg agente digitando"><span /><span /><span /></div>
          : <div className="zap-msg agente">Oi! É só tocar em "📎 Enviar foto do comprovante" no compromisso da matrícula e fotografar a declaração. Qualquer coisa eu passo aí na comunidade para ajudar 🌱</div>}
      </div>
      <button className="acao sec bloco" onClick={onFechar}>Fechar conversa</button>
    </div>
  );
}

/* ------------------------------------------------------------------ página ---- */
export default function PaginaFamilia({ standalone = false }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const { rodando, familiaDemo } = useDemo();
  const [famId, setFamId] = useState('');
  const [pin, setPin] = useState('');
  const [entrou, setEntrou] = useState(false);
  const [onboardOk, setOnboardOk] = useState(false);
  const [onbFam, setOnbFam] = useState(null); // família no meio das missões
  const [sacando, setSacando] = useState(false);
  const [ajuda, setAjuda] = useState(false);
  const [condAlvo, setCondAlvo] = useState(null);
  const compRef = useRef(null);

  const focoSaldo = useDestaque('saldo');
  const focoSaque = useDestaque('saque');
  const focoComp = useDestaque('compromissos');

  // o modo demo assume a tela com a família demonstrada, sem pedir login
  const efetivoId = rodando ? familiaDemo : Number(famId);
  const f = state.familias.find(x => x.id === efetivoId);
  const logado = rodando || (entrou && !!f);

  // no modo demo, o passo automático envia sem arquivo; ao vivo, abre a câmera/galeria
  // As missões começam quando a família entra sem conta e só terminam quando ela
  // toca em "Abrir minha conta". Sem esta trava, criar a conta desmontaria o
  // onboarding na hora e a tela final (badge 🏅 + confete) nunca apareceria.
  useEffect(() => {
    if (logado && f && !f.carteira) setOnbFam(f.id);
  }, [logado, f]);
  const noOnboarding = logado && f && onbFam === f.id && !onboardOk;

  const enviar = c => {
    if (rodando) {
      dispatch({ type: 'ENVIAR_COMPROVACAO', familiaId: f.id, condicaoId: c.id });
      toast('Foto do comprovante enviada 📎');
      return;
    }
    setCondAlvo(c.id);
    compRef.current?.click();
  };

  const aoEscolherComprovante = async e => {
    const arq = e.target.files?.[0];
    if (!arq || !condAlvo) return;
    try {
      const hash = await sha256Arquivo(arq);
      dispatch({ type: 'ENVIAR_COMPROVACAO', familiaId: f.id, condicaoId: condAlvo, evidHash: hash, arquivo: arq.name });
      toast(`Comprovante protegido e enviado 📎 (código ${trunc(hash, 6, 6)})`);
    } catch (err) {
      toast('Não foi possível ler a foto', 'alerta');
    }
    setCondAlvo(null);
    if (compRef.current) compRef.current.value = '';
  };

  const conteudo = (
    <div className="fam-tela">
      <div className="fam-topo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img className="fam-logo" src="./emblema.png" alt="" aria-hidden="true" />
          <div>
            <div className="fam-marca">Raízes do Futuro</div>
            <div className="fam-sub">conta da família{logado && f ? ` · ${f.resp.split(' ')[0]}` : ''}</div>
          </div>
        </div>
        {logado && !rodando && (
          <button className="fam-sair" onClick={() => { setEntrou(false); setPin(''); setOnboardOk(false); setOnbFam(null); setSacando(false); }}>sair</button>
        )}
      </div>

      <div className="fam-corpo">
        {/* entrada */}
        {!logado && (
          <div className="fam-entrada">
            <img className="fam-logo-entrada" src="./logo.png" alt="Raízes do Futuro" />
            <Mascote fala="Bem-vinda de volta! Escolha sua família e digite o PIN para entrar." />
            <div className="card">
              <label>Quem é você?<span className="so-sim"> (simulação)</span></label>
              <select value={famId} onChange={e => { setFamId(e.target.value); setOnboardOk(false); setOnbFam(null); }}>
                <option value="">Escolha a família…</option>
                {state.familias.map(fa => <option key={fa.id} value={fa.id}>{fa.resp}</option>)}
              </select>
              <label>PIN (4 números<span className="so-sim"> — qualquer um na demo</span>)</label>
              <input type="password" inputMode="numeric" maxLength={4} value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••"
                style={{ textAlign: 'center', fontSize: 20, letterSpacing: 8 }} />
              <button className="acao grande" disabled={!famId || pin.length !== 4} onClick={() => setEntrou(true)}>Entrar</button>
            </div>
          </div>
        )}

        {/* primeira vez: onboarding gamificado */}
        {noOnboarding && (
          <Onboarding familia={f} onDone={() => setOnboardOk(true)} />
        )}

        {/* conta da família */}
        {logado && f && f.carteira && !noOnboarding && (
          <>
            <div className={'card saldo-card' + focoSaldo}>
              <span className="saldo-rot">Você tem</span>
              <ValorAnimado valor={f.saldo} className="saldo-numero" />
              <span className="saldo-sub">disponível para retirar agora · conta {f.carteira.provider === 'Picnic' ? 'Picnic 🧺' : 'do seu aplicativo 📲'}</span>
              <div className={focoSaque}>
                <button className="acao grande" disabled={f.saldo <= 0} onClick={() => setSacando(true)}>
                  💸 Retirar dinheiro
                </button>
              </div>
              {state.propostas.some(p => p.status === 'reservada' && p.familiaId === f.id) && (
                <div className="saldo-guardado">
                  🔒 Você tem {fmt(state.propostas.filter(p => p.status === 'reservada' && p.familiaId === f.id).reduce((a, p) => a + p.valor, 0))} guardado
                  esperando você concluir um compromisso — esse valor não some.
                </div>
              )}
            </div>

            {sacando && <div style={{ marginTop: 10 }}><Saque familia={f} onFechar={() => setSacando(false)} /></div>}

            <h3 className={'fam-h3 ancora' + focoComp}>Compromissos do mês</h3>
            <div className={'fam-cards' + focoComp}>
              {f.condicoes.length === 0 && <EstadoVazio icone="📋" titulo="Nenhum compromisso este mês" />}
              {f.condicoes.map(c => {
                const [tom, rot] = STATUS[c.status] || ['info', c.status];
                return (
                  <div key={c.id} className="card compromisso">
                    <div className="compromisso-topo">
                      <b>{c.tipo}</b>
                      <span className="mes">{c.mes}</span>
                    </div>
                    <div className="compromisso-valor">+{fmt(BONUS_POR_CRIANCA * f.criancas)}</div>
                    <Badge tom={tom}>{rot}</Badge>
                    {c.status === 'pendente' && (
                      <button className="acao bloco" onClick={() => enviar(c)}>📎 Enviar foto do comprovante</button>
                    )}
                    {c.evidHash && (
                      <p className="mini" title="A foto fica no seu aparelho — só este código vai ao registro">
                        🔐 comprovante protegido · código {trunc(c.evidHash, 6, 6)}
                      </p>
                    )}
                    <p className="mini">A renda do seu trabalho não depende disso — aqui é só o bônus a mais.</p>
                  </div>
                );
              })}
            </div>

            <h3 className="fam-h3">Extrato</h3>
            <div className="card">
              {f.extrato.length === 0 && <EstadoVazio icone="🧾" titulo="Nada por aqui ainda" dica="Seus bônus e retiradas vão aparecer nesta lista." />}
              {[...f.extrato].reverse().map((e, i) => (
                <div key={i} className="extrato-linha">
                  <div>
                    <span className="extrato-desc">{e.desc}</span>
                    <div className="mini">{new Date(e.ts).toLocaleDateString('pt-BR')}</div>
                  </div>
                  <b className={e.valor >= 0 ? 'entrou' : 'saiu'}>{e.valor >= 0 ? '+' : '−'}{fmt(Math.abs(e.valor))}</b>
                </div>
              ))}
            </div>

            {ajuda && <AjudaZap onFechar={() => setAjuda(false)} />}
          </>
        )}
      </div>

      {logado && f?.carteira && (
        <button className="fab-ajuda" onClick={() => setAjuda(a => !a)}>💬 Falar com o Instituto Vivá</button>
      )}

      {/* input escondido: câmera/galeria para o comprovante */}
      <input ref={compRef} type="file" accept="image/*,application/pdf" capture="environment"
        style={{ display: 'none' }} onChange={aoEscolherComprovante} />
    </div>
  );

  if (standalone) return <div className="fam-tela standalone">{conteudo}</div>;

  return (
    <>
      <h2>App da Família — como a família vê no celular</h2>
      <p className="mini so-sim">
        Zero jargão técnico: aqui é "conta da família", "dinheiro" e "cofre digital".
        Esta tela também abre sozinha, em modo celular, no endereço <b>{location.origin + location.pathname}#/familia</b>.
      </p>
      <div className="moldura-celular">{conteudo}</div>
    </>
  );
}
