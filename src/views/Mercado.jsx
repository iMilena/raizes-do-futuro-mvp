import { useEffect, useRef, useState } from 'react';
import { useStore, fmt, trunc, SPLIT, urlRastreio } from '../estado/store.jsx';
import { useToast, ValorAnimado, Modal, QrCode } from '../componentes/ui.jsx';
import { Icon } from '../painel/ui/Icones.jsx';
import {
  Card, CardCabecalho, CardNota, Campo, Botao, Grade, Pill, Vazio,
  Secao, RotuloSecao, Tabela, Nota,
} from '../painel/ui/primitivos.jsx';
import { TelaCabecalho } from '../painel/ui/TelaCabecalho.jsx';
import { useDestaque } from '../componentes/demo.jsx';
import './mercado.css';

const PRODUTOS = [
  { nome: 'Luminária de vidro reaproveitado', preco: 80, img: 'luminaria.jpg', material: 'Vidro', icone: 'lamp' },
  { nome: 'Bolsa de lona de vela reciclada', preco: 65, img: 'bolsa.jpg', material: 'Lona de vela', icone: 'bag' },
  { nome: 'Vaso de plástico prensado', preco: 40, img: 'vaso.jpg', material: 'Plástico PET', icone: 'pot' },
  { nome: 'Chaveiro-lembrança de rede de pesca', preco: 25, img: 'chaveiro.jpg', material: 'Rede de pesca', icone: 'key' },
];

/* jornada do produto: da coleta ao Fundo Infância, com dados reais do estado.
   Quando a peça já foi vendida, o QR é REAL e aponta para a página pública do
   turista (#/rastreio/CÓDIGO); antes disso não há código para escanear, e a
   tela diz isso em vez de mostrar um quadriculado decorativo. */
function Rastreio({ produto, state, onFechar }) {
  const venda = [...state.vendas].reverse()
    .find(v => v.tipo === 'produto' && v.descricao === produto.nome && v.rastreio);

  const daVenda = (venda?.origem || []).map(id => state.coletas.find(c => c.id === id)).filter(Boolean);
  const coleta = daVenda[daVenda.length - 1]
    || [...state.coletas].reverse().find(c => c.status === 'validada' && c.material.includes(produto.material.split(' ')[0]))
    || [...state.coletas].reverse().find(c => c.status === 'validada');
  const rel = [...state.relatorios].slice(-1)[0];
  const fundo = (venda?.valor ?? produto.preco) * SPLIT.fundo;

  const passos = [
    ['Material recuperado', coleta
      ? `${coleta.kg} kg de ${coleta.material} · ${coleta.local} · ${coleta.data}${coleta.geo ? ` · ${coleta.geo.lat}, ${coleta.geo.lng}` : ''}`
      : 'coleta comunitária em Boipeba'],
    ['Validação DeTrash', coleta?.signature
      ? `assinatura ${trunc(coleta.signature, 8, 8)}`
      : 'evidência verificada pela metodologia'],
    ['Relatório de Circularidade', rel ? `${rel.periodo} · ${rel.kg} kg consolidados` : 'em consolidação'],
    ['Feito por artesãs da ilha', 'renda direta e incondicional para quem produz (60%)'],
    ['Sua compra protege a infância', `${fmt(fundo)} desta peça vão direto ao Fundo Infância (cofre 2-de-3)`],
  ];

  return (
    <Modal
      titulo={`Rastreio · ${produto.nome}`}
      sub="cada produto conta sua história na rede"
      onFechar={onFechar}
      largura={560}
    >
      {venda ? (
        <div className="pn-rastreio-qr">
          <QrCode texto={urlRastreio(venda.rastreio)} lado={128} titulo={`Rastreio ${venda.rastreio}`} />
          <div className="pn-etiqueta">{venda.rastreio}</div>
        </div>
      ) : (
        <div className="pn-sem-etiqueta">
          <Icon name="tag" className="lg" />
          <span>a etiqueta com QR é gerada quando a peça é vendida</span>
        </div>
      )}

      <ol className="pn-rastreio-passos">
        {passos.map(([titulo, detalhe], i) => (
          <li key={titulo}>
            <span className="n">{i + 1}</span>
            <div>
              <b>{titulo}</b>
              <small>{detalhe}</small>
            </div>
          </li>
        ))}
      </ol>

      <p className="pn-hint" style={{ marginTop: 14 }}>
        {venda ? (
          <>
            Este QR é de verdade: aponte a câmera e ele abre a página pública desta peça.
            Na etiqueta física vai impresso junto do código <b>{venda.rastreio}</b>.
          </>
        ) : (
          'Venda a peça para gerar o código e a etiqueta.'
        )}
      </p>
    </Modal>
  );
}

