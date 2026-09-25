import { useEffect, useMemo, useState } from 'react';
import { Foto } from '../landing/components/Foto';
import * as fotos from '../landing/images';
import { URL_CONTATO } from '../config.js';

/* ---------------------------------------------------------------------------
   O conteúdo do painel lateral de um ponto do mapa: foto real, texto, número
   e, nas etapas que têm, um bloco a mais (os detectores, a divisão do cofre ou
   as 60 crianças).
--------------------------------------------------------------------------- */

function Detectores() {
  return (
    <>
      <div className="det">
        Pilha recontada<em>OK</em>
      </div>
      <div className="det">
        Sequência improvável<em>OK</em>
      </div>
      <div className="det">
        Foto reaproveitada (pHash)<em className="w">Conferir</em>
      </div>
      <div className="det">
        Peso incoerente<em>OK</em>
      </div>
      <p className="p-text" style={{ fontSize: 13 }}>
        O coletor é pseudonimizado. Só a raiz de Merkle e os totais do lote diário vão para a cadeia.
      </p>
    </>
  );
}

/** As barras crescem até a largura real um quadro depois de montar. */
function DivisaoDoCofre() {
  const [cheio, setCheio] = useState(false);
  useEffect(() => {
    const q = requestAnimationFrame(() => setCheio(true));
    return () => cancelAnimationFrame(q);
  }, []);
  const linhas = [
    [60, 'Renda direta, sem condições, para quem faz o trabalho ambiental', 'var(--mint)'],
    [25, 'Fundo Infância, bônus por criança', 'var(--dawn)'],
    [15, 'Operação: validação, logística e infraestrutura', 'var(--foam)'],
  ];
  return (
    <>
      <div className="split">
        {linhas.map(([pct, txt, cor]) => (
          <div className="row" key={pct}>
            <b>{pct}%</b>
            <div>
              {txt}
              <div className="bar" aria-hidden="true">
                <i style={{ width: cheio ? `${pct}%` : 0, background: cor }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="sigs">
        <div className="sig">
          <small>Assinatura 1</small>Instituto Vivá
        </div>
        <div className="sig">
          <small>Assinatura 2</small>DeTrash
        </div>
        <div className="sig">
          <small>Assinatura 3</small>Representante comunitário
        </div>
      </div>
    </>
  );
}

/** As 60 crianças, com as 51 em dia acendendo uma a uma em ordem sorteada. */
function Criancas({ reduzir }) {
  const ordem = useMemo(() => {
    const o = [...Array(60).keys()];
    for (let i = o.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [o[i], o[j]] = [o[j], o[i]];
    }
    return o.slice(0, 51);
  }, []);
  const [acesas, setAcesas] = useState(() => (reduzir ? 51 : 0));
  useEffect(() => {
    if (reduzir) return undefined;
    let n = 0;
    let t = setTimeout(function passo() {
      n++;
      setAcesas(n);
      if (n < 51) t = setTimeout(passo, 20);
    }, 300);
    return () => clearTimeout(t);
  }, [reduzir]);
  const on = new Set(ordem.slice(0, acesas));
  return (
    <>
      <div className="kids" role="img" aria-label="Exemplo: 51 de 60 crianças com saúde e escola em dia">
        {[...Array(60).keys()].map((i) => (
          <i key={i} className={on.has(i) ? 'on' : undefined} />
        ))}
      </div>
      <div className="kleg">
        <span>Em dia</span>
        <span>Acompanhamento em curso</span>
      </div>
    </>
  );
}

export function PainelPonto({ p, reduzir, aoIrPara }) {
  const [carregou, setCarregou] = useState(false);
  const imagem = p.foto ? fotos[p.foto] : null;

  return (
    <div className={imagem ? undefined : 'p-nomedia'}>
      {imagem && (
        <figure className="p-media">
          <Foto
            imagem={imagem}
            alt={p.alt}
            sizes="(max-width: 760px) 100vw, 430px"
            prioridade
            className={carregou ? 'ok' : undefined}
            onLoad={() => setCarregou(true)}
          />
          <figcaption>{p.cap}</figcaption>
        </figure>
      )}
      <div className="p-in">
        <div className="p-eyebrow caps">{p.et}</div>
        <h2 className="p-title" id="ex-painel-titulo">
          {p.title}
        </h2>
        <div className="p-local">{p.local}</div>
        <p className="p-text">{p.text}</p>
        {p.num && (
          <div className="p-num">
            <b>{p.num[0]}</b>
            <span>{p.num[1]}</span>
          </div>
        )}
        {p.extra && (
          <div className="p-extra">
            {p.extra === 'detectores' && <Detectores />}
            {p.extra === 'cofre' && <DivisaoDoCofre />}
            {p.extra === 'criancas' && <Criancas reduzir={reduzir} />}
          </div>
        )}
        <div className="tags">
          {p.tags.map((t) => (
            <span className="tag" key={t}>
              {t}
            </span>
          ))}
        </div>
        {p.n ? (
          <a className="p-cta" href={`${URL_CONTATO}?tipo=investimento`}>
            Investir no projeto
          </a>
        ) : (
          <button type="button" className="p-cta" onClick={() => aoIrPara('coleta')}>
            Ver o ciclo na ilha
          </button>
        )}
      </div>
    </div>
  );
}

export default PainelPonto;
