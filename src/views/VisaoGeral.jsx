import { useStore, fmt, trunc, tipoTx } from '../estado/store.jsx';
import { useIdioma } from '../lib/i18n.jsx';
import { useDemo, useDestaque } from '../componentes/demo.jsx';
import { Icon } from '../painel/ui/Icones.jsx';
import { MES as D, PROVAS_RECENTES, TOTAIS } from '../painel/demo/setembro.js';
import './visao-geral.css';

/* ---------------------------------------------------------------------------
   Visão geral: o relatório do mês.

   Os números do mês (quilos, receita, divisão) vêm de
   `painel/demo/setembro.js`, que é DEMONSTRAÇÃO até a equipe decidir a base.
   A tela diz isso no próprio rodapé do relatório. A fila de hoje e as provas
   na cadeia, ao contrário, leem o store: é o que já existe de verdade no
   painel.
--------------------------------------------------------------------------- */

const brl = (v) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
const kg = (v) => v.toLocaleString('pt-BR');

function Kpi({ rotulo, valor, unidade, delta, fonte, chave }) {
  return (
    <div className={`pn-card vg-kpi${chave ? ' key' : ''}`}>
      <div className="vg-cap">{rotulo}</div>
      <div className="v">
        {valor}
        {unidade && <small>{unidade}</small>}
      </div>
      {delta && <div className="d">{delta}</div>}
      <div className="src mode-pr">
        <Icon name="shield" className="sm" />
        {fonte}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Sankey -- */
/**
 * Do quilo validado até os três destinos, em SVG. Cada faixa e cada nó tem
 * `data-tip` (a camada de dicas do shell mostra a origem) e, quando leva a uma
 * tela, é um botão: clique ou Enter abre a etapa.
 */
function Sankey({ irPara, t }) {
  const W = 1000;
  const H = 330;
  const T = D.receita;
  const sc = 270 / T;
  const gap = 14;
  const x0 = 0;
  const x1 = 250;
  const x2 = 520;
  const x3 = 770;
  const nw = 14;
  const hT = D.turismo * sc;
  const hE = D.esg * sc;
  const s1y = 20;
  const s2y = s1y + hT + gap;
  const cy = 20 + (hT + hE + gap - T * sc) / 2;
  const hC = T * sc;
  const kgH = hT + hE + gap;
  const destinos = [
    [t('Renda das famílias'), D.renda, '--c-renda', t('60% · incondicional · 30 famílias'), 'carteira', '60%'],
    [t('Fundo Infância'), D.infancia, '--c-inf', `25% · ${brl(D.bonusLiberado)} ${t('liberados')}, ${brl(D.reservado)} ${t('reservados')}`, 'validacao', '25%'],
    [t('Operação'), D.operacao, '--c-op', t('15% · validação, logística, infraestrutura'), 'fundo', '15%'],
  ];
  let y = 10;
  const dy = destinos.map((d) => {
    const h = d[1] * sc;
    const r = [y, h];
    y += h + gap;
    return r;
  });

  const clicavel = (go) =>
    go
      ? {
          role: 'button',
          tabIndex: 0,
          onClick: () => irPara(go),
          onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              irPara(go);
            }
          },
        }
      : {};
  const faixa = (k, xa, ya, ha, xb, yb, hb, fill, op, tip, go, rotulo) => {
    const m = (xa + xb) / 2;
    return (
      <path
        key={k}
        className="band"
        data-tip={tip}
        aria-label={rotulo}
        style={{ opacity: op }}
        fill={fill}
        d={`M${xa},${ya} C${m},${ya} ${m},${yb} ${xb},${yb} L${xb},${yb + hb} C${m},${yb + hb} ${m},${ya + ha} ${xa},${ya + ha} Z`}
        {...clicavel(go)}
      />
    );
  };
  const no = (k, x, yy, h, cor, go, tip, rotulo) => (
    <rect key={k} className="nd" data-tip={tip} aria-label={rotulo} x={x} y={yy} width={nw} height={h} rx="4" fill={cor} {...clicavel(go)} />
  );
  const rot = (k, x, yy, a, b) => (
    <text key={k} x={x} y={yy}>
      <tspan className="lbl">{a}</tspan>
      <tspan className="val" x={x} dy="17">
        {b}
      </tspan>
    </text>
  );

  let oy = cy;
  const faixasDestino = destinos.map((d, i) => {
    const h = d[1] * sc;
    const el = faixa(`d${i}`, x2 + nw, oy, h, x3, dy[i][0], h, `var(${d[2]})`, 0.55, `<b>${d[0]}: ${brl(d[1])}</b>${d[3]}`, d[4], `${d[0]}: ${brl(d[1])}`);
    oy += h;
    return el;
  });

  return (
    <svg
      viewBox={`-4 0 ${W + 4} ${H}`}
      role="group"
      aria-label={`${t('Fluxo do mês')}: ${kg(D.kg)} kg → ${brl(T)} → ${brl(D.renda)}, ${brl(D.infancia)}, ${brl(D.operacao)}`}
    >
      {faixa('a', x0 + nw, 20, kgH * (D.turismo / T), x1, s1y, hT, 'var(--c-neutral)', 1, `<b>${t('Peças para turistas')}</b>${t('Material validado transformado em peças')}: ${brl(D.turismo)}`, 'mercado', t('Turismo'))}
      {faixa('b', x0 + nw, 20 + kgH * (D.turismo / T), kgH * (D.esg / T), x1, s2y, hE, 'var(--c-neutral)', 1, `<b>${t('Relatórios para empresas')}</b>${t('Evidência DeTrash vendida como relatório ESG')}: ${brl(D.esg)}`, 'mercado', t('Empresas (ESG)'))}
      {faixa('c', x1 + nw, s1y, hT, x2, cy, hT, 'var(--c-neutral)', 1, `<b>${brl(D.turismo)}</b>${t('entram no cofre já com a divisão por contrato')}`, 'fundo', t('Turismo para o cofre'))}
      {faixa('e', x1 + nw, s2y, hE, x2, cy + hT, hE, 'var(--c-neutral)', 1, `<b>${brl(D.esg)}</b>${t('entram no cofre já com a divisão por contrato')}`, 'fundo', t('Empresas para o cofre'))}
      {faixasDestino}
      {no('n0', x0, 20, kgH, 'var(--t2)', 'coleta', `<b>${kg(D.kg)} kg ${t('validados')}</b>${t('Coletas conferidas pela IA e validadas pela DeTrash')}`, t('Resíduo validado'))}
      {no('n1', x1, s1y, hT, 'var(--t2)', 'mercado', `<b>${t('Turismo')}</b>${t('peças rastreadas por QR')}`, t('Turismo'))}
      {no('n2', x1, s2y, hE, 'var(--t2)', 'mercado', `<b>${t('Empresas')}</b>${t('Relatórios de Circularidade')}`, t('Empresas (ESG)'))}
      {no('n3', x2, cy, hC, 'var(--gold)', 'fundo', `<b>${t('Cofre 2-de-3')}</b>${brl(T)} ${t('recebidos e divididos')}`, t('Cofre 2-de-3'))}
      {destinos.map((d, i) => no(`nd${i}`, x3, dy[i][0], dy[i][1], `var(${d[2]})`, d[4], `<b>${d[0]}</b>${d[3]}`, d[0]))}
      {rot('r0', x0 + nw + 10, 20 + kgH / 2 - 4, t('Resíduo validado'), kg(D.kg) + ' kg')}
      {rot('r1', x1 + nw + 10, s1y + hT / 2 - 2, t('Turismo'), brl(D.turismo))}
      {rot('r2', x1 + nw + 10, s2y + hE / 2 - 4, t('Empresas (ESG)'), brl(D.esg))}
      {rot('r3', x2 + nw + 10, cy + hC / 2 - 4, t('Cofre 2-de-3'), brl(T))}
      {destinos.map((d, i) => rot(`rd${i}`, x3 + nw + 12, dy[i][0] + dy[i][1] / 2 - 4, d[0], `${brl(d[1])} · ${d[5]}`))}
    </svg>
  );
}

