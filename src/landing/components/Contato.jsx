import { useId, useState } from 'react';
import { Marca } from './Marca';
import { Fechar } from '../icons/Icons';
import { contato } from '../data/content';
import { useDialogo } from '../hooks/useDialogo';
import { useAviso } from '../hooks/useAviso';
import { abrirEmail, copiarMensagem, montarCorpo } from '../../lib/mensagem';
import { EMAIL_CONTATO } from '../../config';

const VAZIO = { nome: '', organizacao: '', email: '', interesse: contato.interesses[0], mensagem: '' };

/**
 * A página de contato, sobreposta ao site.
 *
 * Sobreposta e não em rota própria porque quem clica em "falar com a equipe"
 * está no meio de um argumento: fechar leva a pessoa de volta exatamente ao
 * parágrafo onde ela estava, sem recarregar nem perder a rolagem.
 *
 * O formulário não envia nada, e a nota embaixo dele diz isso. Ver
 * `src/lib/mensagem.js` para o que fazer quando existir um backend.
 */
export function Contato({ aberto, aoFechar }) {
  const [form, setForm] = useState(VAZIO);
  const [aviso, avisar] = useAviso();
  const refDialogo = useDialogo(aberto, aoFechar);
  const id = useId();

  if (!aberto) return null;

  const campo = (nome) => (e) => setForm((atual) => ({ ...atual, [nome]: e.target.value }));

  const compor = () => ({
    assunto: `Raízes do Futuro · ${form.interesse}`,
    corpo: montarCorpo([
      { rotulo: 'Interesse', valor: form.interesse },
      { rotulo: 'Nome', valor: form.nome },
      { rotulo: 'Organização', valor: form.organizacao },
      { rotulo: 'E-mail', valor: form.email },
      '',
      form.mensagem.trim() || '(sem mensagem)',
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
        ? 'Mensagem copiada. É só colar no seu e-mail.'
        : 'Não consegui copiar. Selecione o texto do formulário.'
    );
  };

  return (
    <div
      className="rf-contato"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-titulo`}
      ref={refDialogo}
      tabIndex={-1}
    >
      <button type="button" className="rf-contato-fechar" onClick={aoFechar} aria-label="Fechar">
        <Fechar width="17" height="17" />
      </button>

      <div className="rf-contato-in rf-noite">
        <div>
          <Marca className="rf-contato-marca" />
          <span className="rf-eyebrow">{contato.eyebrow}</span>
          <h2 id={`${id}-titulo`}>{contato.titulo}</h2>
          <p className="rf-contato-intro">{contato.intro}</p>

          <div className="rf-caminhos">
            {contato.caminhos.map((caminho) => (
              <div className="rf-caminho" key={caminho.titulo}>
                <b>{caminho.titulo}</b>
                <span>{caminho.texto}</span>
              </div>
            ))}
          </div>
        </div>

        <form className="rf-form" onSubmit={enviar} noValidate>
          <div className="rf-form-dupla">
            <label className="rf-campo">
              <span>Nome</span>
              <input type="text" autoComplete="name" required value={form.nome} onChange={campo('nome')} />
            </label>
            <label className="rf-campo">
              <span>Organização</span>
              <input
                type="text"
                autoComplete="organization"
                value={form.organizacao}
                onChange={campo('organizacao')}
              />
            </label>
          </div>

          <label className="rf-campo">
            <span>E-mail</span>
            <input type="email" autoComplete="email" required value={form.email} onChange={campo('email')} />
          </label>

          <label className="rf-campo">
            <span>Como quer entrar</span>
            <select value={form.interesse} onChange={campo('interesse')}>
              {contato.interesses.map((opcao) => (
                <option key={opcao}>{opcao}</option>
              ))}
            </select>
          </label>

          <label className="rf-campo">
            <span>Mensagem</span>
            <textarea
              placeholder="Conte em duas linhas o que você quer construir com a gente."
              value={form.mensagem}
              onChange={campo('mensagem')}
            />
          </label>

          <div className="rf-form-acoes">
            <button className="rf-btn" type="submit">
              Abrir no meu e-mail
            </button>
            <button className="rf-btn rf-btn-fantasma" type="button" onClick={copiar}>
              Copiar mensagem
            </button>
          </div>

          <div className={`rf-aviso${aviso ? ' is-visivel' : ''}`} role="status">
            {aviso}
          </div>

          <p className="rf-form-nota">
            Nada é enviado por esta página: o botão monta a mensagem e abre o seu programa de
            e-mail, ou copia o texto para você colar onde preferir.
          </p>
        </form>
      </div>
    </div>
  );
}

export default Contato;
