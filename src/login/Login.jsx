import { useEffect, useRef, useState } from 'react';
import { Marca } from '../landing/components/Marca';
import { Foto } from '../landing/components/Foto';
import { Chevron, SetaDireita, SetaEsquerda } from '../landing/icons/Icons';
import { coletaValidacao } from '../landing/images';
import { useAviso } from '../landing/hooks/useAviso';
import { abrirEmail, copiarMensagem, montarCorpo } from '../lib/mensagem';
import { EMAIL_CONTATO, URL_PAINEL, URL_SITE, ehRotaInterna } from '../config';
import './styles/login.css';

const PAPEIS = [
  'Instituto Vivá, equipe de território',
  'DeTrash, validação da coleta',
  'Representante comunitário',
  'Catador ou família participante',
  'Investidor ou financiador',
  'Empresa ou operador de turismo',
  'Imprensa ou pesquisa',
  'Outro',
];

const VAZIO = { nome: '', email: '', organizacao: '', papel: PAPEIS[0], acompanhar: '' };

/* ---------------------------------------------------------------------------
   A porta do painel.

   Sem campo de senha, de propósito, e a página diz isso em letras miúdas.
   Formulário de login em página estática não autentica coisa nenhuma: pedir
   credencial aqui criaria uma tranca que qualquer pessoa abre, e uma tranca de
   mentira é pior do que porta aberta — ainda mais num projeto cujo argumento é
   confiança verificável.

   A autenticação de verdade não sumiu: ela vive dentro do painel, no componente
   `Perfil` (`src/App.jsx`), que chama `auth.entrar` e é onde a sessão de fato
   libera escrita na nuvem em nome de uma organização. Aqui a pessoa entra na
   demonstração, ou se identifica e pede a credencial da operação.

   Um segundo botão "ver a demonstração" apontando para o mesmo `#/painel` foi
   deixado de fora: neste repositório os dois caminhos são o mesmo lugar, e dois
   botões idênticos prometeriam uma escolha que não existe. O que a demonstração
   é está dito no texto, logo abaixo do botão.
--------------------------------------------------------------------------- */
export function Login({ onLogin }) {
  const [entrando, setEntrando] = useState(false);
  const [pedidoAberto, setPedidoAberto] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [aviso, avisar] = useAviso();

  const refPainel = useRef(null);
  const refInterno = useRef(null);
  const refPrimeiroCampo = useRef(null);
  const [altura, setAltura] = useState(0);

  /* A altura do painel sanfonado é medida, e não estimada: o formulário reflui
     com a largura da tela e uma altura fixa cortaria os últimos campos. */
  useEffect(() => {
    const alvo = refInterno.current;
    if (!alvo) return undefined;
    const medir = () => setAltura(alvo.offsetHeight);
    medir();
    if (!('ResizeObserver' in window)) return undefined;
    const observador = new ResizeObserver(medir);
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    if (!pedidoAberto || window.innerWidth <= 640) return undefined;
    const t = setTimeout(() => refPrimeiroCampo.current?.focus(), 380);
    return () => clearTimeout(t);
  }, [pedidoAberto]);

  const campo = (nome) => (e) => setForm((atual) => ({ ...atual, [nome]: e.target.value }));

  const entrar = async () => {
    setEntrando(true);
    try {
      if (onLogin) await onLogin({});
      else window.location.hash = URL_PAINEL;
    } finally {
      setEntrando(false);
    }
  };

  const compor = () => ({
    assunto: `Acesso ao painel · ${form.papel}`,
    corpo: montarCorpo([
      'Pedido de acesso ao painel do Raízes do Futuro',
      '',
      { rotulo: 'Nome', valor: form.nome },
      { rotulo: 'E-mail', valor: form.email },
      { rotulo: 'Organização', valor: form.organizacao },
      { rotulo: 'Papel no ciclo', valor: form.papel },
      '',
      'O que vai acompanhar:',
      form.acompanhar.trim() || '(não informado)',
    ]),
  });

  const enviar = (e) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.email.trim()) {
      avisar('Preencha pelo menos nome e e-mail.');
      return;
    }
    const { assunto, corpo } = compor();
    abrirEmail(EMAIL_CONTATO, assunto, corpo);
    avisar('Abrindo seu programa de e-mail. Se nada acontecer, use o botão copiar.');
  };

  const copiar = async () => {
    const { assunto, corpo } = compor();
    const ok = await copiarMensagem(EMAIL_CONTATO, assunto, corpo);
    avisar(
      ok
        ? 'Pedido copiado. É só colar no seu e-mail.'
        : 'Não consegui copiar. Selecione o texto do formulário.'
    );
  };

  const siteInterno = ehRotaInterna(URL_SITE);

  return (
    <div className="entrada">
      <div className="entrada-fundo" aria-hidden="true">
        <Foto imagem={coletaValidacao} alt="" sizes="100vw" prioridade />
      </div>
      <div className="entrada-grao" aria-hidden="true" />

      <main className="entrada-portal">
        <Marca tamanho={32} />

        <span className="entrada-eyebrow">Painel do projeto</span>
        <h1 className="entrada-titulo">Entrar no painel</h1>
        <p className="entrada-lede">
          A coleta validada, a divisão automática da receita e o cofre 2-de-3 liberando o bônus das
          famílias, tudo numa tela só.
        </p>

        <div className="entrada-acoes">
          <button type="button" className="entrada-btn" onClick={entrar} disabled={entrando}>
            {entrando ? 'Abrindo…' : 'Entrar no painel'}
            <SetaDireita className="entrada-btn-seta" />
          </button>
        </div>

        <p className="entrada-demo">
          A jornada roda aberta e local: nada do que você fizer aqui sai deste aparelho. O login por
          organização, que sincroniza a operação, acontece dentro do painel.
        </p>

        <div className="entrada-regua">
          <button
            type="button"
            className="entrada-pedir"
            aria-expanded={pedidoAberto}
            aria-controls="entrada-pedido"
            onClick={() => setPedidoAberto((a) => !a)}
          >
            <span>
              Ainda não tenho acesso
              <span className="entrada-pedir-sub">
                Peça a credencial e a equipe libera na organização certa.
              </span>
            </span>
            <Chevron className="entrada-chevron" />
          </button>

          <div
            className={`entrada-painel${pedidoAberto ? ' is-aberto' : ''}`}
            id="entrada-pedido"
            ref={refPainel}
            style={{ height: pedidoAberto ? altura : 0 }}
          >
            <div ref={refInterno}>
              <form onSubmit={enviar} noValidate>
                <div className="entrada-dupla">
                  <label className="entrada-campo">
                    <span>Nome</span>
                    <input
                      ref={refPrimeiroCampo}
                      type="text"
                      autoComplete="name"
                      required
                      value={form.nome}
                      onChange={campo('nome')}
                    />
                  </label>
                  <label className="entrada-campo">
                    <span>E-mail</span>
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      value={form.email}
                      onChange={campo('email')}
                    />
                  </label>
                </div>

                <label className="entrada-campo">
                  <span>Organização</span>
                  <input
                    type="text"
                    autoComplete="organization"
                    placeholder="Instituto Vivá, DeTrash, empresa parceira…"
                    value={form.organizacao}
                    onChange={campo('organizacao')}
                  />
                </label>

                <label className="entrada-campo">
                  <span>Seu papel no ciclo</span>
                  <select value={form.papel} onChange={campo('papel')}>
                    {PAPEIS.map((papel) => (
                      <option key={papel}>{papel}</option>
                    ))}
                  </select>
                </label>

                <label className="entrada-campo">
                  <span>O que você vai acompanhar</span>
                  <textarea
                    placeholder="Em uma linha."
                    value={form.acompanhar}
                    onChange={campo('acompanhar')}
                  />
                </label>

                <div className="entrada-linha-acoes">
                  <button className="entrada-btn" type="submit">
                    Enviar pedido
                  </button>
                  <button className="entrada-btn entrada-btn-fantasma" type="button" onClick={copiar}>
                    Copiar pedido
                  </button>
                </div>

                <div className={`entrada-aviso${aviso ? ' is-visivel' : ''}`} role="status">
                  {aviso}
                </div>
              </form>
            </div>
          </div>
        </div>

        <p className="entrada-miudo">
          <b>Nenhuma senha passa por esta página.</b> Aqui você só entra ou pede acesso: a credencial
          é criada pela equipe, e o login por organização acontece dentro do painel.
        </p>

        <a
          className="entrada-voltar"
          href={URL_SITE}
          target={siteInterno ? undefined : '_blank'}
          rel={siteInterno ? undefined : 'noopener noreferrer'}
        >
          <SetaEsquerda className="entrada-voltar-seta" />
          Voltar para o site do projeto
        </a>
      </main>
    </div>
  );
}

export default Login;
