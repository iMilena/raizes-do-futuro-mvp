import { useId, useState } from 'react';
import { Revelar } from './Revelar';
import { cofre, coorte, simulador } from '../data/content';

const brl = (v) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

/**
 * Reparte uma receita pelas regras que já estão no contrato.
 *
 * A operação fica com o resto em vez de com o seu próprio arredondamento: assim
 * as três parcelas somam exatamente o que entrou, e a tela nunca mostra um real
 * que apareceu ou sumiu no arredondamento.
 */
function repartir(receita) {
  const renda = Math.round(receita * 0.6);
  const fundo = Math.round(receita * 0.25);
  return { renda, fundo, operacao: receita - renda - fundo };
}

/**
 * O simulador da divisão.
 *
 * Não é projeção de receita e a nota no rodapé diz isso com todas as letras:
 * é a aritmética do contrato, mostrando para onde vai cada real *quando* entra.
 * Confundir os dois transformaria uma peça de transparência em promessa de
 * retorno, que é exatamente o que este projeto não faz.
 */
export function Simulador() {
  const [receita, setReceita] = useState(simulador.inicial);
  const idCampo = useId();

  const partes = repartir(receita);
  const bonus = Math.floor(partes.fundo / cofre.bonus);
  const meses = Math.floor(partes.fundo / (cofre.bonus * coorte.total));
  const pct = ((receita - simulador.min) / (simulador.max - simulador.min)) * 100;

  return (
    <Revelar className="rf-sim" atraso={120}>
      <div className="rf-sim-topo">
        <h3>{simulador.titulo}</h3>
        <div className="rf-sim-valor">
          <span className="rf-sim-lbl">{simulador.rotuloReceita}</span>
          <output htmlFor={idCampo}>{brl(receita)}</output>
        </div>
      </div>

      <div className="rf-slider" style={{ '--rf-pct': `${pct.toFixed(1)}%` }}>
        <label className="rf-so-leitor" htmlFor={idCampo}>
          {simulador.rotuloCampo}
        </label>
        <input
          id={idCampo}
          type="range"
          min={simulador.min}
          max={simulador.max}
          step={simulador.passo}
          value={receita}
          onChange={(e) => setReceita(Number(e.target.value))}
        />
        <div className="rf-slider-marcas" aria-hidden="true">
          {simulador.marcas.map((marca) => (
            <span key={marca}>{brl(marca)}</span>
          ))}
        </div>
      </div>

      <div className="rf-sim-saida">
        {simulador.cartoes.map((cartao) => (
          <div
            className={`rf-sim-cartao is-${cartao.chave}`}
            key={cartao.chave}
            style={{ '--rf-w': cartao.barra }}
          >
            <span className="rf-sim-cartao-lbl">{cartao.rotulo}</span>
            <span className="rf-sim-cartao-val rf-mono">{brl(partes[cartao.chave])}</span>
            <span className="rf-sim-cartao-txt">{cartao.texto}</span>
          </div>
        ))}
      </div>

      <div className="rf-sim-resultado" aria-live="polite">
        <span className="rf-sim-grande rf-mono">{bonus.toLocaleString('pt-BR')}</span>
        <span className="rf-sim-frase">
          {meses >= 1 ? (
            <>
              bônus de R$ {cofre.bonus} por criança, ou{' '}
              <b>
                as {coorte.total} crianças de Boipeba cobertas por {meses}{' '}
                {meses === 1 ? 'mês' : 'meses'}
              </b>
              .
            </>
          ) : (
            <>
              bônus de R$ {cofre.bonus} por criança,{' '}
              <b>
                {bonus} de {coorte.total} crianças cobertas em um mês
              </b>
              .
            </>
          )}
        </span>
      </div>

      <p className="rf-sim-nota">{simulador.nota}</p>
    </Revelar>
  );
}

export default Simulador;
