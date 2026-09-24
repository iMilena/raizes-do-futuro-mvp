import { Foto } from './Foto';
import { logoRaizes } from '../images';
import { rodape } from '../data/content';

export function Rodape() {
  return (
    <footer>
      <div className="wrap">
        <div className="fgrid">
          <div>
            <a className="logo" href="#inicio">
              <Foto imagem={logoRaizes} alt="" sizes="32px" />
              Raízes do Futuro
            </a>
            <p>{rodape.tagline}</p>
          </div>
          {rodape.colunas.map((col) => (
            <div key={col.titulo}>
              <h2 className="h5">{col.titulo}</h2>
              <ul>
                {col.links.map((l) => (
                  <li key={l.rotulo}>
                    <a href={l.href} {...(l.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                      {l.rotulo}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="fbot">
          <span>{rodape.assinatura}</span>
          <span>{rodape.premio}</span>
        </div>
      </div>
    </footer>
  );
}

export default Rodape;
