import React from 'react';
import {
  useStore, fmt, trunc, disponivelCofre, REDE, PROVIDER_CARTEIRA,
  BONUS_POR_CRIANCA, rendaCreditada,
} from '../estado/store.jsx';
import { ValorAnimado, useContagem } from '../componentes/ui.jsx';
import { BarrasSemana, BarrasFonteReceita } from '../painel/graficos/Graficos.jsx';
import { Icon } from '../painel/ui/Icones.jsx';
import {
  Card, CardCabecalho, CardNota, Grade, Medidor, Vazio, Nota, Botao, Pill,
} from '../painel/ui/primitivos.jsx';
import { TelaCabecalho } from '../painel/ui/TelaCabecalho.jsx';
import { useDemo, useDestaque } from '../componentes/demo.jsx';
import { useIdioma } from '../lib/i18n.jsx';
import './dashboard.css';

const METAS = { kg: 12000, familias: 30, criancas: 60, receita: 42000 };

/* Tipo de transação para tom semântico. O mapa de cores fixas vive em
   `TIPOS_TX` (store), junto da regra de negócio; aqui o tipo só escolhe um
   token de estado, para o feed acompanhar o tema como o resto do painel. */
const TOM_TX = {
  'VALIDAÇÃO': 'ok',
  'LIBERAÇÃO': 'ok',
  'ANCORAGEM': 'ok',
  'CONSENTIMENTO': 'ok',
  'RESERVA': 'warn',
  'ASSINATURA': 'warn',
  'CONTESTACAO': 'crit',
};
const tomDe = tipo => TOM_TX[tipo] || 'wait';

/* ---------- anel de progresso geral do piloto ---------- */
function AnelProgresso({ pct, rot }) {
  const mostrado = useContagem(pct, 1100);
  const R = 60, C = 2 * Math.PI * R;
  const visivel = Math.min(100, mostrado);
  return (
    <div className="pn-gauge" role="img" aria-label={`${Math.round(visivel)} por cento da meta do piloto atingida`}>
      <svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">
        <circle className="pn-g-track" cx="75" cy="75" r={R} />
        <circle
          className="pn-g-arc"
          cx="75" cy="75" r={R}
          strokeLinecap="round"
          strokeDasharray={`${(C * visivel) / 100} ${C}`}
          transform="rotate(-90 75 75)"
        />
      </svg>
      <div className="lab">
        <b>{Math.round(visivel)}%</b>
        <span>{rot}</span>
      </div>
    </div>
  );
}

/* ---------- KPI com meta ---------- */
function Kpi({ num, valor, rot, meta, pct, alerta }) {
  return (
    <div className="pn-kpi">
      <div className="l">{rot}</div>
      {valor != null ? <ValorAnimado valor={valor} className="v" /> : <div className="v">{num}</div>}
      {pct != null && <Medidor pct={pct} alerta={alerta} />}
      {meta && <div className={'m' + (alerta ? ' alerta' : '')}>{meta}</div>}
    </div>
  );
}

/* ---------- painel por dimensão de impacto ---------- */
function Dimensao({ icone, titulo, resumo, children }) {
  return (
    <Card>
      <CardCabecalho titulo={<><Icon name={icone} /> {titulo}</>} />
      <CardNota>{resumo}</CardNota>
      <Grade colunas={4} style={{ marginTop: 18, gap: 20 }}>{children}</Grade>
    </Card>
  );
}

/* ---------- as 7 passagens do ciclo ---------- */
const ETAPAS = [
  ['01', 'Resíduo', 'chega à praia'],
  ['02', 'Coleta', 'comunidade age'],
  ['03', 'Validação', 'DeTrash confere'],
  ['04', 'Circularidade', 'vira evidência'],
  ['05', 'Receita', 'turista + empresa'],
  ['06', 'Cofre 2-de-3', 'split 60/25/15'],
  ['07', 'Infância', 'saúde + educação'],
];

