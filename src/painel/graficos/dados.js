/* ---------------------------------------------------------------------------
   Agregação dos gráficos.

   Movida de `src/componentes/graficos.jsx` SEM alteração de cálculo: mesma
   semana começando na segunda, mesmo filtro por coleta validada, mesmo
   agrupamento de receita por fonte, mesma ordenação. O que ficou para trás foi
   só a cor, que antes vinha grudada no dado (`cor: '#1cabe2'`) e agora sai de
   token, no componente que desenha.

   Dado não carrega cor. Quando carrega, o gráfico deixa de responder ao tema, e
   a mesma fonte de receita fica azul-de-fábrica no claro e no escuro.
--------------------------------------------------------------------------- */

/** Segunda-feira da semana de uma data ISO (yyyy-mm-dd). */
function segundaDa(iso) {
  const d = new Date(iso + 'T12:00:00');
  const dia = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - dia);
  return d;
}

const rotuloSemana = d =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Soma kg das coletas validadas por semana, nas últimas `janela` semanas com registro. */
export function kgPorSemana(coletas, janela = 6) {
  const mapa = new Map();
  for (const c of coletas.filter(c => c.status === 'validada')) {
    const seg = segundaDa(c.data);
    const chave = seg.toISOString().slice(0, 10);
    const atual = mapa.get(chave) || { chave, rot: rotuloSemana(seg), kg: 0, acoes: 0 };
    atual.kg += Number(c.kg);
    atual.acoes += 1;
    mapa.set(chave, atual);
  }
  return [...mapa.values()].sort((a, b) => a.chave.localeCompare(b.chave)).slice(-janela);
}

const FONTES = {
  produto: 'Produtos (turismo)',
  esg: 'Relatórios ESG (empresas)',
  credito: 'Créditos de reciclagem',
};
const fonteDe = tipo => FONTES[tipo] || 'Outras fontes';

/** Soma a receita por fonte, da maior para a menor. */
export function receitaPorFonte(vendas) {
  const mapa = new Map();
  for (const v of vendas) {
    const rot = fonteDe(v.tipo);
    const atual = mapa.get(rot) || { rot, valor: 0, n: 0 };
    atual.valor += v.valor;
    atual.n += 1;
    mapa.set(rot, atual);
  }
  return [...mapa.values()].sort((a, b) => b.valor - a.valor);
}