/* ------------------------------------------------------------- barras -- */
function Barras({ t }) {
  const max = 400;
  return (
    <div className="vg-bars" role="img" aria-label={t('Quilos validados por semana, de agosto a setembro')}>
      {[100, 200, 300, 400].map((v) => (
        <div key={v} className="gl" style={{ bottom: `calc(${(v / max) * 100}% * (190 - 28) / 190 + 28px)` }}>
          <span>{v}</span>
        </div>
      ))}
      {D.semanas.map((w, i) => (
        <div
          key={w[0]}
          className={`vg-bar${i < 4 ? ' agosto' : ''}`}
          data-tip={`<b>${w[1]} kg ${t('validados')}</b>${t('semana de')} ${w[0]} · ${i < 4 ? t('agosto') : t('setembro')}`}
        >
          <i style={{ height: `${(w[1] / max) * 100}%` }} />
          <small>{w[0]}</small>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------- fila e provas (store) -- */
function FilaDeHoje({ irPara, t }) {
  const { state } = useStore();
  const hoje = new Date().toISOString().slice(0, 10);
  const coletasPend = state.coletas.filter((c) => c.status === 'pendente').length;
  const coletasHoje = state.coletas.filter((c) => c.data === hoje);
  const condicoes = state.familias.flatMap((f) => f.condicoes || []);
  const condPend = condicoes.filter((c) => c.status === 'pendente' || c.status === 'validada-aguardando').length;
  const propostas = state.propostas.filter((p) => p.status === 'aguardando');
  const linhas = [
    [coletasPend, `${coletasPend} ${t('coleta(s) aguardando validação')}`, t('Validação do Instituto Vivá'), 'validacao', coletasPend ? ['warn', t('Validar')] : ['ok', t('Em dia')]],
    [condPend, `${condPend} ${t('comprovação(ões) de crianças')}`, t('Validação presencial do Vivá'), 'validacao', condPend ? ['info', t('Validar')] : ['ok', t('Em dia')]],
    [
      propostas.length,
      propostas.length ? `${t('Proposta no cofre aguardando assinatura')}` : t('Nenhuma proposta no cofre'),
      propostas.length ? `${propostas[0].assinaturas.length} ${t('de 2 assinaturas')} · ${fmt(propostas[0].valor)}` : t('Cofre 2-de-3'),
      'fundo',
      propostas.length ? ['warn', t('Assinar')] : ['ok', t('Em dia')],
    ],
    [coletasHoje.length, `${coletasHoje.length} ${t('coleta(s) registrada(s) hoje')}`, t('Todas com foto e peso'), 'coleta', ['ok', t('Em dia')]],
  ];
  return (
    <div className="pn-card pad mode-op">
      <h2 className="vg-t">{t('Fila de hoje')}</h2>
      <p className="vg-sub">{t('O que depende de uma pessoa da equipe.')}</p>
      <div className="vg-list">
        {linhas.map(([, tit, sub, go, [tom, chip]]) => (
          <button key={tit} type="button" className="vg-det" onClick={() => irPara(go)}>
            <span>
              {tit}
              <small>{sub}</small>
            </span>
            <span className={`vg-chip st-${tom}`}>
              <i />
              {chip}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProvasNaCadeia({ t }) {
  const { state } = useStore();
  /* O real primeiro: as últimas transações do store. Sem nenhuma ainda, as
     da demonstração. */
  const reais = [...state.transacoes].reverse().slice(0, 4).map((tx) => [tx.desc || tipoTx(tx.tipo).rot, trunc(tx.signature, 8), `slot ${tx.slot}`]);
  const linhas = reais.length ? reais : PROVAS_RECENTES;
  return (
    <div className="pn-card pad mode-pr">
      <h2 className="vg-t">{t('Últimas provas na cadeia')}</h2>
      <p className="vg-sub">{t('Registros públicos na Solana devnet. Ninguém consegue apagar ou alterar.')}</p>
      <div className="vg-list">
        {linhas.map((r, i) => (
          <div className="vg-det" key={i}>
            <span>
              {r[0]}
              <small className="mono">{r[1]}</small>
            </span>
            <span className="vg-chip">{r[2]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- tela -- */
export default function VisaoGeral({ irPara }) {
  const { t } = useIdioma();
  const { rodando, iniciar, parar } = useDemo();
  const focoFluxo = useDestaque('fluxo');
  const focoGraf = useDestaque('graficos');
  const pctKg = Math.round((D.kg / D.kgAnterior - 1) * 100);

  return (
    <div className="pn-screen vg">
      <header className="vg-head">
        <span className="vg-cap">
          {t('Relatório do mês')} · {D.nome}
        </span>
        <h1>
          {t('Até aqui,')} <em>{TOTAIS.toneladas} t</em> {t('de resíduo validado viraram renda para')} {TOTAIS.familias}{' '}
          {t('famílias e bônus para')} <em>{TOTAIS.emDia} {t('das')} {TOTAIS.criancas} {t('crianças.')}</em>
        </h1>
        <p className="lead">
          {t('Nenhum número desta tela é estimativa. Cada um vem de uma prova: a coleta validada pela DeTrash, a venda registrada no Mercado e a divisão executada pelo contrato na Solana.')}
        </p>
        <div className="vg-row">
          <button type="button" className="pn-btn" onClick={() => irPara('trilha')}>
            <Icon name="split" className="sm" />
            {t('Rastrear um real do começo ao fim')}
          </button>
          <button type="button" className="pn-btn ghost" onClick={() => irPara('fundo')}>
            <Icon name="ext" className="sm" />
            {t('Ver o cofre na cadeia')}
          </button>
          {/* O modo guiado: executa a jornada inteira trocando de tela sozinho. */}
          {rodando ? (
            <button type="button" className="pn-btn ghost" onClick={parar}>
              <Icon name="close" className="sm" />
              {t('Parar demonstração')}
            </button>
          ) : (
            <button type="button" className="pn-btn ghost" onClick={iniciar}>
              <Icon name="play" className="sm" />
              {t('Ver o ciclo completo')}
            </button>
          )}
        </div>
      </header>

      <div className="vg-g4">
        <Kpi rotulo={t('Resíduo validado')} valor={TOTAIS.toneladas} unidade="t" delta={<>{kg(D.kg)} kg {t('em setembro')}, <b className="up">+{pctKg}%</b> {t('sobre agosto')}</>} fonte={t('Validado pela DeTrash')} />
        <Kpi rotulo={t('Receita do mês')} valor={brl(D.receita)} delta={`${t('Turismo')} ${brl(D.turismo)} · ${t('Empresas')} ${brl(D.esg)}`} fonte={t('Vendas registradas no Mercado')} />
        <Kpi rotulo={t('Renda para as famílias')} valor={brl(D.renda)} delta={`${t('em setembro')} · ${TOTAIS.familias} ${t('famílias')} · ${t('60% da receita, sem condições')}`} fonte={t('Pago pelo contrato na Solana')} chave />
        <Kpi rotulo={t('Crianças com bônus')} valor={`${TOTAIS.emDia} ${t('de')} ${TOTAIS.criancas}`} delta={`${Math.round((TOTAIS.emDia / TOTAIS.criancas) * 100)}% ${t('com saúde e escola em dia')}`} fonte={t('Comprovado pelo Instituto Vivá')} />
      </div>

      <div className={`pn-card pad pn-flow${focoFluxo ? ' ' + focoFluxo : ''}`}>
        <div className="vg-row between">
          <div>
            <h2 className="vg-t">{t('Para onde foi cada real de setembro')}</h2>
            <p className="vg-sub">{t('Do quilo recolhido na praia até a conta das famílias. Passe o mouse ou toque em qualquer faixa para ver a origem.')}</p>
          </div>
          <div className="vg-legend">
            <span><b style={{ background: 'var(--c-renda)' }} />{t('Renda')} 60%</span>
            <span><b style={{ background: 'var(--c-inf)' }} />{t('Infância')} 25%</span>
            <span><b style={{ background: 'var(--c-op)' }} />{t('Operação')} 15%</span>
          </div>
        </div>
        <div className="flow-d">
          <Sankey irPara={irPara} t={t} />
        </div>
        <div className="flow-m">
          <div className="vg-det"><span>{t('Resíduo validado')}<small>{t('conferido pela IA e pela DeTrash')}</small></span><b>{kg(D.kg)} kg</b></div>
          <div className="vg-det"><span>{t('Turismo')}<small>{t('peças com QR')}</small></span><b>{brl(D.turismo)}</b></div>
          <div className="vg-det"><span>{t('Empresas (ESG)')}<small>{t('Relatórios de Circularidade')}</small></span><b>{brl(D.esg)}</b></div>
          <div className="vg-det"><span>{t('Cofre 2-de-3')}<small>{t('divide na entrada')}</small></span><b>{brl(D.receita)}</b></div>
          <div className="vg-split" aria-hidden="true">
            <i style={{ width: '60%', background: 'var(--c-renda)' }} />
            <i style={{ width: '25%', background: 'var(--c-inf)' }} />
            <i style={{ width: '15%', background: 'var(--c-op)' }} />
          </div>
          <div className="vg-det"><span>{t('Renda das famílias')}<small>60% · 30 {t('famílias')}</small></span><b>{brl(D.renda)}</b></div>
          <div className="vg-det"><span>{t('Fundo Infância')}<small>25% · {brl(D.bonusLiberado)} {t('liberados')}</small></span><b>{brl(D.infancia)}</b></div>
          <div className="vg-det"><span>{t('Operação')}<small>15%</small></span><b>{brl(D.operacao)}</b></div>
        </div>
      </div>

      <div className="vg-g21">
        <div className={`pn-card pad${focoGraf ? ' ' + focoGraf : ''}`}>
          <h2 className="vg-t">{t('Quilos validados por semana')}</h2>
          <p className="vg-sub">{t('Só entra aqui o que a DeTrash validou. Coleta pendente ou recusada fica de fora.')}</p>
          <Barras t={t} />
          <div className="vg-legend" style={{ marginTop: 16 }}>
            <span><b style={{ background: 'var(--c-neutral)' }} />{t('Agosto')}</span>
            <span><b style={{ background: 'var(--c-renda)' }} />{t('Setembro')}</span>
          </div>
        </div>
        <FilaDeHoje irPara={irPara} t={t} />
        <ProvasNaCadeia t={t} />
      </div>

      <div className="vg-hint mode-pr">
        <Icon name="help" className="sm" />
        <div>
          <b>{t('Como ler este painel.')}</b>{' '}
          {t('No modo Apresentação, cada número mostra de onde vem. No modo Operação, o mesmo painel vira a rotina da equipe: registrar, conferir, validar e assinar.')}
        </div>
      </div>
      <p className="vg-demo">
        {t('Totais do projeto: os mesmos da página pública. Valores de setembro (receita, quilos e divisão): ilustrativos e coerentes com esses totais, até a equipe fechar o mês. A fila de hoje e as provas na cadeia leem o estado real do painel.')}
      </p>
    </div>
  );
}
