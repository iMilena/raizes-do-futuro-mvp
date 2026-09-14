import { Foto } from './Foto';
import { faixaDeLuz } from '../data/content';
import { rendaDireta } from '../images';

/**
 * A virada de luz.
 *
 * É aqui que a rampa sai do verde noturno e chega na areia clara, e a emenda
 * acontece dentro da foto e não entre duas seções: o gradiente por cima começa
 * no mesmo tom que a seção anterior termina e acaba no mesmo tom que a
 * seguinte começa. Trocar esta foto exige revisar esses dois extremos no CSS.
 */
export function FaixaDeLuz() {
  return (
    <figure className="rf-faixa">
      <Foto imagem={rendaDireta} sizes="100vw" alt={faixaDeLuz.legenda} />
      <figcaption>{faixaDeLuz.legenda}</figcaption>
    </figure>
  );
}

export default FaixaDeLuz;