export default function Dashboard() {
  const { t } = useIdioma();
  const { state } = useStore();
  const { rodando, iniciar, parar } = useDemo();
  const focoFluxo = useDestaque('fluxo');
  const focoGraf = useDestaque('graficos');

  const validadas = state.coletas.filter(c => c.status === 'validada');
  const kg = validadas.reduce((a, c) => a + Number(c.kg), 0);
  const receita = state.vendas.reduce((a, v) => a + v.valor, 0);
  const comCarteira = state.familias.filter(f => f.carteira).length;
  const criancas = state.familias.reduce((a, f) => a + f.criancas, 0);
  const condicoes = state.familias.flatMap(f => f.condicoes);
  const condOk = condicoes.filter(c => c.status === 'liberada').length;
  const pendentesColeta = state.coletas.filter(c => c.status === 'pendente').length;
  const propostasAbertas = state.propostas.filter(p => p.status === 'aguardando').length;
  const reservado = state.propostas.filter(p => p.status === 'reservada').reduce((a, p) => a + p.valor, 0);
  /* O que REALMENTE chegou a conta de família: renda creditada + bônus liberado.
     Antes era caixas.renda, que é o valor DESTINADO aos 60%, e se um coletor
     não está vinculado a família cadastrada, esse dinheiro não chega a conta
     nenhuma. O número dizia R$ 1.548 quando R$ 48 tinham chegado. */
  const creditado = rendaCreditada(state);
  const paraFamilias = creditado + state.caixas.fundoLiberado;
  const semVinculo = Number((state.caixas.renda - creditado).toFixed(2));

  const pctGeral = (
    Math.min(1, kg / METAS.kg) +
    Math.min(1, receita / METAS.receita) +
    Math.min(1, state.familias.length / METAS.familias) +
    Math.min(1, criancas / METAS.criancas)
  ) / 4 * 100;

  const feed = [...state.transacoes].slice(-4).reverse();

  return (
    <div className="pn-screen">
      <TelaCabecalho etapa={1} total={9} area={t('Visão geral')} titulo={t('O ciclo de Boipeba, em números que dá para auditar')}>
        {t('Cada real que aparece aqui entrou por uma venda registrada, passou por validação da DeTrash e foi dividido por contrato.')}{' '}
        <b>{t('Nada nesta tela é estimativa.')}</b>
      </TelaCabecalho>

      {/* ---------------- painel de destaque ---------------- */}
      <div className="pn-hero">
        <div>
          <h2>{t('Impacto em tempo real')}</h2>
          <div className="pn-hero-figs">
            <div>
              <div className="v">
                {(kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t
              </div>
              <div className="l">{t('resíduos validados')}</div>
            </div>
            <div>
              <ValorAnimado valor={paraFamilias} className="v chave" />
              <div className="l">{t('direto para as famílias')}</div>
              {semVinculo > 0.01 && (
                <span
                  className="ressalva"
                  title="Renda de coletas cujo coletor ainda não está vinculado a uma família cadastrada"
                >
                  + {fmt(semVinculo)} {t('de coleta sem família cadastrada')}
                </span>
              )}
            </div>
            <div>
              <div className="v">{criancas}</div>
              <div className="l">{t('crianças acompanhadas')}</div>
            </div>
          </div>
          <div className="pn-hero-acao">
            {rodando ? (
              <Botao tom="ghost" onClick={parar}>
                <Icon name="close" />
                {t('Parar demonstração')}
              </Botao>
            ) : (
              <Botao onClick={iniciar}>
                <Icon name="play" />
                {t('Ver o ciclo completo')}
              </Botao>
            )}
          </div>
        </div>
        <AnelProgresso rot={t('do piloto')} pct={pctGeral} />
        <p className="pn-hero-note">
          {t('O modo guiado executa a jornada inteira (coleta, validação, venda, split, multisig 2-de-3 e saque) trocando de aba sozinho. Ideal para gravar a apresentação.')}
        </p>
      </div>

      {/* ---------------- as 7 passagens do ciclo ---------------- */}
      <div className={'pn-sect' + focoFluxo}>
        <div className="pn-sect-lab">{t('As 7 passagens do ciclo')}</div>
        <Card pequeno>
          <div className="pn-cycle">
            {ETAPAS.map(([n, rot, sub]) => (
              <div className="pn-cstep" key={rot}>
                <div className="n">{n}</div>
                <div className="t">{rot}</div>
                <div className="d">{sub}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ---------------- gráficos ---------------- */}
      <Grade colunas="5-8" className={focoGraf}>
        <Card>
          <CardCabecalho
            titulo={t('Quilos validados por semana')}
            acessorio={<Pill tom="ok">{kg} kg no total</Pill>}
          />
          <CardNota>
            {t('Só entra no gráfico o que a DeTrash validou. Coleta registrada e ainda pendente fica de fora.')}
          </CardNota>
          <BarrasSemana coletas={state.coletas} />
        </Card>
        <Card>
          <CardCabecalho titulo={t('Receita por fonte')} acessorio={<Pill tom="wait">{fmt(receita)}</Pill>} />
          <CardNota>
            {t('Cada fonte na mesma cor: a categoria já está escrita ao lado da barra.')}
          </CardNota>
          <BarrasFonteReceita vendas={state.vendas} />
        </Card>
      </Grade>

      {/* ---------------- feed da rede ---------------- */}
      <Card>
        <CardCabecalho
          titulo={t('Últimas atividades na rede')}
          acessorio={<span className="pn-mono" style={{ color: 'var(--t4)' }}>slot {state.slot} · {state.transacoes.length} transações</span>}
        />
        {feed.length === 0 ? (
          <Vazio titulo={t('Nenhuma atividade ainda')} dica={t('Registre uma coleta para a rede começar a receber transações.')} />
        ) : (
          <div className="pn-feed">
            {feed.map(tx => {
              const tom = tomDe(tx.tipo);
              return (
                <div className="pn-fitem" key={tx.signature}>
                  <span className={`pn-fdot ${tom}`} aria-hidden="true" />
                  <div>
                    <span className={`pn-fk ${tom}`}>{tx.tipo}</span>
                    <p>{tx.desc}</p>
                  </div>
                  <div className="pn-fdir">
                    {tx.valor > 0 && <b>{fmt(tx.valor)}</b>}
                    <span>{trunc(tx.signature, 4, 4)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ---------------- metas por dimensão ---------------- */}
      <Dimensao
        icone="scan"
        titulo={t('Ambiental')}
        resumo={`${(kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t de resíduos fora da praia e da natureza`}
      >
        <Kpi num={(kg / 1000).toLocaleString('pt-BR')} rot="toneladas validadas" meta="meta 12 t" pct={kg / METAS.kg * 100} />
        <Kpi num={validadas.length} rot="ações de coleta validadas" meta="meta 24 ações" pct={validadas.length / 24 * 100} />
        <Kpi num={state.relatorios.length} rot="Relatórios de Circularidade" meta="meta 6 relatórios" pct={state.relatorios.length / 6 * 100} />
        <Kpi
          num={pendentesColeta}
          rot="coletas aguardando validação"
          meta={pendentesColeta > 0 ? 'esperando o Instituto Vivá' : 'nada parado'}
          pct={pendentesColeta > 0 ? 33 : 0}
          alerta={pendentesColeta > 0}
        />
      </Dimensao>

      <Dimensao
        icone="coin"
        titulo={t('Econômico')}
        resumo={`${fmt(receita)} movimentados por turismo responsável e ESG`}
      >
        <Kpi valor={receita} rot="receita total gerada" meta="meta R$ 42 mil" pct={receita / METAS.receita * 100} />
        <Kpi valor={state.caixas.renda} rot="renda direta (60%, incondicional)" />
        <Kpi valor={state.caixas.fundo} rot="cofre Fundo Infância (25%)" meta={`livre: ${fmt(disponivelCofre(state))}`} />
        <Kpi num={state.vendas.length} rot="vendas realizadas" />
      </Dimensao>

      <Dimensao
        icone="guide"
        titulo={t('Social')}
        resumo={`${criancas} crianças com saúde e escola acompanhadas`}
      >
        <Kpi num={state.familias.length} rot="famílias participantes" meta="meta 30 famílias" pct={state.familias.length / METAS.familias * 100} />
        <Kpi num={criancas} rot={t('crianças acompanhadas')} meta="meta 60 crianças" pct={criancas / METAS.criancas * 100} />
        <Kpi valor={state.caixas.fundoLiberado} rot="bônus liberados às famílias" />
        <Kpi num={`${condOk}/${condicoes.length}`} rot="condições cumpridas e liberadas" />
      </Dimensao>

      <Dimensao
        icone="shield"
        titulo={`${t('Confiança digital')} (${REDE})`}
        resumo="cada centavo rastreável, nenhuma organização decide sozinha"
      >
        <Kpi num={state.transacoes.length} rot="transações rastreáveis" meta={`slot atual: ${state.slot}`} />
        <Kpi num={comCarteira + '/' + state.familias.length} rot={`famílias com conta ${PROVIDER_CARTEIRA}`} />
        <Kpi num={propostasAbertas} rot="propostas aguardando assinatura" meta="limiar 2 de 3" />
        <Kpi valor={reservado} rot="bônus reservado (nunca perdido)" />
      </Dimensao>

      {condicoes.length === 0 && (
        <Vazio
          titulo="Nenhuma família cadastrada com compromissos"
          dica="Use o botão Resetar demo no rodapé para restaurar os dados do piloto."
        />
      )}

      <Nota tipo="i" icone="coin">
        <b>Princípio do modelo:</b> a renda do trabalho (60%) é paga diretamente e é <b>incondicional</b>.
        O cofre multisig administra apenas o <b>Fundo Infância</b> (25%): um bônus adicional de {fmt(BONUS_POR_CRIANCA)} por
        criança/mês por compromissos de saúde e educação, que fica <b>reservado (nunca perdido)</b> quando a condição ainda não foi comprovada.
        Nenhuma organização move esse dinheiro sozinha: são necessárias <b>2 das 3 assinaturas</b> (Instituto Vivá, DeTrash e Representante Comunitário).
      </Nota>
    </div>
  );
}
