import { Marca } from './Marca';
import { rodape } from '../data/content';
import { rolarAte } from '../hooks/useCromoDoScroll';
import { URL_ENTRADA_PAINEL, ehRotaInterna } from '../../config';

/**
 * O rodapé carrega a mesma navegação da barra do topo.
 *
 * Não é redundância: abaixo de 1080 px de largura os links do topo somem por
 * falta de espaço, e é o rodapé que continua oferecendo a página inteira a
 * quem está no celular ou navegando pelo teclado.
 */
function Link({ link, aoAbrirContato }) {
  if (link.contato) {
    return (
      <button type="button" className="rf-rodape-link" onClick={aoAbrirContato}>
        {link.rotulo}
      </button>
    );
  }

  if (link.painel) {
    const interna = ehRotaInterna(URL_ENTRADA_PAINEL);
    return (
      <a
        className="rf-rodape-link"
        href={URL_ENTRADA_PAINEL}
        target={interna ? undefined : '_blank'}
        rel={interna ? undefined : 'noopener noreferrer'}
      >
        {link.rotulo}
      </a>
    );
  }

  return (
    <a
      className="rf-rodape-link"
      href={link.href}
      onClick={(e) => {
        e.preventDefault();
        rolarAte(link.href.slice(1));
      }}
    >
      {link.rotulo}
    </a>
  );
}

export function Footer({ aoAbrirContato }) {
  return (
    <footer className="rf-rodape" id="rodape">
      <div className="rf-wrap">
        <div className="rf-rodape-grade">
          <div className="rf-rodape-marca">
            <a
              href="#topo"
              onClick={(e) => {
                e.preventDefault();
                rolarAte('topo');
              }}
            >
              <Marca tamanho={38} />
            </a>
            <p>{rodape.tagline}</p>
          </div>

          {rodape.colunas.map((coluna) => (
            <div key={coluna.titulo}>
              <h2 className="rf-rodape-h">{coluna.titulo}</h2>
              <ul>
                {coluna.links.map((link) => (
                  <li key={link.rotulo}>
                    <Link link={link} aoAbrirContato={aoAbrirContato} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="rf-rodape-linha">
          <span>{rodape.assinatura}</span>
          <span>{rodape.premio}</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
