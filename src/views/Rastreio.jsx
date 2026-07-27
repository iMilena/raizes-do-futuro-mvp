import React from 'react';
import { useStore, fmt, trunc, vendaPorRastreio, SPLIT, BONUS_POR_CRIANCA } from '../store.jsx';
import { EstadoVazio, QrCode } from '../ui.jsx';
import { useIdioma } from '../i18n.jsx';

/* ---------------------------------------------------------------------------
   Página pública de rastreio — o que o turista vê ao escanear o QR do produto.

   Sem login, mobile-first, e escrita para quem acabou de comprar um chaveiro
   na praia: "de onde veio esse material e para onde foi o meu dinheiro".
   Nada de dado de família ou criança aqui — só a jornada do material e a
   divisão da receita.

   ── POR QUE ESTA PÁGINA TEM INGLÊS DE VERDADE ─────────────────────────────
   É a única tela do projeto com leitor estrangeiro real: Boipeba recebe turista
   de fora, e é essa pessoa que escaneia a etiqueta. O seletor de idioma fica
   AQUI, na própria página, porque quem chega pelo QR não passa pelo painel.
--------------------------------------------------------------------------- */

function Etapa({ n, icone, titulo, children, ultima }) {
  return (
    <div className={'etapa' + (ultima ? ' ultima' : '')}>
      <div className="etapa-marca">
        <span className="etapa-num">{icone || n}</span>
      </div>
      <div className="etapa-corpo">
        <b>{titulo}</b>
        {children}
      </div>
    </div>
  );
}

/* Seletor próprio: a página é standalone, sem o cabeçalho do painel. */
function IdiomaTurista() {
  const { idioma, trocar } = useIdioma();
  return (
    <div className="idioma" role="group" aria-label="Idioma / Language">
      {['pt', 'en'].map(l => (
        <button key={l} className={idioma === l ? 'on' : ''} onClick={() => trocar(l)}
          aria-pressed={idioma === l} lang={l}>{l === 'pt' ? 'PT' : 'EN'}</button>
      ))}
    </div>
  );
}

