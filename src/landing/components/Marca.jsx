import { Foto } from './Foto';
import { logoRaizes } from '../images';

/**
 * A marca do projeto: logo real e nome, lado a lado.
 *
 * Aparece no topo, no rodapé, na página de contato e na porta do painel —
 * sempre com o mesmo espaçamento e o mesmo peso, para o leitor reconhecer o
 * mesmo objeto em cada lugar. Como `sizes` fica travado no tamanho pedido, o
 * navegador baixa a variante de 96 px e não a foto inteira.
 */
export function Marca({ tamanho = 34, className = '', ...resto }) {
  return (
    <span className={`rf-marca${className ? ` ${className}` : ''}`} {...resto}>
      <Foto
        imagem={logoRaizes}
        alt=""
        sizes={`${tamanho}px`}
        className="rf-marca-logo"
        style={{ width: tamanho, height: tamanho }}
      />
      <span className="rf-marca-nome">Raízes do Futuro</span>
    </span>
  );
}

export default Marca;
