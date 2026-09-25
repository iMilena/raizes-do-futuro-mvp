import { useEffect, useState } from 'react';
import { Foto } from './Foto';
import { logoRaizes } from '../images';
import { nav, navItems } from '../data/content';

/**
 * A navegação fixa.
 *
 * Nasce transparente sobre a foto da capa e ganha fundo de vidro depois dos
 * primeiros 40 px de rolagem. O link da seção em que o leitor está fica aceso:
 * a seção "atual" é a última cujo topo já passou de 40% da altura da tela.
 * Abaixo de 1060 px os links viram um menu de tela cheia.
 */
export function Nav() {
  const [solida, setSolida] = useState(false);
  const [atual, setAtual] = useState('inicio');
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      setSolida(window.scrollY > 40);
      /* A ordem do menu não é a da página ("Fundo Infância" fica dentro de
         Impacto, antes de Parceiros), então vale a seção cujo topo passou do
         limite por último, e não a última da lista. */
      let cur = 'inicio';
      let maior = -Infinity;
      for (const { id } of navItems) {
        const el = document.getElementById(id);
        const topo = el ? el.getBoundingClientRect().top : Infinity;
        if (topo < window.innerHeight * 0.4 && topo > maior) {
          maior = topo;
          cur = id;
        }
      }
      setAtual(cur);
    };
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener('scroll', aoRolar, { passive: true });
    window.addEventListener('resize', aoRolar);
    return () => {
      window.removeEventListener('scroll', aoRolar);
      window.removeEventListener('resize', aoRolar);
      cancelAnimationFrame(quadro);
    };
  }, []);

  /* Com o menu aberto, Esc fecha e a página de trás não rola. */
  useEffect(() => {
    if (!menu) return undefined;
    const aoTeclar = (e) => {
      if (e.key === 'Escape') setMenu(false);
    };
    document.addEventListener('keydown', aoTeclar);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = antes;
    };
  }, [menu]);

  const fechar = () => setMenu(false);

  return (
    <>
      <nav className={`nav${solida ? ' solid' : ''}`} aria-label="Principal">
        <a className="logo" href="#inicio">
          <Foto imagem={logoRaizes} alt="" sizes="32px" prioridade />
          Raízes do Futuro
        </a>
        <div className="links">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={atual === item.id ? 'on' : undefined}
              aria-current={atual === item.id ? 'location' : undefined}
            >
              {item.label}
            </a>
          ))}
        </div>
        <a className="app" href={nav.app.href}>
          {nav.app.rotulo}
        </a>
        <a className="btn btn-g" href={nav.painel.href}>
          {nav.painel.rotulo}
        </a>
        <a className="btn btn-p" href={nav.contato.href}>
          <span className="hide-s">{nav.contato.rotulo}</span>
          <span className="show-s">{nav.contato.curto}</span>
        </a>
        <button
          type="button"
          className="burger"
          aria-label={menu ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menu}
          aria-controls="lp-mnav"
          onClick={() => setMenu((m) => !m)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {menu ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 8h16M4 16h16" />}
          </svg>
        </button>
      </nav>

      <div className={`mnav${menu ? ' on' : ''}`} id="lp-mnav" aria-hidden={!menu} inert={menu ? undefined : ''}>
        {navItems.map((item) => (
          <a key={item.id} href={`#${item.id}`} onClick={fechar}>
            {item.label}
          </a>
        ))}
        <a href={nav.app.href} onClick={fechar}>
          {nav.app.rotulo}
        </a>
        <a href={nav.painel.href} onClick={fechar}>
          {nav.painel.rotulo}
        </a>
        <a className="btn btn-p" href={nav.contato.href} onClick={fechar}>
          {nav.contato.rotulo}
        </a>
      </div>
    </>
  );
}

export default Nav;
