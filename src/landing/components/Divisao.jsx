import { useRef } from 'react';
import { useContagem } from '../hooks/useContagem';
import { useVisivel } from '../hooks/useVisivel';
import { divisao } from '../data/content';

function Fatia({ fatia, atraso, contar }) {
  const pct = useContagem(fatia.pct, contar);
  return (
    <div className={`rf-fatia is-${fatia.chave}`} style={{ '--rf-w': fatia.barra, '--rf-d': `${atraso}ms` }}>
      <div className="rf-fatia-pct rf-mono">{pct}%</div>
      <h3>{fatia.titulo}</h3>
      <p>{fatia.texto}</p>
      <div className="rf-fatia-barra" aria-hidden="true" />
    </div>
  );
}

/**
 * A divisão 60/25/15.
 *
 * As tarjas embaixo dos cartões são proporcionais **entre si**, e não à largura
 * do cartão: a de 60% ocupa a linha inteira e as outras duas se medem contra
 * ela. Três tarjas cheias mostrariam uma divisão em partes iguais, que é
 * justamente o contrário do que a seção afirma.
 */
export function Divisao() {
  const ref = useRef(null);
  const visivel = useVisivel(ref, { limiar: 0.32 });

  return (
    <div className={`rf-divisao${visivel ? ' is-in' : ''}`} ref={ref}>
      {divisao.fatias.map((fatia, i) => (
        <Fatia key={fatia.chave} fatia={fatia} atraso={i * 180} contar={visivel} />
      ))}
    </div>
  );
}

export default Divisao;