export default function Rastreio({ codigo }) {
  const { state } = useStore();
  const { t, idioma } = useIdioma();
  const venda = vendaPorRastreio(state, codigo);
  const local = idioma === 'en' ? 'en-GB' : 'pt-BR';
  const data = iso => new Date(iso + 'T12:00:00').toLocaleDateString(local);

  if (!venda) {
    return (
      <div className="rastreio-tela">
        <div className="rastreio-topo">
          <div>
            <div className="fam-marca">🌱 Raízes do Futuro</div>
            <div className="fam-sub">{t('Rastreio de produto')} · Boipeba, {t('Bahia, Brasil')}</div>
          </div>
          <IdiomaTurista />
        </div>
        <div className="rastreio-corpo">
          <EstadoVazio icone="🔍"
            titulo={`${t('Código')} ${codigo || '—'} ${t('não encontrado')}`}
            dica={t('Confira o código impresso na etiqueta. Cada produto tem o seu, no formato RF-XXXX.')} />
          <a className="voltar-painel" href="#/">{t('ver o projeto')}</a>
        </div>
      </div>
    );
  }

  const coletas = (venda.origem || []).map(id => state.coletas.find(c => c.id === id)).filter(Boolean);
  const kgTotal = coletas.reduce((a, c) => a + Number(c.kg), 0);
  const paraColetor = venda.valor * SPLIT.renda;
  const paraFundo = venda.valor * SPLIT.fundo;
  const paraOperacao = venda.valor * SPLIT.operacao;

  // relatório de circularidade mais recente que já existia quando a peça foi vendida
  const relatorio = [...state.relatorios]
    .filter(r => r.data <= venda.data)
    .sort((a, b) => a.data.localeCompare(b.data))
    .pop();

  const txVenda = state.transacoes.find(t2 => t2.tipo === 'RECEITA' && t2.vendaId === venda.id);
  const fracaoBonus = paraFundo / BONUS_POR_CRIANCA;

  return (
    <div className="rastreio-tela">
      <div className="rastreio-topo">
        <div>
          <div className="fam-marca">🌱 Raízes do Futuro</div>
          <div className="fam-sub">{t('A história desta peça')} · Boipeba, {t('Bahia, Brasil')}</div>
        </div>
        <IdiomaTurista />
      </div>

      <div className="rastreio-corpo">
        <div className="card rastreio-cabeca">
          <div className="rastreio-codigo">{venda.rastreio}</div>
          <h2 style={{ margin: '4px 0 2px' }}>{venda.descricao}</h2>
          <div className="mini">{t('vendida em')} {data(venda.data)} · {fmt(venda.valor)}</div>
        </div>

        <h3 className="fam-h3">🧭 {t('A jornada deste material')}</h3>

        <div className="etapas">
          {coletas.length > 0 ? coletas.map((c, i) => (
            <Etapa key={c.id} icone="🧹" titulo={`${t('Recolhido na')} ${c.local}`}>
              <div className="mini">
                {c.kg} kg {t('de')} {c.material.toLowerCase()} · {t('por')} {c.coletor} · {data(c.data)}
              </div>
              {i === coletas.length - 1 && coletas.length > 1 && (
                <div className="mini">{t('total de')} {kgTotal} kg {t('neste lote')}</div>
              )}
            </Etapa>
          )) : (
            <Etapa icone="🧹" titulo={t('Recolhido na ilha de Boipeba')}>
              <div className="mini">{t('material do estoque já verificado pela DeTrash')}</div>
            </Etapa>
          )}

          <Etapa icone="✅" titulo={t('Verificado pela DeTrash')}>
            <div className="mini">
              {t('A pesagem e a origem foram conferidas pela metodologia da DeTrash antes de virar produto.')}
            </div>
            {coletas[0]?.signature && (
              <div className="hash">{t('registro')}: {trunc(coletas[0].signature, 10, 10)}</div>
            )}
          </Etapa>

          {relatorio && (
            <Etapa icone="📄" titulo={t('Somado ao Relatório de Circularidade')}>
              <div className="mini">
                {relatorio.periodo} — {relatorio.kg} kg {t('verificados no período')}
              </div>
              {relatorio.ancoragem && (
                <div className="mini">⚓ {t('relatório ancorado na')} {relatorio.ancoragem.rede}</div>
              )}
            </Etapa>
          )}

          <Etapa icone="🛒" titulo={t('Sua compra')}>
            <div className="mini">{fmt(venda.valor)} {t('entraram no ciclo do projeto.')}</div>
            {txVenda && <div className="hash">{t('transação registrada no slot')} {txVenda.slot}</div>}
          </Etapa>

          <Etapa icone="💚" titulo={t('Para onde foi o seu dinheiro')} ultima>
            <div className="divisao">
              <div className="divisao-linha">
                <span>{t('Renda de quem coletou')}</span>
                <b>{fmt(paraColetor)}</b>
                <i style={{ width: SPLIT.renda * 100 + '%', background: 'var(--azul)' }} />
              </div>
              <div className="divisao-linha">
                <span>{t('Fundo Infância')}</span>
                <b>{fmt(paraFundo)}</b>
                <i style={{ width: SPLIT.fundo * 100 + '%', background: 'var(--verde)' }} />
              </div>
              <div className="divisao-linha">
                <span>{t('Operação na ilha')}</span>
                <b>{fmt(paraOperacao)}</b>
                <i style={{ width: SPLIT.operacao * 100 + '%', background: '#f2c14e' }} />
              </div>
            </div>
            <div className="aviso" style={{ marginTop: 10 }}>
              <b>{t('O que isso significa')}:</b>{' '}
              {idioma === 'en' ? (
                <>
                  {fmt(paraColetor)} went straight to the person who took this material off the
                  beach — with no conditions attached. And {fmt(paraFundo)} went into the
                  Children’s Fund, which pays {fmt(BONUS_POR_CRIANCA)} per child whose health
                  checks and school attendance are up to date. This single piece already covers{' '}
                  <b>{Math.round(fracaoBonus * 100)}%</b> of one child’s monthly bonus.
                </>
              ) : (
                <>
                  {fmt(paraColetor)} foram direto para quem tirou esse material da praia — sem
                  condição nenhuma. E {fmt(paraFundo)} entraram no Fundo Infância, que paga{' '}
                  {fmt(BONUS_POR_CRIANCA)} por criança com saúde e escola em dia. Só esta peça já
                  cobre <b>{Math.round(fracaoBonus * 100)}%</b> de um bônus mensal de uma criança.
                </>
              )}
            </div>
          </Etapa>
        </div>

        <div className="card centro rastreio-qr">
          <div className="mini">{t('o código desta peça')}</div>
          <QrCode texto={typeof location !== 'undefined' ? location.href : venda.rastreio} lado={132}
            titulo={`${t('Código de rastreio')} ${venda.rastreio}`} />
          <div className="mini">{t('Mostre para outra pessoa escanear — a história é pública e verificável.')}</div>
        </div>

        <a className="voltar-painel" href="#/">{t('conhecer o projeto Raízes do Futuro')}</a>
      </div>
    </div>
  );
}
