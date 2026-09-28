import { useEffect, useState } from 'react';
import { Foto } from '../landing/components/Foto';
import { Revelar } from '../landing/components/Revelar';
import { Eyebrow, Seta, Titulo } from '../landing/components/Pecas';
import { Equipe } from '../landing/components/Equipe';
import { criancaEscola, logoRaizes } from '../landing/images';
import { EMAIL_CONTATO, URL_MATERIAL_INVESTIDORES } from '../config.js';
import { CONTATO } from '../contato/config.js';
import { STATUS, emPiloto } from '../status.js';
import { verificarLoteExemplo, DIA_EXEMPLO, RAIZ_PUBLICADA } from './lote-exemplo';
import {
  nav, hero, ciclo, governanca, tecnologia, empresas, carta, modelo, equipe, fechamento, rodape,
} from './conteudo';
import '../estilos/site.css';
import '../landing/styles/landing.css';
import './investidores.css';

/**
 * A página única em inglês para investidores (#/investors).
 *
 * É o link da submissão à Colosseum: abre direto aqui, sem o mapa, o som e as
 * nuvens da entrada. A experiência imersiva continua a um clique, na capa.
 *
 * Usa a mesma folha da landing (`.lp`) e só acrescenta o que é dela em
 * `investidores.css`, sob `.inv`. Todo o texto vive em `conteudo.js`.
 */
export default function Investidores() {
  useEffect(() => {
    const html = document.documentElement;
    const antes = { bg: html.style.background, sb: html.style.scrollBehavior, lang: html.lang, titulo: document.title };
    html.style.background = '#04100d';
    html.style.scrollBehavior = 'smooth';
    html.lang = 'en';
    document.title = 'Raízes do Futuro · For investors';
    /* Um link direto para uma seção (#/investors/technology) abre nela. */
    const secao = window.location.hash.split('/')[2];
    const alvo = secao && document.getElementById(secao);
    if (alvo) requestAnimationFrame(() => alvo.scrollIntoView({ block: 'start' }));
    return () => {
      html.style.background = antes.bg;
      html.style.scrollBehavior = antes.sb;
      html.lang = antes.lang;
      document.title = antes.titulo;
    };
  }, []);

  return (
    <div className="rf-site lp inv grain" lang="en">
      <a className="pular" href="#inv-conteudo">
        Skip to content
      </a>
      <Topo />
      <main id="inv-conteudo">
        <Capa />
        <Ciclo />
        <Governanca />
        <Tecnologia />
        <Empresas />
        <Carta />
        <Modelo />
        <Equipe idioma="en" id="team" eyebrow={equipe.eyebrow} titulo={equipe.titulo} nota={equipe.base} />
        <Fechamento />
      </main>
      <Rodape />
    </div>
  );
}

/* As âncoras desta página rolam até a seção sem trocar o hash da rota: um
   `href="#technology"` comum trocaria `#/investors` por `#technology`, e o
   roteador levaria o leitor para o site em português. */
function irPara(e, id) {
  const alvo = document.getElementById(id);
  if (!alvo) return;
  e.preventDefault();
  alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  alvo.focus?.({ preventScroll: true });
}

function Ancora({ para, children, ...resto }) {
  return (
    <a href={`#/investors/${para}`} onClick={(e) => irPara(e, para)} {...resto}>
      {children}
    </a>
  );
}

const mailto = (assunto) => `mailto:${EMAIL_CONTATO}?subject=${encodeURIComponent(assunto)}`;

/* ---------------------------------------------------------------- topo -- */
function Topo() {
  const [solida, setSolida] = useState(false);
  useEffect(() => {
    const medir = () => setSolida(window.scrollY > 40);
    medir();
    window.addEventListener('scroll', medir, { passive: true });
    return () => window.removeEventListener('scroll', medir);
  }, []);

  return (
    <nav className={`nav${solida ? ' solid' : ''}`} aria-label="Main">
      <Ancora para="inv-topo" className="logo">
        <Foto imagem={logoRaizes} alt="" sizes="32px" prioridade />
        Raízes do Futuro
      </Ancora>
      <div className="links">
        {nav.itens.map((item) => (
          <Ancora key={item.id} para={item.id}>
            {item.label}
          </Ancora>
        ))}
      </div>
      <a className="app" href={nav.portugues.href} lang="pt-BR">
        {nav.portugues.rotulo}
      </a>
      <Ancora para="loi" className="btn btn-p">
        <span className="hide-s">{nav.cta.rotulo}</span>
        <span className="show-s">{nav.cta.curto}</span>
      </Ancora>
    </nav>
  );
}

