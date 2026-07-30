import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { logoRaizes } from '../landing/images';
import './styles/login.css';

/* ---------------------------------------------------------------------------
   Entrada do painel.

   Sem campos de e-mail e senha, de propósito: o painel é a demonstração da
   jornada e roda 100% local — `nuvem.ativo()` exige sessão, então sem login nada
   sobe para o banco. Pedir credencial aqui só criaria uma porta que qualquer um
   abre, e porta que parece trancada e não está é pior do que porta nenhuma.

   A autenticação DE VERDADE não desapareceu: ela vive no cabeçalho do painel
   (componente `Perfil`, que chama `auth.entrar`), que é onde ela controla algo —
   é a sessão que permite escrever na nuvem sob as políticas por papel. Quem opera
   entra por lá; quem só quer ver o ciclo entra por aqui.

   Por isso o texto desta tela não diz "bem-vindo de volta" nem promete conferir
   nada: diz o que acontece.
--------------------------------------------------------------------------- */
export function Login({ onLogin }) {
  const [isLoading, setIsLoading] = useState(false);

  const goBackToLanding = () => {
    window.location.hash = '#/';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      if (onLogin) await onLogin({});
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <button
          type="button"
          className="login-back-button"
          onClick={goBackToLanding}
          aria-label="Voltar para a página inicial"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="login-brand">
          <img src={logoRaizes} alt="Raízes do Futuro" className="login-brand-logo" />
          <span className="login-brand-text">Raízes do Futuro</span>
        </div>

        <h1 className="login-title">Painel do projeto</h1>
        <p className="login-sub">
          Acompanhe o ciclo completo: coleta validada, receita dividida por código
          e o cofre 2-de-3 liberando o bônus das famílias.
        </p>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? 'Abrindo…' : 'Entrar no painel'}
          </button>
        </form>

        <p className="login-nota">
          Demonstração aberta — nada sai deste aparelho. O acesso da operação,
          com login por organização, fica dentro do painel.
        </p>
      </div>
    </div>
  );
}

export default Login;