/* A rampa --d1/--d2/--d3, a mesma da barra empilhada dos gráficos: escurece na
   mesma direção nos dois temas e passa em contraste com o texto por cima. Antes
   eram azul, verde e amarelo, três cores categóricas que faziam parecer que a
   fatia significava natureza diferente, e não tamanho diferente. */
const FATIAS = [
  { chave: 'renda', rot: 'Renda direta', sub: 'ao coletor, incondicional', pct: SPLIT.renda, tom: 'd1' },
  { chave: 'fundo', rot: 'Fundo Infância', sub: 'cofre multisig 2-de-3', pct: SPLIT.fundo, tom: 'd2' },
  { chave: 'operacao', rot: 'Operação', sub: 'logística e equipe local', pct: SPLIT.operacao, tom: 'd3' },
];

/* ---------------------------------------------------------------------------
   Animação do split: a cada venda o valor "se divide" em 3 barras, com
   contadores movidos por requestAnimationFrame.
--------------------------------------------------------------------------- */
function AnimacaoSplit({ venda }) {
  const [t, setT] = useState(0); // 0 a 1
  const rafRef = useRef(0);

  useEffect(() => {
    if (!venda) return;
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) { setT(1); return; }
    setT(0);
    let inicio = null;
    const passo = agora => {
      if (inicio === null) inicio = agora;
      const p = Math.min(1, (agora - inicio) / 1500);
      setT(1 - Math.pow(1 - p, 3));
      if (p < 1) rafRef.current = requestAnimationFrame(passo);
    };
    rafRef.current = requestAnimationFrame(passo);
    /* Mesmo motivo do useContagem em ui.jsx: sem quadros, `t` ficava em 0 e as
       três barras mostravam R$ 0,00 como se a venda tivesse rendido nada. */
    const fecho = setTimeout(() => setT(1), 1500 + 40);
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(fecho); };
  }, [venda]);

  if (!venda) {
    return (
      <Vazio
        titulo="Nenhuma venda nesta sessão"
        dica="Compre um produto ou financie um relatório ESG para ver a divisão automática acontecer."
      />
    );
  }

  const max = Math.max(...FATIAS.map(f => f.pct));

  return (
    <div className="pn-split-anim" key={venda.id}>
      <div className="pn-split-origem">
        <span className="pn-hint">{venda.descricao}</span>
        <div className="pn-split-total">{fmt(venda.valor)}</div>
        <span className="pn-hint">{venda.comprador}</span>
      </div>
      <div className="pn-split-barras">
        {FATIAS.map(f => (
          <div className="pn-split-linha" key={f.chave}>
            <div className="pn-split-rot">
              <b>{Math.round(f.pct * 100)}% · {f.rot}</b>
              <span className="pn-hint">{f.sub}</span>
            </div>
            <div className="pn-split-trilha">
              <div className={`pn-split-fill ${f.tom}`} style={{ width: (f.pct / max) * 100 * t + '%' }} />
            </div>
            <div className="pn-split-valor">{fmt(venda.valor * f.pct * t)}</div>
          </div>
        ))}
      </div>
      {/* Dizia "executada pelo contrato". Não há contrato executando o split: ele
          é código do aplicativo (aplicarSplit em store.jsx), aplicado no instante
          do registro. O que roda em contrato on-chain é a LIBERAÇÃO do fundo, com
          2-de-3 assinaturas, e isso a etapa Cofre mostra. Esta tela vai para o
          vídeo do pitch; nomear um contrato que não existe aqui é afirmar o que
          não se cumpre. */}
      {t >= 1 && (
        <div style={{ marginTop: 16 }}>
          <Nota tipo="i" icone="check">
            Divisão executada por código, no instante da venda, sem intermediário decidindo.
          </Nota>
        </div>
      )}
    </div>
  );
}