/* ---------------------------------------------------------------- capa -- */
function Capa() {
  const piloto = emPiloto();
  const real = STATUS.real ?? {};

  return (
    <header className="hero" id="inv-topo" tabIndex={-1}>
      <div className="wrap capa-grid">
        <div>
          <div className="selos fu">
            <span className="badge">
              <b>{hero.selo.destaque}</b>
              {hero.selo.texto}
            </span>
            <span className={`fase${piloto ? ' ao-vivo' : ''}`}>{piloto ? hero.fase.piloto : hero.fase.implantacao}</span>
          </div>
          <h1 className="fu" style={{ animationDelay: '.1s' }}>
            {hero.titulo} <em>{hero.destaque}</em>
          </h1>
          <p className="sub fu" style={{ animationDelay: '.2s' }}>
            {hero.subtitulo}
          </p>
          <p className="aviso fu" style={{ animationDelay: '.25s' }}>
            {piloto ? hero.aviso.piloto : hero.aviso.implantacao}
          </p>
          <div className="cta fu" style={{ animationDelay: '.3s' }}>
            <Ancora para="loi" className="btn btn-p">
              {hero.loi.rotulo}
              <Seta />
            </Ancora>
            {URL_MATERIAL_INVESTIDORES ? (
              <a className="btn btn-g" href={URL_MATERIAL_INVESTIDORES} download>
                {hero.material}
              </a>
            ) : (
              <a className="btn btn-g" href={mailto('Raízes do Futuro · investment')}>
                {hero.email}
              </a>
            )}
          </div>
          <a className="imersivo fu" style={{ animationDelay: '.35s' }} href={hero.imersivo.href}>
            {hero.imersivo.rotulo} <Seta tamanho={14} />
          </a>
          <div className="nums fu" style={{ animationDelay: '.4s' }}>
            <small className="nums-rot">{hero.rotuloMetas}</small>
            {hero.metas.map((m) => {
              const medido = piloto && m.chave ? real[m.chave] : null;
              return (
                <div key={m.rotulo}>
                  <b>{m.valor}</b>
                  <span>{m.rotulo} · goal</span>
                  {medido != null && (
                    <span className="medido">
                      {medido}
                      {m.unidade ?? ''} {hero.rotuloReal}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="palco fu" style={{ animationDelay: '.15s' }}>
          <div className="arco">
            <Foto imagem={criancaEscola} alt={hero.altFoto} sizes="(max-width: 900px) 90vw, 480px" prioridade />
          </div>
          <div className="cartao">
            <small>{hero.cartao.eyebrow}</small>
            <p>{hero.cartao.texto}</p>
            <ul>
              {hero.cartao.itens.map((t) => (
                <li key={t}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12.5 10 17 19 7" />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
}

/* --------------------------------------------------------------- ciclo -- */
function Ciclo() {
  return (
    <section className="sec" id="cycle" tabIndex={-1}>
      <div className="wrap">
        <Revelar>
          <Eyebrow>{ciclo.eyebrow}</Eyebrow>
        </Revelar>
        <Revelar atraso={100}>
          <Titulo partes={ciclo.titulo} />
        </Revelar>
        <Revelar como="p" className="lead" atraso={200}>
          {ciclo.lede}
        </Revelar>
        <ol className="inv-etapas">
          {ciclo.etapas.map((e, i) => (
            <Revelar key={e.n} como="li" atraso={(i % 3) * 100}>
              <small>
                {e.n} · {e.rotulo}
              </small>
              <h3>{e.titulo}</h3>
              <p>{e.texto}</p>
            </Revelar>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- governança -- */
function Governanca() {
  return (
    <section className="sec inv-fundo">
      <div className="wrap">
        <Revelar>
          <Eyebrow>{governanca.eyebrow}</Eyebrow>
        </Revelar>
        <Revelar atraso={100}>
          <Titulo partes={governanca.titulo} />
        </Revelar>
        <Revelar como="p" className="lead" atraso={200}>
          {governanca.lede}
        </Revelar>
        <div className="signers inv-tres">
          {governanca.itens.map((s, i) => (
            <Revelar key={s.nome} className="signer" atraso={i * 100}>
              <div className="n" aria-hidden="true">
                {s.n}
              </div>
              <div>
                <small>{s.etiqueta}</small>
                <h3>{s.nome}</h3>
                <p>{s.texto}</p>
              </div>
            </Revelar>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- tecnologia -- */
function Tecnologia() {
  const { cofre, repositorio, detectores } = tecnologia;
  return (
    <section className="sec" id="technology" tabIndex={-1}>
      <div className="wrap">
        <Revelar>
          <Eyebrow>{tecnologia.eyebrow}</Eyebrow>
        </Revelar>
        <Revelar atraso={100}>
          <Titulo partes={tecnologia.titulo} />
        </Revelar>
        <Revelar como="p" className="lead" atraso={200}>
          {tecnologia.lede}
        </Revelar>

        <div className="inv-tec">
          <Revelar className="inv-card">
            <h3>{cofre.titulo}</h3>
            <p>{cofre.texto}</p>
            <code className="inv-hash">{cofre.endereco}</code>
            <a className="btn btn-p inv-btn" href={cofre.href} target="_blank" rel="noopener noreferrer">
              {cofre.botao}
              <Seta />
            </a>
            <ul className="inv-extras">
              {cofre.extras.map((x) => (
                <li key={x.rotulo}>
                  <a href={x.href} target="_blank" rel="noopener noreferrer">
                    {x.rotulo} <Seta tamanho={12} />
                  </a>
                  <span>{x.detalhe}</span>
                </li>
              ))}
            </ul>
            <p className="inv-nota">{tecnologia.porQueSolana}</p>
          </Revelar>

          <Revelar className="inv-card" atraso={100}>
            <h3>{repositorio.titulo}</h3>
            <p>{repositorio.texto}</p>
            <a className="btn btn-g inv-btn" href={repositorio.href} target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="gh">
                <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5z" />
              </svg>
              {repositorio.rotulo}
            </a>
            <ul className="inv-caminhos">
              {repositorio.caminhos.map((c) => (
                <li key={c.rotulo}>
                  <a href={c.href} target="_blank" rel="noopener noreferrer">
                    {c.rotulo} <Seta tamanho={12} />
                  </a>
                </li>
              ))}
            </ul>
          </Revelar>
        </div>

        <LoteExemplo />

        <Revelar className="inv-detectores">
          <h3>{detectores.titulo}</h3>
          <ol>
            {detectores.itens.map((d, i) => (
              <li key={d.nome}>
                <b>
                  <span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span> {d.nome}
                </b>
                <p>{d.texto}</p>
              </li>
            ))}
          </ol>
          <p className="inv-nota">{detectores.nota}</p>
        </Revelar>
      </div>
    </section>
  );
}

const MATERIAL_EN = { PET: 'PET', aluminio: 'Aluminum', vidro: 'Glass', papelao: 'Cardboard', outros: 'Other' };
const SINAL_EN = {
  foto_reaproveitada: 'reused photo',
  pilha_recontada: 'recounted pile',
  sequencia_improvavel: 'implausible sequence',
  peso_incoerente: 'weight vs. photo',
  confianca_baixa: 'low model confidence',
  fora_do_territorio: 'outside the island',
};
const curto = (h) => `${h.slice(0, 10)}…${h.slice(-6)}`;

/**
 * O lote de exemplo: a raiz publicada, e o botão que reconstrói a árvore no
 * navegador de quem lê. A conta roda só no clique: é keccak de verdade, e a
 * página não precisa pagar por ela antes de alguém pedir.
 */
function LoteExemplo() {
  const t = tecnologia.lote;
  const [resultado, setResultado] = useState(null);
  const [calculando, setCalculando] = useState(false);

  const verificar = () => {
    setCalculando(true);
    /* Um quadro de folga para o "Recomputing…" aparecer antes da conta. */
    requestAnimationFrame(() => {
      setResultado(verificarLoteExemplo());
      setCalculando(false);
    });
  };

  const lote = resultado?.lote;
  return (
    <Revelar className="inv-lote">
      <div className="inv-lote-topo">
        <div>
          <h3>{t.titulo}</h3>
          <p>{t.texto}</p>
          <p className="inv-aviso">{t.aviso}</p>
        </div>
        <dl className="inv-lote-dados">
          <div>
            <dt>{t.rotuloData}</dt>
            <dd>{DIA_EXEMPLO}</dd>
          </div>
          <div className="largo">
            <dt>{t.rotuloRaiz}</dt>
            <dd>
              <code className="inv-hash">{RAIZ_PUBLICADA}</code>
            </dd>
          </div>
        </dl>
      </div>

      <div className="inv-lote-acao">
        <button type="button" className="btn btn-p" onClick={verificar} disabled={calculando}>
          {calculando ? t.recalculando : t.botao}
        </button>
        <a href={t.codigo.href} target="_blank" rel="noopener noreferrer">
          {t.codigo.rotulo} <Seta tamanho={12} />
        </a>
      </div>

      <div aria-live="polite">
        {resultado && (
          <div className={`inv-veredito${resultado.raizConfere && resultado.provaConfere ? ' ok' : ' falha'}`}>
            <p>
              <b aria-hidden="true">{resultado.raizConfere ? '✓' : '✗'}</b> {resultado.raizConfere ? t.confere : t.naoConfere}
            </p>
            {resultado.provaConfere && resultado.prova && <p>{t.prova(resultado.prova.prova.length)}</p>}
            <p className="inv-recalculada">
              <code className="inv-hash">{lote.arvore.raiz}</code>
            </p>
          </div>
        )}
      </div>

      {lote && (
        <>
          <dl className="inv-lote-totais">
            <div>
              <dt>{t.rotuloColetas}</dt>
              <dd>{lote.payload.quantidadeRegistros}</dd>
            </div>
            <div>
              <dt>{t.rotuloPeso}</dt>
              <dd>{lote.payload.pesoTotalKg} kg</dd>
            </div>
            <div>
              <dt>{t.rotuloSinalizadas}</dt>
              <dd>{lote.payload.quantidadeSinalizados}</dd>
            </div>
          </dl>
          <div className="inv-tabela">
            <table>
              <thead>
                <tr>
                  {t.colunas.map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lote.registros.map((r, i) => (
                  <tr key={r.conteudo.id}>
                    <td>{i + 1}</td>
                    <td>{MATERIAL_EN[r.conteudo.classificacao.classeFinal] ?? r.conteudo.classificacao.classeFinal}</td>
                    <td>{r.conteudo.pesoKg}</td>
                    <td>
                      <code title={r.hashConteudo}>{curto(r.hashConteudo)}</code>
                    </td>
                    <td>{r.sinalizacoes.map((s) => SINAL_EN[s.codigo] ?? s.codigo).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Revelar>
  );
}

/* ------------------------------------------------------------ empresas -- */
function Empresas() {
  const { quem, recebe, passos, preco } = empresas;
  return (
    <section className="sec inv-fundo" id="companies" tabIndex={-1}>
      <div className="wrap">
        <Revelar>
          <Eyebrow>{empresas.eyebrow}</Eyebrow>
        </Revelar>
        <Revelar atraso={100}>
          <Titulo partes={empresas.titulo} />
        </Revelar>
        <Revelar como="p" className="lead" atraso={200}>
          {empresas.lede}
        </Revelar>

        <div className="inv-tec">
          <Revelar className="inv-card">
            <h3>{quem.titulo}</h3>
            <p>{quem.texto}</p>
            <ul className="inv-marcas">
              {quem.compradores.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Revelar>
          <Revelar className="inv-card" atraso={100}>
            <h3>{recebe.titulo}</h3>
            <ul className="inv-marcas">
              {recebe.itens.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <div className="inv-preco">
              <b>{preco.valor}</b>
              <span>
                {preco.unidade}
                <small>{preco.nota}</small>
              </span>
            </div>
          </Revelar>
        </div>

        <h3 className="inv-sub">{passos.titulo}</h3>
        <ol className="inv-passos">
          {passos.itens.map((p, i) => (
            <Revelar key={p.n} como="li" atraso={i * 80}>
              <small>{p.n}</small>
              <h4>{p.titulo}</h4>
              <p>{p.texto}</p>
            </Revelar>
          ))}
        </ol>
        <p className="inv-nota inv-tracao">{empresas.tracao}</p>
        <Ancora para="loi" className="btn btn-p">
          {carta.botao}
          <Seta />
        </Ancora>
      </div>
    </section>
  );
}

/* --------------------------------------------------- carta de intenção -- */
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function Carta() {
  const [dados, setDados] = useState({ empresa: '', nome: '', cargo: '', email: '', toneladas: '', periodo: '', nota: '' });
  const [aceites, setAceites] = useState({ autorizacao: false, dados: false });
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(null);

  const mudar = (campo) => (e) => setDados((d) => ({ ...d, [campo]: e.target.value }));
  const letra = carta.texto(dados);

  /* Mesmo caminho de envio da página de contato (src/contato/config.js):
     `formEndpoint` quando houver, senão o programa de e-mail com a carta pronta. */
  async function assinar(e) {
    e.preventDefault();
    const novos = {};
    if (!dados.empresa.trim()) novos.empresa = carta.erros.empresa;
    if (!dados.nome.trim()) novos.nome = carta.erros.nome;
    if (!EMAIL_OK.test(dados.email)) novos.email = carta.erros.email;
    if (!aceites.autorizacao || !aceites.dados) novos.aceite = carta.erros.aceite;
    setErros(novos);
    const primeiro = Object.keys(novos)[0];
    if (primeiro) {
      document.getElementById(`loi-${primeiro}`)?.focus();
      return;
    }

    const payload = {
      assunto: 'Letter of intent · recycling credits',
      ...dados,
      carta: letra,
      assinado_em: new Date().toISOString(),
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
        setFeito({ email: false });
      } else {
        const corpo = `${letra}\n\nEmail: ${dados.email}\n${dados.nota ? `Note: ${dados.nota}\n` : ''}Signed: ${payload.assinado_em}`;
        const assunto = `[LOI] ${dados.empresa} · ${dados.toneladas || 'volume TBD'}`;
        window.location.href = `mailto:${CONTATO.email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
        setFeito({ email: true });
      }
    } catch {
      setErros({ envio: carta.erros.envio });
    } finally {
      setEnviando(false);
    }
  }

  const campo = (id, tipo = 'text', auto) => (
    <label className="inv-campo" htmlFor={`loi-${id}`}>
      <span>{carta.campos[id]}</span>
      <input
        id={`loi-${id}`}
        type={tipo}
        autoComplete={auto}
        value={dados[id]}
        onChange={mudar(id)}
        aria-invalid={erros[id] ? true : undefined}
        aria-describedby={erros[id] ? `loi-${id}-erro` : undefined}
      />
      {erros[id] && (
        <small className="inv-erro" id={`loi-${id}-erro`}>
          {erros[id]}
        </small>
      )}
    </label>
  );

  const escolha = (id, opcoes) => (
    <label className="inv-campo" htmlFor={`loi-${id}`}>
      <span>{carta.campos[id]}</span>
      <select id={`loi-${id}`} value={dados[id]} onChange={mudar(id)}>
        <option value="">Choose…</option>
        {opcoes.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="sec" id="loi" tabIndex={-1}>
      <div className="wrap inv-carta">
        <div>
          <Revelar>
            <Eyebrow>{carta.eyebrow}</Eyebrow>
          </Revelar>
          <Revelar atraso={100}>
            <Titulo partes={carta.titulo} />
          </Revelar>
          <Revelar como="p" className="lead" atraso={200}>
            {carta.lede}
          </Revelar>
          <Revelar className="inv-papel" atraso={250} aria-label="Letter preview">
            {letra}
          </Revelar>
        </div>

        {feito ? (
          <div className="inv-form inv-feito" role="status">
            <b aria-hidden="true">✓</b>
            <p>{feito.email ? carta.feitoEmail : carta.feito(dados.nome.trim().split(' ')[0])}</p>
          </div>
        ) : (
          <form className="inv-form" onSubmit={assinar} noValidate>
            <div className="inv-par">
              {campo('empresa', 'text', 'organization')}
              {campo('email', 'email', 'email')}
            </div>
            <div className="inv-par">
              {campo('nome', 'text', 'name')}
              {campo('cargo', 'text', 'organization-title')}
            </div>
            <div className="inv-par">
              {escolha('toneladas', carta.opcoesToneladas)}
              {escolha('periodo', carta.opcoesPeriodo)}
            </div>
            <label className="inv-campo" htmlFor="loi-nota">
              <span>{carta.campos.nota}</span>
              <textarea id="loi-nota" rows={3} value={dados.nota} onChange={mudar('nota')} />
            </label>
            <label className="inv-check">
              <input
                id="loi-aceite"
                type="checkbox"
                checked={aceites.autorizacao}
                onChange={(e) => setAceites((a) => ({ ...a, autorizacao: e.target.checked }))}
              />
              <span>{carta.autorizacao}</span>
            </label>
            <label className="inv-check">
              <input
                type="checkbox"
                checked={aceites.dados}
                onChange={(e) => setAceites((a) => ({ ...a, dados: e.target.checked }))}
              />
              <span>{carta.dados}</span>
            </label>
            {(erros.aceite || erros.envio) && (
              <p className="inv-erro" role="alert">
                {erros.aceite || erros.envio}
              </p>
            )}
            <button type="submit" className="btn btn-p" disabled={enviando}>
              {enviando ? carta.enviando : carta.botao}
              <Seta />
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- modelo -- */
function Modelo() {
  return (
    <section className="sec split-sec" id="model" tabIndex={-1}>
      <div className="wrap">
        <Revelar>
          <Eyebrow>{modelo.eyebrow}</Eyebrow>
        </Revelar>
        <Revelar atraso={100}>
          <Titulo partes={modelo.titulo} />
        </Revelar>
        <Revelar como="p" className="lead" atraso={200}>
          {modelo.lede}
        </Revelar>

        <div className="split-big in">
          {modelo.fatias.map((f) => (
            <div key={f.chave} className={f.chave}>
              <b>{f.pct}%</b>
              <span>{f.titulo}</span>
            </div>
          ))}
        </div>
        <div className="split-txt">
          {modelo.fatias.map((f) => (
            <p key={f.chave}>{f.texto}</p>
          ))}
        </div>
        <p className="inv-destaque">{modelo.semTaxa}</p>

        <h3 className="inv-sub">{modelo.fontes.titulo}</h3>
        <div className="inv-fontes">
          {modelo.fontes.itens.map((f) => (
            <div key={f.rotulo}>
              <b>{f.valor}</b>
              <span>{f.rotulo}</span>
              <p>{f.texto}</p>
            </div>
          ))}
        </div>

        <div className="inv-tec">
          <div className="inv-card">
            <h3>{modelo.conta.titulo}</h3>
            <p>{modelo.conta.texto}</p>
          </div>
          <div className="inv-card">
            <h3>{modelo.semente.titulo}</h3>
            <ol className="inv-marcas numerada">
              {modelo.semente.itens.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        </div>

        <h3 className="inv-sub">{modelo.caminho.titulo}</h3>
        <ol className="inv-passos tres">
          {modelo.caminho.itens.map((c) => (
            <li key={c.quando}>
              <small>{c.quando}</small>
              <p>{c.texto}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- fechamento -- */
function Fechamento() {
  return (
    <section className="close">
      <div className="bg" aria-hidden="true" />
      <div className="wrap">
        <Revelar>
          <Eyebrow style={{ justifyContent: 'center' }}>{fechamento.eyebrow}</Eyebrow>
        </Revelar>
        <Revelar como="h2" atraso={100}>
          {fechamento.antes}
          <em>{fechamento.destaque}</em>
          {fechamento.depois}
        </Revelar>
        <Revelar className="cta" atraso={200}>
          <a className="btn btn-p" href={mailto('Raízes do Futuro · investment')}>
            {fechamento.email}
            <Seta />
          </a>
          {URL_MATERIAL_INVESTIDORES && (
            <a className="btn btn-g" href={URL_MATERIAL_INVESTIDORES} download>
              {fechamento.material}
            </a>
          )}
          <Ancora para="loi" className="btn btn-g">
            {fechamento.loi}
          </Ancora>
        </Revelar>
        <p className="inv-email">
          <a href={`mailto:${EMAIL_CONTATO}`}>{EMAIL_CONTATO}</a>
        </p>
      </div>
    </section>
  );
}

function Rodape() {
  return (
    <footer>
      <div className="wrap">
        <ul className="inv-rodape">
          {rodape.links.map((l) => (
            <li key={l.rotulo}>
              <a href={l.href} {...(l.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                {l.rotulo}
              </a>
            </li>
          ))}
        </ul>
        <div className="fbot">
          <span>{rodape.assinatura}</span>
          <span>{rodape.premio}</span>
        </div>
      </div>
    </footer>
  );
}
