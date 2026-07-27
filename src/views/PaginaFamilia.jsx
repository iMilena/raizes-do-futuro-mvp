import React, { useEffect, useRef, useState } from 'react';
import {
  useStore, fmt, trunc, BONUS_POR_CRIANCA,
  temPin, conferirPin, hashPin, novoSal, MAX_TENTATIVAS_PIN, progressoMeta,
} from '../store.jsx';
import { useToast, Badge, EstadoVazio, ValorAnimado, Confete, BarraProgresso } from '../ui.jsx';
import { useDemo, useDestaque } from '../demo.jsx';
import { sha256Arquivo } from '../evidencia.js';
import { letraGrande, salvarLetra } from '../preferencias.js';
import {
  vozDisponivel, vozLigada, ligarVoz, falar, parar as pararVoz, aoMudarVozes,
} from '../voz.js';

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

/**
 * A Tuca, com voz opcional.
 *
 * O botão de som só aparece se o aparelho tiver voz pt-BR instalada, e ele
 * NUNCA fala sozinho antes de a pessoa ligar. Depois de ligado, cada balão novo
 * é lido — que é o ponto: quem lê com dificuldade acompanha a tela sem depender
 * de outra pessoa para saber o próprio saldo.
 */
function Mascote({ fala }) {
  const [temVoz, setTemVoz] = useState(() => vozDisponivel());
  const [ligada, setLigada] = useState(() => vozLigada());
  const ultima = useRef(null);

  // a lista de vozes chega assíncrona: consultar só no boot conclui "não tem"
  useEffect(() => aoMudarVozes(vs => setTemVoz(vs.length > 0)), []);

  // lê cada balão NOVO, e só quando a pessoa ligou
  useEffect(() => {
    if (!ligada || fala === ultima.current) return;
    ultima.current = fala;
    falar(fala);
  }, [fala, ligada]);

  // sair da tela cala a Tuca; voz continuando depois de fechar é assustador
  useEffect(() => () => pararVoz(), []);

  const alternar = () => {
    const nova = !ligada;
    setLigada(nova);
    ligarVoz(nova);
    if (nova) { ultima.current = fala; falar(fala, { forcar: true }); }
  };

  return (
    <div className="mascote">
      <span className="mascote-bicho" style={{ fontSize: 38 }} aria-hidden="true">🐢</span>
      <div className="balao">
        {fala}
        {temVoz && (
          <button className={'balao-voz' + (ligada ? ' on' : '')} onClick={alternar}
            aria-pressed={ligada}
            title={ligada ? 'Desligar a voz da Tuca' : 'Ouvir a Tuca ler em voz alta'}>
            {ligada ? '🔊' : '🔈'} <span>{ligada ? 'ouvindo' : 'ouvir'}</span>
          </button>
        )}
      </div>
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
  { icone: '🔢', rot: 'Meu PIN' },
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

      {/* O PIN já foi criado na entrada, e agora ele é conferido de verdade.
          Pedir outro aqui faria a família ter dois segredos para a mesma conta —
          e ninguém entende por quê. Esta missão passou a CONFIRMAR o que existe
          e a explicar como funciona a recuperação. */}
      {!pronto && missao === 1 && (
        <div className="card">
          <Mascote fala="Seu PIN de 4 números já está guardado neste celular. É ele que protege sua conta — igual à senha do cartão." />
          <div className="passo-a-passo">
            <div><span>🔒</span><span>Só este celular conhece o seu PIN.</span></div>
            <div><span>🙈</span><span>Ninguém do projeto consegue ver qual é — nem para te ajudar.</span></div>
            <div><span>🤝</span><span>Se esquecer, o agente do Instituto Vivá destrava pessoalmente e você escolhe outro.</span></div>
          </div>
          <div className="conceito" style={{ marginTop: 10 }}>
            💡 Nada de senhas complicadas de 12 palavras para decorar.
          </div>
          <button className="acao bloco" onClick={avancar}>Entendi, meu PIN está pronto → 🌟</button>
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

  /**
   * Guarda o comprovante como TEXTO, não imagem.
   *
   * Imagem exigiria canvas + fonte + layout, e sairia diferente em cada
   * aparelho. Texto abre no WhatsApp, cabe num print, dá para ler em voz alta e
   * funciona offline. `navigator.share` é o caminho nativo; sem ele, cai para a
   * área de transferência, que existe em todo navegador.
   */
  const guardarComprovante = async () => {
    const texto = [
      'COMPROVANTE — Raízes do Futuro',
      `Valor: ${fmt(feito)}`,
      `Para: ${familia.resp}`,
      `Quando: ${new Date().toLocaleString('pt-BR')}`,
      'Taxa: R$ 0,00 (sem custo para a família)',
      'Piloto de Boipeba, BA · Instituto Vivá',
    ].join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Comprovante Raízes do Futuro', text: texto });
        return;
      }
      await navigator.clipboard.writeText(texto);
      toast('Comprovante copiado — cole onde quiser guardar 📋', 'info', 5000);
    } catch {
      /* a pessoa cancelou o compartilhamento: não é erro, e avisar seria ruído */
    }
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
      {/* O comprovante tem de ser DELA: aparecia na tela e desaparecia. Quem
          recebe dinheiro digital precisa poder guardar e mostrar a prova —
          é o que troca desconfiança por tranquilidade. */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button className="acao" style={{ flex: 1 }} onClick={guardarComprovante}>
          📤 Guardar comprovante
        </button>
        <button className="acao sec" style={{ flex: 1 }} onClick={onFechar}>Voltar</button>
      </div>
    </div>
  );

  return (
    <div className="card">
      <h3 className="fam-h3" style={{ marginTop: 0 }}>Retirar dinheiro</h3>
      <label>Quanto você quer retirar? (você tem {fmt(familia.saldo)})</label>
      <input className="input-valor" type="number" min="1" max={familia.saldo} value={valor}
        onChange={e => setValor(e.target.value)} placeholder="R$ 0,00" />
      <div className="atalhos-valor">
        {/* "Tudo" tem de ser o saldo EXATO, não arredondado para baixo.
            Com centavos no saldo (a renda é rateada por quilo), o Math.floor
            deixava R$ 0,14 presos na conta — a pessoa toca em "Tudo", vê que
            sobrou dinheiro e conclui, com razão, que o app comeu um trocado.
            Nos atalhos de 25% e 50% o arredondamento continua, porque ali valor
            redondo é mais fácil de conferir de cabeça. */}
        {[0.25, 0.5, 1].map(p => (
          <button key={p} className="acao sec"
            onClick={() => setValor(p === 1 ? String(familia.saldo) : String(Math.floor(familia.saldo * p)))}>
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

/* ------------------------------------------------------------------ meta ---- */
/**
 * Meta de poupança — definida pela família, para o objetivo dela.
 *
 * O que este componente deliberadamente NÃO faz:
 *  · não sugere metas "certas" (educação, saúde) como se o projeto soubesse
 *    melhor do que a mãe o que a casa precisa;
 *  · não impede nem questiona o saque — não há "tem certeza? sua meta…";
 *  · não dá ponto, medalha ou sequência por guardar. Premiar quem guarda é
 *    repreender quem precisou gastar.
 * O que ele faz é o que falta na vida real: mostrar quanto falta.
 */
function Meta({ familia }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [abrindo, setAbrindo] = useState(false);
  const [form, setForm] = useState({ nome: '', valor: '' });
  const p = progressoMeta(familia);
  const [festejou, setFestejou] = useState(false);

  /* comemora UMA vez ao alcançar, e só isso: a festa é do objetivo dela, não
     recompensa nossa por comportamento */
  useEffect(() => {
    if (p?.alcancada && !festejou) { setFestejou(true); }
  }, [p?.alcancada, festejou]);

  const salvar = () => {
    const valor = Number(form.valor);
    if (!form.nome.trim() || !(valor > 0)) { toast('Escreva para o que é e quanto', 'alerta'); return; }
    dispatch({ type: 'DEFINIR_META', familiaId: familia.id, nome: form.nome.trim(), valor });
    toast('Meta guardada 🎯', 'info');
    setAbrindo(false);
    setForm({ nome: '', valor: '' });
  };

  const remover = () => {
    dispatch({ type: 'REMOVER_META', familiaId: familia.id });
    toast('Meta apagada');
  };

  if (!p && !abrindo) {
    return (
      <button className="meta-convite" onClick={() => setAbrindo(true)}>
        🎯 <span>Quer guardar para alguma coisa? <b>Criar uma meta</b></span>
      </button>
    );
  }

  if (abrindo) {
    return (
      <div className="card meta-card" style={{ marginTop: 11 }}>
        <b style={{ fontSize: 15 }}>🎯 Sua meta</b>
        <p className="mini" style={{ marginTop: 2 }}>
          Você escolhe para o que é e quanto. Isso <b>não bloqueia</b> seu dinheiro —
          você retira quando quiser, com meta ou sem meta.
        </p>
        <label htmlFor="meta-nome">Guardar para</label>
        <input id="meta-nome" value={form.nome} maxLength={60}
          onChange={e => setForm({ ...form, nome: e.target.value })}
          placeholder="escreva com suas palavras" />
        <label htmlFor="meta-valor">Quanto você quer juntar</label>
        <input id="meta-valor" type="number" min="1" inputMode="numeric" value={form.valor}
          onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="R$ 0,00" />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="acao" style={{ flex: 1 }} onClick={salvar}>Guardar meta</button>
          <button className="acao sec" onClick={() => setAbrindo(false)}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className={'card meta-card' + (p.alcancada ? ' feita' : '')} style={{ marginTop: 11 }}>
      {p.alcancada && festejou && <Confete />}
      <div className="meta-topo">
        <div>
          <b>🎯 {p.nome}</b>
          <div className="mini">meta de {fmt(p.alvo)}</div>
        </div>
        <button className="meta-apagar" onClick={remover} title="Apagar a meta">apagar</button>
      </div>
      <BarraProgresso pct={p.pct} rot={`${Math.floor(p.pct)}%`} />
      <p className="mini meta-falta">
        {p.alcancada
          ? <><b>Você já juntou o que queria!</b> O dinheiro está disponível, é seu.</>
          : <>Você tem <b>{fmt(p.tem)}</b> · faltam <b>{fmt(p.falta)}</b></>}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- ajuda (zap) ---- */
const TEL_AGENTE = '+5575988870000'; // agente de campo do piloto (número de demonstração)

function AjudaZap({ familia, onFechar }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [digitou, setDigitou] = useState(false);
  const avisar = Boolean(familia?.avisarWhatsapp);

  useEffect(() => {
    const t = setTimeout(() => setDigitou(true), 1400);
    return () => clearTimeout(t);
  }, []);

  const alternarAviso = () => {
    dispatch({ type: 'AVISO_WHATSAPP', familiaId: familia.id, ligar: !avisar });
    toast(avisar
      ? 'Aviso desligado — você continua vendo tudo aqui no app'
      : 'Pronto! Você recebe uma mensagem quando o bônus cair 💬', 'info', 5000);
  };

  return (
    <div className="card" style={{ marginTop: 10 }}>
      <b>💬 Instituto Vivá — atendimento pelo WhatsApp</b>
      <div className="zap" style={{ marginTop: 8 }}>
        <div className="zap-msg familia">Oi! Como faço para enviar o comprovante da escola?</div>
        {!digitou
          ? <div className="zap-msg agente digitando"><span /><span /><span /></div>
          : <div className="zap-msg agente">Oi! É só tocar em "📎 Enviar foto do comprovante" no compromisso da matrícula e fotografar a declaração. Qualquer coisa eu passo aí na comunidade para ajudar 🌱</div>}
      </div>

      {/* Aviso quando o dinheiro chega. Antes, a família só descobria abrindo o
          app "por acaso" — e ninguém abre um app todo dia para ver se caiu algo.
          O canal é WhatsApp porque é o que ela já usa; opt-in porque mensagem
          não pedida sobre dinheiro assusta. */}
      <label className="opcao-aviso">
        <input type="checkbox" checked={avisar} onChange={alternarAviso} />
        <span>
          <b>Me avisar no WhatsApp quando o bônus cair</b>
          <small>Só sobre o seu dinheiro. Nada de propaganda, e você desliga quando quiser.</small>
        </span>
      </label>
      {avisar && (
        <p className="mini so-sim" style={{ marginTop: 6 }}>
          (na demonstração a mensagem não é enviada de verdade — o registro da
          escolha fica gravado)
        </p>
      )}

      {/* Ligar, não só escrever: quem tem dificuldade com texto liga. */}
      <a className="acao bloco centro" href={`tel:${TEL_AGENTE}`} style={{ textDecoration: 'none' }}>
        📞 Ligar para o agente
      </a>
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
  const [pin2, setPin2] = useState('');   // confirmação, só na criação
  const [erroPin, setErroPin] = useState('');
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

  /* --------------------------------------------- acessibilidade e rede --- */
  const [letraG, setLetraG] = useState(() => letraGrande());
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const sobe = () => setOnline(true);
    const cai = () => setOnline(false);
    window.addEventListener('online', sobe);
    window.addEventListener('offline', cai);
    return () => { window.removeEventListener('online', sobe); window.removeEventListener('offline', cai); };
  }, []);

  /* de onde vem o saldo: renda do trabalho (incondicional) x bônus (condicional) */
  const rendaTotal = (f?.extrato || [])
    .filter(e => e.tipo === 'renda').reduce((a, e) => a + e.valor, 0);
  const bonusTotal = (f?.extrato || [])
    .filter(e => e.tipo !== 'renda' && e.valor > 0).reduce((a, e) => a + e.valor, 0);

  /* ------------------------------------------------------------ PIN ------ */
  /* A família escolhida na lista, antes de entrar — a tela precisa saber se ela
     já tem PIN para pedir "crie" em vez de "digite". */
  const escolhida = state.familias.find(x => x.id === Number(famId)) || null;
  const primeiraVez = Boolean(escolhida) && !temPin(escolhida);
  const bloqueada = Boolean(escolhida?.pin?.bloqueado);
  const restantes = MAX_TENTATIVAS_PIN - (escolhida?.pin?.tentativas || 0);

  const entrar = async () => {
    if (!escolhida) return;
    if (primeiraVez) {
      if (pin !== pin2) { setErroPin('Os dois PINs não são iguais. Tente de novo.'); setPin2(''); return; }
      if (/^(\d)\1{3}$/.test(pin) || ['1234', '4321', '0123'].includes(pin)) {
        /* recusar 1111 e 1234 não é preciosismo: são os dois primeiros palpites
           de qualquer pessoa, e o PIN é a única barreira do celular. */
        setErroPin('Escolha um PIN menos fácil de adivinhar (evite 1111 ou 1234).');
        return;
      }
      const sal = novoSal();
      const hash = await hashPin(pin, sal);
      if (!hash) { setErroPin('Este navegador não permite guardar o PIN com segurança.'); return; }
      dispatch({ type: 'DEFINIR_PIN', familiaId: escolhida.id, hash, sal });
      toast('PIN criado 🔒 — ele fica só neste celular');
      setPin(''); setPin2(''); setEntrou(true);
      return;
    }
    if (await conferirPin(escolhida, pin)) {
      dispatch({ type: 'PIN_CERTO', familiaId: escolhida.id });
      setPin(''); setErroPin(''); setEntrou(true);
    } else {
      dispatch({ type: 'PIN_ERRADO', familiaId: escolhida.id });
      setPin('');
      setErroPin(restantes <= 1
        ? 'PIN errado. Este celular foi travado — procure o agente.'
        : 'PIN errado. Confira e tente de novo.');
    }
  };

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
    <div className={'fam-tela' + (letraG ? ' letra-g' : '')}>
      <div className="fam-topo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img className="fam-logo" src="./emblema.png" alt="" aria-hidden="true" />
          <div>
            <div className="fam-marca">Raízes do Futuro</div>
            <div className="fam-sub">conta da família{logado && f ? ` · ${f.resp.split(' ')[0]}` : ''}</div>
          </div>
        </div>
        <div className="fam-topo-acoes">
          {/* letra maior: a voz serve quem lê com dificuldade; isto serve quem
              lê, mas vê pouco — e em muitas famílias quem cuida é a avó */}
          <button className="fam-letra" onClick={() => setLetraG(v => { salvarLetra(!v); return !v; })}
            aria-pressed={letraG} title={letraG ? 'Voltar ao tamanho normal' : 'Aumentar a letra'}>
            {letraG ? 'A−' : 'A+'}
          </button>
          {logado && !rodando && (
            <button className="fam-sair" onClick={() => { setEntrou(false); setPin(''); setOnboardOk(false); setOnbFam(null); setSacando(false); }}>sair</button>
          )}
        </div>
      </div>

      {/* Estado da rede, dito em voz de gente. O app é local-first: o saldo
          continua correto sem internet, mas a família não tinha como saber
          disso — e não saber, com dinheiro, é insegurança. */}
      {!online && (
        <div className="fam-offline">
          📴 <b>Sem internet agora.</b> Seu saldo está guardado neste celular e continua certo.
          O que você fizer agora é enviado sozinho quando o sinal voltar.
        </div>
      )}

      <div className="fam-corpo">
        {/* entrada */}
        {!logado && (
          <div className="fam-entrada">
            <img className="fam-logo-entrada" src="./logo.png" alt="Raízes do Futuro" />
            <Mascote fala={
              !escolhida ? 'Oi! Escolha sua família para começar.'
                : bloqueada ? 'Este celular está travado. Procure o agente do Instituto Vivá — ele destrava sem ver seu PIN.'
                  : primeiraVez ? 'Primeira vez aqui! Escolha um PIN de 4 números só seu. Ele fica guardado neste celular.'
                    : 'Bem-vinda de volta! Digite seu PIN para entrar.'} />
            <div className="card">
              <label>Quem é você?<span className="so-sim"> (simulação)</span></label>
              <select value={famId} onChange={e => { setFamId(e.target.value); setOnboardOk(false); setOnbFam(null); setPin(''); setPin2(''); setErroPin(''); }}>
                <option value="">Escolha a família…</option>
                {state.familias.map(fa => <option key={fa.id} value={fa.id}>{fa.resp}</option>)}
              </select>

              {bloqueada ? (
                <p className="conceito" style={{ marginTop: 14 }}>
                  🔒 Depois de {MAX_TENTATIVAS_PIN} tentativas erradas, este celular travou
                  para proteger sua conta. O agente destrava presencialmente — e você escolhe
                  um PIN novo, que ninguém mais vê.
                </p>
              ) : (
                <>
                  <label htmlFor="pin-fam">
                    {primeiraVez ? 'Escolha seu PIN (4 números)' : 'Seu PIN (4 números)'}
                  </label>
                  <input id="pin-fam" type="password" inputMode="numeric" maxLength={4} value={pin}
                    onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setErroPin(''); }} placeholder="••••"
                    style={{ textAlign: 'center', fontSize: 20, letterSpacing: 8 }} />

                  {primeiraVez && (
                    <>
                      <label htmlFor="pin-fam2">Repita o PIN</label>
                      <input id="pin-fam2" type="password" inputMode="numeric" maxLength={4} value={pin2}
                        onChange={e => { setPin2(e.target.value.replace(/\D/g, '')); setErroPin(''); }} placeholder="••••"
                        style={{ textAlign: 'center', fontSize: 20, letterSpacing: 8 }} />
                      <p className="mini">
                        Guarde bem: o PIN fica só neste celular, ninguém do projeto consegue ver.
                        Se esquecer, o agente destrava e você escolhe outro.
                      </p>
                    </>
                  )}

                  {erroPin && <p className="mini alerta-txt" style={{ marginTop: 8 }}>{erroPin}</p>}
                  {!primeiraVez && restantes < MAX_TENTATIVAS_PIN && restantes > 0 && (
                    <p className="mini alerta-txt">
                      {restantes === 1 ? 'Última tentativa antes de travar.' : `${restantes} tentativas restantes.`}
                    </p>
                  )}

                  <button className="acao grande" disabled={!escolhida || pin.length !== 4 || (primeiraVez && pin2.length !== 4)}
                    onClick={entrar}>
                    {primeiraVez ? 'Criar meu PIN e entrar' : 'Entrar'}
                  </button>
                </>
              )}
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

              {/* De onde vem o dinheiro — a parte que o app escondia.
                  A renda do trabalho é INCONDICIONAL e é o princípio nº 1 do
                  projeto; mostrar só o bônus fazia a tela dizer que todo o
                  dinheiro depende de condição. */}
              <div className="saldo-origem">
                <div>
                  <b>{fmt(rendaTotal)}</b>
                  <span>do seu trabalho<br /><i>sempre seu</i></span>
                </div>
                <div>
                  <b>{fmt(bonusTotal)}</b>
                  <span>de bônus<br /><i>saúde e escola</i></span>
                </div>
              </div>
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

            {/* a meta vem DEPOIS do saldo e do botao de retirar, de proposito:
                primeiro o dinheiro e o acesso a ele, depois o plano dela */}
            <Meta familia={f} />

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
              {f.extrato.length === 0 && <EstadoVazio icone="🧾" titulo="Nada por aqui ainda" dica="Sua renda, seus bônus e suas retiradas vão aparecer nesta lista." />}
              {[...f.extrato].reverse().map((e, i) => (
                <div key={i} className="extrato-linha">
                  <div>
                    {/* a origem de cada linha, em uma palavra: sem isso a família
                        não distingue o que é dela por direito do que é bônus */}
                    <span className="extrato-desc">
                      {e.tipo === 'renda' && <span className="tag-origem trabalho">trabalho</span>}
                      {e.tipo !== 'renda' && e.valor > 0 && <span className="tag-origem bonus">bônus</span>}
                      {e.desc}
                    </span>
                    <div className="mini">{new Date(e.ts).toLocaleDateString('pt-BR')}</div>
                  </div>
                  <b className={e.valor >= 0 ? 'entrou' : 'saiu'}>{e.valor >= 0 ? '+' : '−'}{fmt(Math.abs(e.valor))}</b>
                </div>
              ))}
            </div>

            {ajuda && <AjudaZap familia={f} onFechar={() => setAjuda(false)} />}
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