export default function Mercado() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [empresa, setEmpresa] = useState('');
  const [tipoEsg, setTipoEsg] = useState('esg');
  const [rastreio, setRastreio] = useState(null);
  const focoSplit = useDestaque('split');

  const kgDisponivel = state.coletas.filter(c => c.status === 'validada').reduce((a, c) => a + Number(c.kg), 0);

  // acompanha a venda mais recente para disparar a animação (inclusive no modo demo)
  const [ultima, setUltima] = useState(null);
  const nRef = useRef(state.vendas.length);
  useEffect(() => {
    if (state.vendas.length > nRef.current) setUltima(state.vendas[state.vendas.length - 1]);
    else if (state.vendas.length < nRef.current) setUltima(null); // reset da demo
    nRef.current = state.vendas.length;
  }, [state.vendas]);

  const comprarProduto = p => {
    // `materiais` liga a peça às coletas que forneceram a matéria-prima:
    // é o que faz o rastreio ser verdadeiro e não ilustrativo
    dispatch({ type: 'NOVA_VENDA', payload: { tipo: 'produto', descricao: p.nome, comprador: 'Turista', valor: p.preco, materiais: [p.material] } });
    toast(`${p.nome} vendido por ${fmt(p.preco)}`);
  };

  const comprarEsg = () => {
    const t = (kgDisponivel / 1000).toFixed(2);
    const desc = tipoEsg === 'esg' ? 'Relatório de Circularidade (patrocínio ESG)' : `Créditos de reciclagem (${t} t × R$ 250)`;
    const valor = tipoEsg === 'esg' ? 2500 : Math.max(1, Math.round(kgDisponivel / 1000 * 250));
    dispatch({ type: 'NOVA_VENDA', payload: { tipo: tipoEsg, descricao: desc, comprador: empresa || 'Empresa parceira', valor } });
    toast(`Impacto financiado: ${fmt(valor)} entrou no ciclo`);
    setEmpresa('');
  };

  return (
    <div className="pn-screen">
      <TelaCabecalho area="Operação · Mercado" titulo="Duas fontes de receita sobre o mesmo resíduo validado.">
        O turista leva a peça, a empresa leva a evidência. <b>A divisão 60/25/15 acontece no
        momento da venda, não no fim do mês.</b>
      </TelaCabecalho>

      <Grade colunas={2}>
        <Card>
          <CardCabecalho
            titulo="Turismo responsável"
            acessorio={<Pill tom="wait">{PRODUTOS.length} peças</Pill>}
          />
          <CardNota>
            Peças feitas com material recuperado na ilha. Cada compra alimenta o ciclo.
          </CardNota>
          <div style={{ marginTop: 8 }}>
            {PRODUTOS.map(p => (
              <div key={p.nome} className="pn-prod">
                <span className="pn-thumb" aria-hidden="true">
                  <Icon name={p.icone} className="lg" />
                  <img
                    src={'./produtos/' + p.img}
                    alt=""
                    loading="lazy"
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                  />
                </span>
                <div>
                  <div className="pn-prod-nome">{p.nome}</div>
                  <div className="pn-prod-meta">
                    {p.material} recuperado da ilha ·{' '}
                    <button type="button" className="pn-link" onClick={() => setRastreio(p)}>
                      rastrear origem
                    </button>
                  </div>
                </div>
                <div className="pn-prod-preco">
                  <div className="pn-mono">{fmt(p.preco)}</div>
                  <Botao tom="ghost" pequeno style={{ marginTop: 6 }} onClick={() => comprarProduto(p)}>
                    Comprar
                  </Botao>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Secao>
          <Card>
            <CardCabecalho titulo="Empresas (ESG)" />
            <CardNota>
              Financie resultados ambientais verificáveis.{' '}
              <b>{(kgDisponivel / 1000).toFixed(2)} t já validadas pela DeTrash</b> e disponíveis
              para relatório.
            </CardNota>
            <div style={{ marginTop: 16 }}>
              <Campo id="mer-empresa" rotulo="Empresa">
                <input
                  id="mer-empresa"
                  className="pn-inp"
                  value={empresa}
                  onChange={e => setEmpresa(e.target.value)}
                  placeholder="Ex.: Pousada Costa Verde"
                />
              </Campo>
              <Campo id="mer-produto" rotulo="Produto">
                <select
                  id="mer-produto"
                  className="pn-inp"
                  value={tipoEsg}
                  onChange={e => setTipoEsg(e.target.value)}
                >
                  <option value="esg">Relatório de Circularidade (R$ 2.500)</option>
                  <option value="credito">Créditos de reciclagem (R$ 250 por tonelada validada)</option>
                </select>
              </Campo>
              <Botao style={{ width: '100%' }} onClick={comprarEsg}>
                <Icon name="building" />
                Financiar impacto
              </Botao>
            </div>
          </Card>

          <Card>
            <CardCabecalho
              titulo="Divisão automática da receita"
              acessorio={<Pill tom="ok">por contrato</Pill>}
            />
            <CardNota>Acumulado do piloto sobre {fmt(state.vendas.reduce((a, v) => a + v.valor, 0))} de receita.</CardNota>
            <Grade colunas={4} style={{ marginTop: 16, gap: 18 }}>
              <div className="pn-kpi">
                <div className="l">Renda direta</div>
                <div className="v">60%</div>
                <ValorAnimado valor={state.caixas.renda} className="m" />
              </div>
              <div className="pn-kpi">
                <div className="l">Fundo Infância</div>
                <div className="v">25%</div>
                <ValorAnimado valor={state.caixas.fundo + state.caixas.fundoLiberado} className="m" />
              </div>
              <div className="pn-kpi">
                <div className="l">Operação</div>
                <div className="v">15%</div>
                <ValorAnimado valor={state.caixas.operacao} className="m" />
              </div>
              <div className="pn-kpi">
                <div className="l">vendas no piloto</div>
                <div className="v">{state.vendas.length}</div>
              </div>
            </Grade>
          </Card>
        </Secao>
      </Grade>

      {rastreio && <Rastreio produto={rastreio} state={state} onFechar={() => setRastreio(null)} />}

      <Secao className={focoSplit}>
        <RotuloSecao>A divisão, acontecendo</RotuloSecao>
        <Card>
          <AnimacaoSplit venda={ultima} />
        </Card>
      </Secao>

      <Secao>
        <RotuloSecao>Vendas realizadas</RotuloSecao>
        {state.vendas.length === 0 ? (
          <Vazio
            titulo="Nenhuma venda registrada"
            dica="Comece vendendo um produto do turismo responsável acima."
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <th>Data</th><th>Descrição</th><th>Comprador</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {[...state.vendas].reverse().map(v => (
                <tr key={v.id}>
                  <td className="pn-mono">{v.data}</td>
                  <td><strong>{v.descricao}</strong></td>
                  <td>{v.comprador}</td>
                  <td className="num">{fmt(v.valor)}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Secao>
    </div>
  );
}
