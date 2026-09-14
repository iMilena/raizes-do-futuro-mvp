import { Marca } from './Marca';
import { SetaDireita } from '../icons/Icons';
import { navItems } from '../data/content';
import { rolarAte } from '../hooks/useCromoDoScroll';
import { URL_ENTRADA_PAINEL, ehRotaInterna } from '../../config';

/**
 * A barra fixa do topo.
 *
 * Faz três coisas conforme a rolagem: mostra o quanto da página já passou
 * (a linha de 2 px), ganha fundo quando sai do topo, e inverte o próprio tema
 * ao entrar na zona clara da página — sem isso, texto claro sobre areia clara
 * some justamente no FAQ, que é onde as pessoas mais param.
 */
export function Topbar({ progresso, fixada, clara, secaoAtiva, aoAbrirContato }) {
  const interna = ehRotaInterna(URL_ENTRADA_PAINEL);
  const classes = ['rf-topbar', fixada && 'is-fixada', clara && 'is-clara']
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div className="rf-progresso" style={{ width: `${progresso * 100}%` }} aria-hidden="true" />

      <header className={classes}>
        <div className="rf-topbar-in">
          <a
            className="rf-topbar-marca"
            href="#topo"
            onClick={(e) => {
              e.preventDefault();
              rolarAte('topo');
            }}
          >
            <Marca />
          </a>

          <nav className="rf-navlinks" aria-label="Seções da página">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={secaoAtiva === item.id ? 'is-ativo' : undefined}
                aria-current={secaoAtiva === item.id ? 'true' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  rolarAte(item.id);
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <button type="button" className="rf-btn" onClick={aoAbrirContato}>
            <span className="rf-rotulo-longo">Falar com a equipe</span>
            <span className="rf-rotulo-curto">Contato</span>
          </button>

          <a
            className="rf-btn rf-btn-painel"
            href={URL_ENTRADA_PAINEL}
            target={interna ? undefined : '_blank'}
            rel={interna ? undefined : 'noopener noreferrer'}
          >
            <span className="rf-rotulo-longo">Entrar no painel</span>
            <span className="rf-rotulo-curto">Painel</span>
            <SetaDireita className="rf-btn-seta" />
          </a>
        </div>
      </header>
    </>
  );
}

export default Topbar;
