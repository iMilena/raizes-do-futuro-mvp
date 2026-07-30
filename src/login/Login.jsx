import { useState } from 'react';
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { logoRaizes } from '../landing/images';
import './styles/login.css';

export function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [erro, setErro] = useState('');

  const handleEmailChange = (event) => {
    setEmail(event.target.value);
    setEmailError('');
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
    setPasswordError('');
  };

  const toggleShowPassword = () => {
    setShowPassword((current) => !current);
  };

  const goBackToLanding = () => {
    window.location.hash = '#/';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextEmailError = email.trim() ? '' : 'Informe seu e-mail.';
    const nextPasswordError = password.trim() ? '' : 'Informe sua senha.';

    if (nextEmailError || nextPasswordError) {
      setEmailError(nextEmailError);
      setPasswordError(nextPasswordError);
      return;
    }

    setIsLoading(true);
    setErro('');

    if (onLogin) {
      /* `try/finally` sem `catch` deixava a falha subir como rejeição não tratada:
         o botão parava de girar e a pessoa não recebia motivo nenhum. Quem digita
         a senha errada precisa saber que foi a senha — e o auth.js já devolve a
         mensagem certa em português, inclusive o caso de usuário sem papel. */
      try {
        await onLogin({ email, password });
      } catch (e) {
        setErro(e?.message || 'Não foi possível entrar. Tente de novo.');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Placeholder até a integração real com a API de autenticação.
      setTimeout(() => setIsLoading(false), 1200);
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

        <h1 className="login-title">Bem-vindo de volta</h1>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="login-field">
            <label htmlFor="login-email" className="login-label">
              E-mail
            </label>
            <div className="login-input-wrapper">
              <Mail size={17} className="login-input-icon" />
              <input
                id="login-email"
                type="email"
                className={`login-input${emailError ? ' login-input--error' : ''}`}
                placeholder="seu@email.com"
                value={email}
                onChange={handleEmailChange}
                autoComplete="email"
              />
            </div>
            {emailError && <div className="login-error">{emailError}</div>}
          </div>

          <div className="login-field">
            <label htmlFor="login-password" className="login-label">
              Senha
            </label>
            <div className="login-input-wrapper">
              <Lock size={17} className="login-input-icon" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className={`login-input login-input--with-toggle${
                  passwordError ? ' login-input--error' : ''
                }`}
                placeholder="••••••••"
                value={password}
                onChange={handlePasswordChange}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-toggle-visibility"
                onClick={toggleShowPassword}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {passwordError && <div className="login-error">{passwordError}</div>}
          </div>

          {erro && <p className="login-erro" role="alert">{erro}</p>}

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>

          <div className="login-forgot-wrapper">
            <a href="#" className="login-forgot">
              Esqueci minha senha
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;