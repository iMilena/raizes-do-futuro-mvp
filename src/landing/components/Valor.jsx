import { Revelar } from './Revelar';
import { Divisao } from './Divisao';
import { Cofre } from './Cofre';
import { Simulador } from './Simulador';
import { divisao } from '../data/content';

/**
 * O que o contrato faz com o dinheiro: a divisão, o cofre e a aritmética.
 *
 * As três peças moram na mesma seção porque contam um argumento só, em três
 * tempos — a receita é repartida por código, a parte da infância só sai com
 * duas assinaturas, e qualquer pessoa pode conferir a conta.
 */
export function Valor() {
  return (
    <section
      className="rf-ato rf-noite"
      id="valor"
      style={{ '--rf-de': '#123626', '--rf-ate': '#1B3A26' }}
    >
      <div className="rf-wrap">
        <Revelar como="span" className="rf-eyebrow">
          {divisao.eyebrow}
        </Revelar>
        <Revelar como="h2" className="rf-h-sec" atraso={80} style={{ maxWidth: '19ch' }}>
          {divisao.titulo}
        </Revelar>
        <Revelar como="p" className="rf-lede" atraso={160}>
          {divisao.lede}
        </Revelar>

        <Divisao />
        <Cofre />
        <Simulador />
      </div>
    </section>
  );
}

export default Valor;
