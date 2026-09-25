import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Foto } from '../landing/components/Foto';
import { Revelar } from '../landing/components/Revelar';
import { coletaValidacao, logoRaizes } from '../landing/images';
import telaCapa from '../landing/images/webp/app-capa-540.webp';
import telaInicio from '../landing/images/webp/app-inicio-540.webp';
import {
  URL_APP, URL_CONTATO, URL_EXPLORAR, URL_PAINEL, URL_PRIVACIDADE, URL_SITE,
} from '../config.js';
import { agentes, faq, final, instalar, privacidade, recursos, topo } from './conteudo.js';
import '../estilos/site.css';
import './app-familia.css';

/* ---------------------------------------------------------------------------
   "App da família" (#/app): apresenta o Raízes Família às famílias, à equipe e
   a parceiros, e leva ao link de instalação. Segue `modelo-raizes-app.html`.

   O app em si é outro projeto (URL_APP). Esta página só aponta para ele: todo
   link que abre o app sai de URL_APP, em nova aba.
--------------------------------------------------------------------------- */

/* Os ícones do modelo, em traço, herdando a cor do texto. */
const ICONES = {
  check: <path d="M5 12.5 10 17 19 7" />,
  semSinal: <path d="M3 9a13 13 0 0 1 18 0M6.5 12.5a8 8 0 0 1 11 0M10 16a3 3 0 0 1 4 0M3 3l18 18" />,
  som: <path d="M11 5 6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" />,
  baixar: <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14" />,
  sacola: <path d="M6 7h12l-1 13H7zM9 7a3 3 0 0 1 6 0" />,
  filhos: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3 20a5 5 0 0 1 10 0M13.5 20a3.6 3.6 0 0 1 7 0" /></>,
  conversa: <path d="M4 5h16v11H9l-5 4z" />,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  escudo: <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  extrato: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h5" /></>,
  celular: <><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M11 18h2" /></>,
  servidor: <path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />,
  alerta: <path d="M12 3 2 20h20zM12 10v4M12 17h.01" />,
  cadastrar: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0M18 8v6M15 11h6" /></>,
  nota: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>,
  cadeado: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
};
const Icone = ({ k }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {ICONES[k]}
  </svg>
);

/** Título com o fim em itálico menta, como no resto do site. */
const Titulo = ({ partes, como: Tag = 'h2', className = 'h' }) => (
  <Tag className={className}>
    {partes[0]}
    <em>{partes[1]}</em>
  </Tag>
);

/** Todo link que abre o app: mesmo endereço, nova aba, sem `opener`. */
function LinkApp({ className = 'btn btn-p', children, ...resto }) {
  return (
    <a className={className} href={URL_APP} target="_blank" rel="noopener noreferrer" {...resto}>
      {children}
    </a>
  );
}

/** "[[Abrir o app]]" vira a tecla em destaque, o nome do botão a procurar. */
function comTeclas(texto) {
  return texto.split(/(\[\[.+?\]\])/).map((parte, i) =>
    parte.startsWith('[[') ? <kbd key={i}>{parte.slice(2, -2)}</kbd> : parte
  );
}

/** iPhone e iPad (o iPadOS se apresenta como Mac, mas tem tela de toque). */
const ehIphone = () =>
  typeof navigator !== 'undefined' &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/* ------------------------------------------------------------ QR code -- */
/** Gerado aqui mesmo, a partir de URL_APP. Nenhum serviço externo vê o link. */
function CartaoQr() {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let vivo = true;
    QRCode.toDataURL(URL_APP, { width: 320, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#04100d', light: '#ffffff' } })
      .then((url) => vivo && setSrc(url))
      .catch(() => vivo && setSrc(null));
    return () => {
      vivo = false;
    };
  }, []);
  if (!src) return null;
  return (
    <div className="qr">
      <div className="code">
        <img src={src} alt={`QR code que abre ${URL_APP.replace(/^https?:\/\//, '')}`} width="160" height="160" />
      </div>
      <p>
        <b>{topo.qr[0]}</b>
        {topo.qr[1]}
      </p>
    </div>
  );
}

/* ------------------------------------------------------ abas instalar -- */
/**
 * Abas de verdade: só a aba escolhida entra na ordem de tabulação, e as setas
 * trocam de aba, como pede o padrão de abas acessíveis. Quem chega de um iPhone
 * já vê os passos do iPhone.
 */
