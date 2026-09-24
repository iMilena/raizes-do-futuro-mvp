import { useState } from 'react';
import { Revelar } from './Revelar';
import { Eyebrow } from './Pecas';
import { simulador as S } from '../data/content';

const brl = (v) => 'R$ ' + v.toLocaleString('pt-BR');

/**
 * "Para onde vai cada real": o controle deslizante vai de R$ 1.000 a
 * R$ 60.000 e aplica a divisão 60/25/15 do contrato, contando quantos bônus
 * de R$ 30 a fatia da infância paga e quantos meses isso cobre para as 60
 * crianças de Boipeba. É aritmética das regras, não projeção de receita.
 */
export function Simulador() {
  const [v, setV] = useState(S.inicial);
  const bonus = Math.floor((v * 0.25) / S.bonus);
  const meses = Math.floor(bonus / S.criancas);

  return (
    <Revelar className="panel" atraso={100}>
      <Eyebrow>{S.eyebrow}</Eyebrow>
      <h3>{S.titulo}</h3>
      <div className="sim-v" aria-hidden="true">
        {brl(v)}
      </div>
      <label className="fine" htmlFor="lp-sim" style={{ display: 'block', marginTop: 6 }}>
        {S.rotuloCampo}
      </label>
      <input
        type="range"
        id="lp-sim"
        min={S.min}
        max={S.max}
        step={S.passo}
        value={v}
        aria-valuetext={brl(v)}
        onChange={(e) => setV(Number(e.target.value))}
      />
      <div className="fine marcas" aria-hidden="true">
        {S.marcas.map((m) => (
          <span key={m}>{brl(m)}</span>
        ))}
      </div>
      <div className="sim-rows">
        {S.linhas.map((l) => (
          <div className="sim-row" key={l.rotulo}>
            <i style={{ background: l.cor }} aria-hidden="true" />
            <span>
              {l.rotulo}
              <small>{l.sub}</small>
            </span>
            <b>{brl((v * l.pct) / 100)}</b>
          </div>
        ))}
      </div>
      <div className="sim-kids" aria-live="polite">
        <b>{bonus.toLocaleString('pt-BR')}</b>
        <span>{meses >= 1 ? S.cobertura(meses) : S.semCobertura}</span>
      </div>
      <p className="fine">{S.nota}</p>
    </Revelar>
  );
}

export default Simulador;
