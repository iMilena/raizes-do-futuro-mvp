import { Vazio } from '../ui/primitivos';
import { kgPorSemana, receitaPorFonte } from './dados';
import './graficos.css';

/* ---------------------------------------------------------------------------
   Os gráficos do painel.

   Três formas, e cada uma existe porque a pergunta é diferente:

     série única no tempo   .......  barras verticais
     uma medida em várias categorias  barras horizontais
     parte de um todo        .......  barra empilhada

   Nenhuma cor é atributo de SVG. Tudo entra por classe (`.pn-bar`,
   `.pn-gl`, `.pn-ctext`) e sai de token, senão o gráfico não acompanha a troca
   de tema: o azul de fábrica que estava aqui antes (`fill="#0b7ba8"`) ficava
   igual no claro e no escuro, e era a única coisa azul num painel verde.

   Texto de gráfico sempre em token de texto, nunca na cor da série: rótulo não
   é dado, é legenda, e pintá-lo da cor da barra faz parecer que significa algo.
--------------------------------------------------------------------------- */

const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* ============================================================== série única */
/**
 * Quilos validados por semana.
 *
 * Sem legenda, de propósito: com uma série só, o título do card já nomeia o que
 * a barra é, e uma legenda de um item só ocuparia espaço para repetir.
 * O valor vai direto acima de cada barra, que poupa o olho de ir até o eixo.
 */
export function BarrasSemana({ coletas }) {
  const dados = kgPorSemana(coletas);

  if (dados.length === 0) {
    return (
      <Vazio
        titulo="Nenhuma coleta validada ainda"
        dica="Valide uma coleta na etapa Instituto Vivá para ver o gráfico."
      />
    );
  }

  const L = 44, T = 26, A = 132, W = 420;
  const base = T + A;
  const max = Math.max(...dados.map(d => d.kg));
  const escala = Math.ceil(max / 20) * 20 || 20;
  const faixa = (W - L - 16) / dados.length;
  const larguraBarra = Math.min(56, faixa * 0.44);
  const total = dados.reduce((a, d) => a + d.kg, 0);
  const acoes = dados.reduce((a, d) => a + d.acoes, 0);

  return (
    <div className="pn-grafico">
      <svg
        className="pn-chart"
        viewBox={`0 0 ${W} 186`}
        role="img"
        aria-label={`Quilos validados por semana: ${dados.map(d => `${d.rot}, ${d.kg} kg`).join('; ')}`}
      >
        {[0, 0.5, 1].map(f => {
          const y = base - f * A;
          return (
            <g key={f}>
              <line className={`pn-gl${f === 0 ? ' base' : ''}`} x1={L} y1={y} x2={W - 16} y2={y} />
              <text className="pn-ctext" x={L - 8} y={y + 4} textAnchor="end">
                {Math.round(escala * f)}
              </text>
            </g>
          );
        })}
        <text className="pn-ctext" x={L - 8} y={base + 22} textAnchor="end">kg</text>

        {dados.map((d, i) => {
          const h = Math.max(2, (d.kg / escala) * A);
          const cx = L + faixa * (i + 0.5);
          const x = cx - larguraBarra / 2;
          const y = base - h;
          const r = Math.min(4, h);
          return (
            <g key={d.chave}>
              {/* Topo arredondado ancorado na base: o caminho fecha reto embaixo
                  para a barra nascer exatamente na linha do zero. */}
              <path
                className="pn-bar"
                d={`M${x},${y + r} a${r},${r} 0 0 1 ${r},${-r} h${larguraBarra - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${base} H${x} Z`}
              />
              <text className="pn-ctext val" x={cx} y={y - 8} textAnchor="middle">{d.kg} kg</text>
              <text className="pn-ctext axis" x={cx} y={base + 22} textAnchor="middle">{d.rot}</text>
            </g>
          );
        })}
      </svg>
      <p className="pn-card-n" style={{ marginTop: 10 }}>
        {acoes} {acoes === 1 ? 'ação de coleta validada' : 'ações de coleta validadas'} em{' '}
        {dados.length} {dados.length === 1 ? 'semana' : 'semanas'} · total de {total} kg.
      </p>
    </div>
  );
}

/* ================================================= uma medida, N categorias */
/**
 * Receita por fonte, em barras horizontais.
 *
 * Era um donut com uma cor por fatia. Duas trocas, e as duas por leitura: em
 * barra deitada o nome cabe ao lado da barra, sem legenda e sem o olho ir e
 * voltar; e a cor deixa de significar categoria, porque a categoria já está
 * escrita no eixo. Cor por categoria só se justifica quando a mesma categoria
 * reaparece em outro gráfico, o que não acontece aqui.
 */
export function BarrasFonteReceita({ vendas }) {
  const dados = receitaPorFonte(vendas);
  const total = dados.reduce((a, d) => a + d.valor, 0);

  if (total === 0) {
    return (
      <Vazio
        titulo="Nenhuma receita registrada"
        dica="Faça uma venda na etapa Mercado para ver a divisão por fonte."
      />
    );
  }

  const maior = Math.max(...dados.map(d => d.valor));

  return (
    <div className="pn-hbars">
      {dados.map(d => (
        <div className="pn-hbar" key={d.rot}>
          <div className="top">
            <span className="nm">{d.rot}</span>
            <span className="vl">
              {brl(d.valor)} · {Math.round((d.valor / total) * 100)}%
            </span>
          </div>
          <div className="track">
            <i className="fill" style={{ width: `${(d.valor / maior) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================ parte do todo */
/**
 * Divisão da receita, em barra empilhada.
 *
 * A rampa --d1/--d2/--d3 não é decorativa: foi escolhida para passar em
 * monotonia de luminosidade (escurece na mesma direção nos dois temas) e em
 * contraste com o texto que vai por cima. Trocar por cores categóricas quebra
 * as duas coisas de uma vez.
 *
 * `fatias`: [{ rotulo, pct, valor }].
 */
export function BarraEmpilhada({ fatias, descricao }) {
  return (
    <div className="pn-split">
      <div className="pn-splitbar" role="img" aria-label={descricao}>
        {fatias.map((f, i) => (
          <div key={f.rotulo} className={`sp${i + 1}`} style={{ flex: f.pct }}>
            {f.pct}%
          </div>
        ))}
      </div>
      <div className="pn-legend">
        {fatias.map((f, i) => (
          <div className="pn-lg" key={f.rotulo}>
            <i className={`sw${i + 1}`} aria-hidden="true" />
            {f.rotulo}
            <b>{f.valor}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
