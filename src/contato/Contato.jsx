import { useEffect, useRef, useState } from 'react';
import { Foto } from '../landing/components/Foto';
import { logoRaizes, pilaresComunidade } from '../landing/images';
import { URL_EXPLORAR, URL_SITE } from '../config.js';
import { CONTATO } from './config.js';
import { ASSUNTOS, FORMS, PROXIMO, PROXIMO_PADRAO, ROTULO } from './formularios.js';
import '../estilos/site.css';
import './contato.css';

/* ---------------------------------------------------------------------------
   "Falar com a equipe" (#/contato), seguindo `prototipos/raizes-contato.html`.

   Três passos: o assunto, as perguntas daquele assunto e o contato, com um
   resumo editável e o consentimento da LGPD. O `?tipo=` da rota chega com o
   assunto já escolhido (os botões da landing usam isso).
--------------------------------------------------------------------------- */

const ICONES = {
  investimento: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  relatorio: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h5" /></>,
  territorio: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  imprensa: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h6M7 13h10M7 16h8" /></>,
  outro: <path d="M4 5h16v11H9l-5 4z" />,
  wa: <><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" /><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8c-1-.4-1.8-1.2-2.2-2.2l.8-1-1-2z" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  ig: <><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.5" /><circle cx="17" cy="7" r=".6" /></>,
};
const Icone = ({ k }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {ICONES[k]}
  </svg>
);
const Seta = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const Check = () => (
  <span className="ck" aria-hidden="true">
    <svg viewBox="0 0 12 12">
      <path d="M2 6.5l2.5 2.5L10 3" />
    </svg>
  </span>
);

/** 5571984233923 → (71) 98423-3923, para ler como número de telefone. */
const telefone = (n) => n.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lê o `?tipo=` de dentro do hash (`#/contato?tipo=investimento`). */
function tipoDaRota(rota) {
  const q = (rota || '').split('?')[1] || '';
  const tipo = new URLSearchParams(q).get('tipo');
  return tipo && FORMS[tipo] ? tipo : null;
}