function Abas() {
  const [ativa, setAtiva] = useState(() => (ehIphone() ? 'iphone' : 'android'));
  const lista = useRef(null);
  const i = instalar.abas.findIndex((a) => a.id === ativa);

  const aoTeclar = (e) => {
    const passo = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    const fim = { Home: 0, End: instalar.abas.length - 1 }[e.key];
    if (passo === undefined && fim === undefined) return;
    e.preventDefault();
    const n = fim ?? (i + passo + instalar.abas.length) % instalar.abas.length;
    setAtiva(instalar.abas[n].id);
    lista.current?.querySelectorAll('[role="tab"]')[n]?.focus();
  };

  return (
    <>
      <div className="tabs" role="tablist" aria-label={instalar.rotuloAbas} ref={lista} onKeyDown={aoTeclar}>
        {instalar.abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            id={`af-aba-${a.id}`}
            aria-selected={ativa === a.id}
            aria-controls={`af-painel-${a.id}`}
            tabIndex={ativa === a.id ? 0 : -1}
            onClick={() => setAtiva(a.id)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      {instalar.abas.map((a) => (
        <div
          key={a.id}
          id={`af-painel-${a.id}`}
          role="tabpanel"
          aria-labelledby={`af-aba-${a.id}`}
          hidden={ativa !== a.id}
          tabIndex={0}
        >
          <ol className="passos">
            {a.passos.map(([t, txt]) => (
              <li key={t}>
                <b>{t}</b>
                <span>{comTeclas(txt)}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </>
  );
}

/* ---------------------------------------------------------------- tela -- */
export function AppFamilia() {
  const [fixo, setFixo] = useState(false);

  useEffect(() => {
    document.title = 'App Raízes Família · Raízes do Futuro';
    const html = document.documentElement;
    const antes = html.style.scrollBehavior;
    html.style.scrollBehavior = 'smooth';
    return () => {
      html.style.scrollBehavior = antes;
    };
  }, []);

  /* O botão fixo do celular aparece depois do topo e some perto do rodapé,
     para não cobrir a chamada final, que já tem o mesmo botão. */
  useEffect(() => {
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      const perto = innerHeight + scrollY >= document.documentElement.scrollHeight - 300;
      setFixo(scrollY > innerHeight * 0.8 && !perto);
    };
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir);
    };
    addEventListener('scroll', aoRolar, { passive: true });
    addEventListener('resize', aoRolar);
    return () => {
      removeEventListener('scroll', aoRolar);
      removeEventListener('resize', aoRolar);
      cancelAnimationFrame(quadro);
    };
  }, []);

  const endereco = URL_APP.replace(/^https?:\/\//, '');

  return (
    <div className="rf-site af">
      <nav className="nav" aria-label="Principal">
        <a className="logo" href={URL_SITE}>
          <Foto imagem={logoRaizes} alt="" sizes="32px" prioridade />
          Raízes do Futuro
        </a>
        <div className="links">
          <a href={URL_EXPLORAR}>Explorar</a>
          <a href={URL_SITE}>Saiba mais</a>
          <a href="#/app" className="on" aria-current="page">
            App da família
          </a>
          <a href={URL_PAINEL}>Painel</a>
        </div>
        <a className="btn btn-g" href={URL_CONTATO}>
          Falar com a equipe
        </a>
        <LinkApp>Abrir o app</LinkApp>
      </nav>

      <main>
        <section className="hero" id="topo">
          <div className="wrap hgrid">
            <div>
              <span className="badge">
                <b>{topo.selo.destaque}</b>
                {topo.selo.texto}
              </span>
              <Titulo partes={topo.titulo} como="h1" className="" />
              <p className="sub">{topo.sub}</p>
              <div className="cta">
                <LinkApp>
                  <Icone k="baixar" />
                  {topo.primario}
                </LinkApp>
                {/* âncora dentro da página: rola até a seção sem mexer na rota */}
                <a
                  className="btn btn-g"
                  href="#/app"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('como-instalar')?.scrollIntoView();
                  }}
                >
                  {topo.secundario}
                </a>
              </div>
              <ul className="chips">
                {topo.chips.map((c) => (
                  <li className="chip" key={c.texto}>
                    <Icone k={c.icone} />
                    {c.texto}
                  </li>
                ))}
              </ul>
              <p className="aviso">
                <Icone k="info" />
                <span>
                  <b>{topo.aviso[0]}</b>
                  {topo.aviso[1]}
                </span>
              </p>
            </div>
            <div className="phones">
              <div className="phone p1" aria-hidden="true">
                <img src={telaCapa} alt="" width="540" height="1169" />
              </div>
              <div className="phone p2" aria-hidden="true">
                <img src={telaInicio} alt="" width="540" height="1169" />
              </div>
              <CartaoQr />
            </div>
          </div>
        </section>

        <section className="sec" id="recursos">
          <div className="wrap">
            <Revelar className="eyebrow">{recursos.eyebrow}</Revelar>
            <Revelar>
              <Titulo partes={recursos.titulo} />
            </Revelar>
            <Revelar como="p" className="lead">
              {recursos.lede}
            </Revelar>
            <div className="feat">
              {recursos.cartoes.map((c, i) => (
                <Revelar key={c.titulo} como="article" className="card" atraso={(i % 3) * 80}>
                  <div className="ic">
                    <Icone k={c.icone} />
                  </div>
                  <h3>{c.titulo}</h3>
                  <p>{c.texto}</p>
                </Revelar>
              ))}
            </div>
          </div>
        </section>

        <section className="sec inst" id="como-instalar">
          <div className="wrap">
            <Revelar className="eyebrow">{instalar.eyebrow}</Revelar>
            <Revelar>
              <Titulo partes={instalar.titulo} />
            </Revelar>
            <Revelar como="p" className="lead">
              {instalar.lede}
            </Revelar>
            <Abas />
            <div className="dl">
              <LinkApp>
                <Icone k="baixar" />
                {instalar.botao}
              </LinkApp>
              <small>
                {instalar.rotuloEndereco} <span className="endereco">{endereco}</span>
              </small>
            </div>
          </div>
        </section>

        <section className="sec" id="privacidade">
          <div className="wrap">
            <Revelar className="eyebrow">{privacidade.eyebrow}</Revelar>
            <Revelar>
              <Titulo partes={privacidade.titulo} />
            </Revelar>
            <Revelar como="p" className="lead">
              {privacidade.lede}
            </Revelar>
            <div className="split">
              <Revelar className="box cel">
                <h3>
                  <Icone k="celular" />
                  {privacidade.celular.titulo}
                </h3>
                <ul>
                  {privacidade.celular.itens.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </Revelar>
              <Revelar className="box srv" atraso={80}>
                <h3>
                  <Icone k="servidor" />
                  {privacidade.projeto.titulo}
                </h3>
                <ul>
                  {privacidade.projeto.itens.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </Revelar>
            </div>
            <Revelar className="golpe" role="note">
              <Icone k="alerta" />
              <p>
                <b>{privacidade.golpe[0]}</b>
                {privacidade.golpe[1]}
              </p>
            </Revelar>
          </div>
        </section>

        <section className="sec agentes" id="agentes">
          <div className="wrap agente">
            <Revelar como="figure" className="foto">
              <Foto imagem={coletaValidacao} sizes="(max-width: 980px) 100vw, 540px" />
              <figcaption>{agentes.legenda}</figcaption>
            </Revelar>
            <div>
              <Revelar className="eyebrow">{agentes.eyebrow}</Revelar>
              <Revelar>
                <Titulo partes={agentes.titulo} />
              </Revelar>
              <ul className="lista">
                {agentes.itens.map((it, i) => (
                  <Revelar key={it.texto} como="li" atraso={i * 60}>
                    <Icone k={it.icone} />
                    {it.texto}
                  </Revelar>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="sec" id="faq">
          <div className="wrap">
            <Revelar className="eyebrow">{faq.eyebrow}</Revelar>
            <Revelar>
              <Titulo partes={faq.titulo} />
            </Revelar>
            <Revelar className="faq">
              {faq.itens.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </Revelar>
          </div>
        </section>

        <section className="sec final" id="instalar">
          <div className="wrap">
            <Revelar className="eyebrow centro">{final.eyebrow}</Revelar>
            <Revelar>
              <Titulo partes={final.titulo} />
            </Revelar>
            <Revelar como="p" className="lead">
              {final.lede}
            </Revelar>
            <Revelar className="dl">
              <LinkApp>
                <Icone k="baixar" />
                {final.primario}
              </LinkApp>
              <a className="btn btn-g" href={URL_CONTATO}>
                {final.secundario}
              </a>
            </Revelar>
          </div>
        </section>
      </main>

      <div className={`fixo${fixo ? ' on' : ''}`} aria-hidden={!fixo}>
        <LinkApp tabIndex={fixo ? 0 : -1}>
          <Icone k="baixar" />
          {final.fixo}
        </LinkApp>
      </div>

      <footer>
        <div className="wrap">
          <div className="fgrid">
            <div>
              <a className="logo" href={URL_SITE}>
                <Foto imagem={logoRaizes} alt="" sizes="32px" />
                Raízes do Futuro
              </a>
              <p>Do impacto ambiental à proteção da infância. Boipeba, Cairu, Bahia.</p>
            </div>
            <div>
              <h2 className="h5">Navegação</h2>
              <ul>
                <li><a href={URL_EXPLORAR}>Explorar a ilha</a></li>
                <li><a href={URL_SITE}>Saiba mais</a></li>
                <li><a href="#/app" aria-current="page">App da família</a></li>
              </ul>
            </div>
            <div>
              <h2 className="h5">Projeto</h2>
              <ul>
                <li><a href={URL_PAINEL}>Painel do projeto</a></li>
                <li><a href={`${URL_CONTATO}?tipo=investimento`}>Investir</a></li>
              </ul>
            </div>
            <div>
              <h2 className="h5">Outros</h2>
              <ul>
                <li><a href={URL_CONTATO}>Contato</a></li>
                <li><a href={URL_PRIVACIDADE} target="_blank" rel="noopener noreferrer">Política de Privacidade</a></li>
                <li><a href="https://www.unicef.org/brazil/" target="_blank" rel="noopener noreferrer">UNICEF Brasil</a></li>
              </ul>
            </div>
          </div>
          <div className="fbot">
            <span>Raízes do Futuro · Boipeba, Bahia</span>
            <span>Youth Challenge Blockchain · UNICEF Brasil</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default AppFamilia;