function Pontos({ n }) {
  return (
    <div className="dots" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= n ? 'on' : undefined} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ passo 1 -- */
/**
 * Os cartões de assunto formam um grupo de rádio de verdade: só o marcado (ou
 * o primeiro) entra na ordem de tabulação, e as setas movem a escolha, como
 * num `<input type="radio">`.
 */
function Assuntos({ intent, escolher }) {
  const grupo = useRef(null);
  const indice = Math.max(0, ASSUNTOS.findIndex((a) => a.v === intent));

  const aoTeclar = (e) => {
    const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!passo) return;
    e.preventDefault();
    const n = (indice + passo + ASSUNTOS.length) % ASSUNTOS.length;
    escolher(ASSUNTOS[n].v);
    grupo.current?.querySelectorAll('[role="radio"]')[n]?.focus();
  };

  return (
    <div className="intents" role="radiogroup" aria-label="Assunto" ref={grupo} onKeyDown={aoTeclar}>
      {ASSUNTOS.map((a, i) => (
        <button
          key={a.v}
          type="button"
          role="radio"
          aria-checked={intent === a.v}
          tabIndex={i === indice ? 0 : -1}
          className={`intent${a.largo ? ' wide' : ''}`}
          onClick={() => escolher(a.v)}
        >
          <span className="ic">
            <Icone k={a.icone} />
          </span>
          <Check />
          <b>{a.rotulo}</b>
          <small>{a.sub}</small>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ passo 2 -- */
function Pergunta({ x, valor, mudar, cheio }) {
  if (x.type === 'pills') {
    return (
      <div className="f full" role="group" aria-labelledby={`ct-l-${x.id}`}>
        <span className="lbl" id={`ct-l-${x.id}`}>
          {x.l}
        </span>
        <div className="pills">
          {x.o.map((o) => (
            <button key={o} type="button" aria-pressed={valor === o} onClick={() => mudar(x.id, o)}>
              {o}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (x.type === 'select') {
    return (
      <div className={`f${cheio ? ' full' : ''}`}>
        <label className="lbl" htmlFor={`ct-${x.id}`}>
          {x.l}
        </label>
        <select id={`ct-${x.id}`} value={valor || ''} onChange={(e) => mudar(x.id, e.target.value)}>
          <option value="">Escolha</option>
          {x.o.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div className={`f${cheio ? ' full' : ''}`}>
      <label className="lbl" htmlFor={`ct-${x.id}`}>
        {x.l}
      </label>
      <input
        id={`ct-${x.id}`}
        type={x.type}
        placeholder={x.ph || ''}
        value={valor || ''}
        onChange={(e) => mudar(x.id, e.target.value)}
      />
    </div>
  );
}

/* ------------------------------------------------------------ passo 3 -- */
function Campo({ id, rotulo, opcional, erro, children }) {
  return (
    <div className={`f${erro ? ' bad' : ''}${id === 'msg' ? ' full' : ''}`}>
      <label className="lbl" htmlFor={`ct-${id}`}>
        {rotulo}
        {opcional && <em> (opcional)</em>}
      </label>
      {children}
      {erro && (
        <span className="err" id={`ct-${id}-err`}>
          {erro}
        </span>
      )}
    </div>
  );
}

function formatarData(v) {
  return new Date(v + 'T12:00').toLocaleDateString('pt-BR');
}

/* -------------------------------------------------------------- página -- */
export function Contato({ rota }) {
  const [passo, setPasso] = useState(1);
  const [intent, setIntent] = useState(() => tipoDaRota(rota));
  const [data, setData] = useState({});
  const [pessoa, setPessoa] = useState({ nome: '', org: '', email: '', whats: '', msg: '' });
  const [lgpd, setLgpd] = useState(false);
  const [erros, setErros] = useState({});
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(null);
  const principal = useRef(null);
  const primeiraVez = useRef(true);

  /* Quem chega por outro link com a página já aberta (a rota muda, o
     componente fica) também tem o assunto trocado. Ajustado durante o render,
     e não num efeito, para não pintar uma vez com o assunto antigo. */
  const [rotaVista, setRotaVista] = useState(rota);
  if (rota !== rotaVista) {
    setRotaVista(rota);
    const t = tipoDaRota(rota);
    if (t) setIntent(t);
  }

  useEffect(() => {
    document.title = 'Falar com a equipe · Raízes do Futuro';
    const html = document.documentElement;
    const antes = html.style.background;
    html.style.background = '#04100d';
    return () => {
      html.style.background = antes;
    };
  }, []);

  /* A cada passo, a página volta para o começo do formulário e o foco vai
     para o título do passo, para o leitor de tela anunciar onde está. */
  useEffect(() => {
    if (primeiraVez.current) {
      primeiraVez.current = false;
      return;
    }
    const topo = innerWidth <= 980 && principal.current ? principal.current.offsetTop - 84 : 0; // desconta a navegação fixa
    const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: topo, behavior: reduzir ? 'auto' : 'smooth' });
    principal.current?.querySelector('.step.on [data-foco]')?.focus({ preventScroll: true });
  }, [passo]);

  const mudar = (id, v) => setData((d) => ({ ...d, [id]: v }));
  const mudarPessoa = (id) => (e) => setPessoa((p) => ({ ...p, [id]: e.target.value }));
  const F = intent ? FORMS[intent] : null;

  const resumo = F
    ? [
        ['Assunto', ROTULO[intent]],
        ...F.f.filter((x) => data[x.id]).map((x) => [x.l, x.type === 'date' ? formatarData(data[x.id]) : data[x.id]]),
      ]
    : [];

  async function enviar(e) {
    e.preventDefault();
    const novos = {};
    if (pessoa.nome.trim().length <= 1) novos.nome = 'Diga como podemos te chamar.';
    if (!EMAIL_OK.test(pessoa.email)) novos.email = 'Confira o e-mail.';
    setErros(novos);
    setAviso(lgpd ? '' : 'Marque a autorização de uso dos dados para enviar.');
    if (Object.keys(novos).length) {
      document.getElementById(`ct-${Object.keys(novos)[0]}`)?.focus();
      return;
    }
    if (!lgpd) {
      document.getElementById('ct-lgpd')?.focus();
      return;
    }

    /* Só as respostas do assunto escolhido: quem trocou de assunto no meio do
       caminho não manda as respostas do assunto anterior junto. */
    const respostas = Object.fromEntries(F.f.filter((x) => data[x.id]).map((x) => [x.id, data[x.id]]));
    const payload = {
      assunto: ROTULO[intent],
      ...respostas,
      nome: pessoa.nome.trim(),
      organizacao: pessoa.org,
      email: pessoa.email,
      whatsapp: pessoa.whats,
      mensagem: pessoa.msg,
      enviado_em: new Date().toISOString(),
    };

    setEnviando(true);
    try {
      if (CONTATO.formEndpoint) {
        const r = await fetch(CONTATO.formEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error(String(r.status));
      } else if (CONTATO.email) {
        const corpo = Object.entries(payload)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
        const assunto = `[Site] ${ROTULO[intent]} · ${payload.nome}`;
        window.location.href = `mailto:${CONTATO.email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
      } else {
        console.info('Protótipo: configure email ou formEndpoint em src/contato/config.js. Dados que seriam enviados:', payload);
      }
      setFeito({ primeiro: payload.nome.split(' ')[0], email: payload.email });
      setPasso(4);
    } catch {
      setAviso('Não conseguimos enviar agora. Tente de novo em alguns minutos.');
    } finally {
      setEnviando(false);
    }
  }

  const canais = [
    CONTATO.whatsapp && ['wa', 'WhatsApp', telefone(CONTATO.whatsapp), `https://wa.me/${CONTATO.whatsapp}`],
    CONTATO.email && ['mail', 'E-mail', CONTATO.email, `mailto:${CONTATO.email}`],
    CONTATO.instagram && ['ig', 'Instagram', '@' + CONTATO.instagram, `https://instagram.com/${CONTATO.instagram}`],
  ].filter(Boolean);

  return (
    <div className="rf-site ct">
      <nav className="nav" aria-label="Principal">
        <a className="logo" href={URL_SITE}>
          <Foto imagem={logoRaizes} alt="" sizes="32px" prioridade />
          Raízes do Futuro
        </a>
        <a className="back" href={URL_SITE}>
          ‹ <span>Voltar ao site</span>
        </a>
      </nav>

      <div className="layout">
        <aside className="side">
          <div className="bg">
            <Foto imagem={pilaresComunidade} sizes="(max-width: 980px) 100vw, 48vw" prioridade />
          </div>
          <div className="eyebrow">Falar com a equipe</div>
          <h1>
            Vamos construir isso <em>juntos.</em>
          </h1>
          <p className="lead">
            Seja para investir, comprar o Relatório de Circularidade, levar o modelo para outra comunidade ou contar
            essa história: quem responde é quem faz o ciclo acontecer em Boipeba.
          </p>
          <div className="promise">
            <div>
              <b>2 dias</b>
              <span>úteis para a primeira resposta</span>
            </div>
            <div>
              <b>1 pessoa</b>
              <span>da equipe acompanha seu contato do início ao fim</span>
            </div>
            <div>
              <b>0 spam</b>
              <span>seus dados só servem para responder você</span>
            </div>
          </div>
          <div className="cap">Encontro comunitário · Boipeba</div>
        </aside>

        <main className="main" ref={principal}>
          <div className="main-in">
            <form onSubmit={enviar} noValidate>
              {/* passo 1 */}
              <section className={`step${passo === 1 ? ' on' : ''}`} hidden={passo !== 1} aria-labelledby="ct-s1">
                <div className="step-h">
                  <h2 id="ct-s1" tabIndex={-1} data-foco>
                    Sobre o que você quer falar?
                  </h2>
                  <Pontos n={1} />
                </div>
                <p className="sub">Escolha o assunto e o formulário se ajusta ao que a equipe precisa saber.</p>
                <Assuntos intent={intent} escolher={setIntent} />
                <div className="actions">
                  <button type="button" className="btn btn-p" disabled={!intent} onClick={() => setPasso(2)}>
                    Continuar
                    <Seta />
                  </button>
                </div>
              </section>

              {/* passo 2 */}
              <section className={`step${passo === 2 ? ' on' : ''}`} hidden={passo !== 2} aria-labelledby="ct-s2">
                <div className="step-h">
                  <h2 id="ct-s2" tabIndex={-1} data-foco>
                    {F ? F.t : 'Conte um pouco mais'}
                  </h2>
                  <Pontos n={2} />
                </div>
                <p className="sub">
                  {F ? F.s : 'Essas respostas ajudam a pessoa certa a responder você já com o que importa.'}
                </p>
                {F && (
                  <div className="fields">
                    {F.f.map((x) => (
                      <Pergunta key={x.id} x={x} valor={data[x.id]} mudar={mudar} cheio={F.f.length === 1} />
                    ))}
                  </div>
                )}
                <div className="actions">
                  <button type="button" className="btn btn-g" onClick={() => setPasso(1)}>
                    ‹ Voltar
                  </button>
                  <button type="button" className="btn btn-p" onClick={() => setPasso(3)}>
                    Continuar
                    <Seta />
                  </button>
                </div>
              </section>

              {/* passo 3 */}
              <section className={`step${passo === 3 ? ' on' : ''}`} hidden={passo !== 3} aria-labelledby="ct-s3">
                <div className="step-h">
                  <h2 id="ct-s3" tabIndex={-1} data-foco>
                    Como falamos com você?
                  </h2>
                  <Pontos n={3} />
                </div>
                <p className="sub">Revise e envie. Você recebe a confirmação no e-mail.</p>
                <div className="fields">
                  <Campo id="nome" rotulo="Nome" erro={erros.nome}>
                    <input
                      id="ct-nome"
                      autoComplete="name"
                      required
                      value={pessoa.nome}
                      onChange={mudarPessoa('nome')}
                      aria-invalid={!!erros.nome}
                      aria-describedby={erros.nome ? 'ct-nome-err' : undefined}
                    />
                  </Campo>
                  <Campo id="org" rotulo="Organização" opcional>
                    <input id="ct-org" autoComplete="organization" value={pessoa.org} onChange={mudarPessoa('org')} />
                  </Campo>
                  <Campo id="email" rotulo="E-mail" erro={erros.email}>
                    <input
                      id="ct-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={pessoa.email}
                      onChange={mudarPessoa('email')}
                      aria-invalid={!!erros.email}
                      aria-describedby={erros.email ? 'ct-email-err' : undefined}
                    />
                  </Campo>
                  <Campo id="whats" rotulo="WhatsApp" opcional>
                    <input
                      id="ct-whats"
                      type="tel"
                      autoComplete="tel"
                      placeholder="(71) 9 0000-0000"
                      value={pessoa.whats}
                      onChange={mudarPessoa('whats')}
                    />
                  </Campo>
                  <Campo id="msg" rotulo="Mensagem" opcional>
                    <textarea
                      id="ct-msg"
                      placeholder="Algo mais que a equipe deva saber?"
                      value={pessoa.msg}
                      onChange={mudarPessoa('msg')}
                    />
                  </Campo>
                </div>
                <div className="summary">
                  {resumo.map(([k, v]) => (
                    <div className="r" key={k}>
                      <span>{k}</span>
                      <b>{v}</b>
                    </div>
                  ))}
                  <div className="r">
                    <span />
                    <b>
                      <button type="button" className="edit" onClick={() => setPasso(2)}>
                        Editar respostas
                      </button>
                    </b>
                  </div>
                </div>
                <label className="consent">
                  <input type="checkbox" id="ct-lgpd" checked={lgpd} onChange={(e) => setLgpd(e.target.checked)} />
                  <span>
                    Concordo que a equipe do Raízes do Futuro use esses dados só para responder este contato, conforme a
                    Lei Geral de Proteção de Dados.
                  </span>
                </label>
                <div className={`hint${aviso ? ' on' : ''}`} role="alert">
                  {aviso}
                </div>
                <div className="actions">
                  <button type="button" className="btn btn-g" onClick={() => setPasso(2)}>
                    ‹ Voltar
                  </button>
                  <button type="submit" className="btn btn-p" disabled={enviando}>
                    {enviando ? 'Enviando' : 'Enviar mensagem'}
                    <Seta />
                  </button>
                </div>
              </section>

              {/* confirmação */}
              <section className={`step${passo === 4 ? ' on' : ''}`} hidden={passo !== 4} aria-labelledby="ct-s4">
                <div className="done">
                  <div className="ok" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M5 12.5l4.5 4.5L19 7" />
                    </svg>
                  </div>
                  <h2 id="ct-s4" tabIndex={-1} data-foco>
                    {feito ? `Recebemos, ${feito.primeiro}!` : 'Recebemos, obrigada!'}
                  </h2>
                  <p>
                    {feito
                      ? `A equipe responde em até 2 dias úteis no ${feito.email}. ${PROXIMO[intent]}`
                      : 'A equipe responde em até 2 dias úteis no e-mail informado.'}
                  </p>
                  <div className="actions" style={{ justifyContent: 'center' }}>
                    <a className="btn btn-g" href={URL_SITE}>
                      Voltar ao site
                    </a>
                    <a className="btn btn-p" href={URL_EXPLORAR}>
                      Explorar a ilha enquanto isso
                    </a>
                  </div>
                </div>
              </section>
            </form>

            <div className="after">
              <div className="eyebrow">O que acontece depois</div>
              <ol className="tl">
                <li>
                  <i aria-hidden="true">01</i>
                  <p>
                    <b>Uma pessoa lê sua mensagem</b>
                    <span>Nada de resposta automática genérica. O contato vai direto para quem cuida do assunto.</span>
                  </p>
                </li>
                <li>
                  <i aria-hidden="true">02</i>
                  <p>
                    <b>Resposta em até 2 dias úteis</b>
                    <span>{intent ? PROXIMO[intent] : PROXIMO_PADRAO}</span>
                  </p>
                </li>
                <li>
                  <i aria-hidden="true">03</i>
                  <p>
                    <b>Conversa com a equipe</b>
                    <span>Por vídeo ou, se você vier à ilha, em Boipeba, com visita à coleta e à feira.</span>
                  </p>
                </li>
              </ol>

              {canais.length > 0 && (
                <>
                  <div className="eyebrow" style={{ marginTop: 36 }}>
                    Prefere falar direto?
                  </div>
                  <div className="channels">
                    {canais.map(([k, t, s, href]) => (
                      <a className="ch" key={k} href={href} target="_blank" rel="noopener noreferrer">
                        <span className="ic">
                          <Icone k={k} />
                        </span>
                        <span>
                          <b>{t}</b>
                          <small>{s}</small>
                        </span>
                      </a>
                    ))}
                  </div>
                </>
              )}

              {CONTATO.kitUrl && (
                <div className="kit">
                  <div>
                    <b>Material para investidores e imprensa</b>
                    <small>Apresentação, números do piloto e fotos em alta</small>
                  </div>
                  <a className="btn btn-g" href={CONTATO.kitUrl} target="_blank" rel="noopener noreferrer">
                    Baixar o kit
                  </a>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Contato;
