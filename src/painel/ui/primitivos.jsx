import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icones';
import './painel.css';

/* ---------------------------------------------------------------------------
   Os primitivos do painel.

   Componentes, e não classes soltas, porque a regra tem de ser difícil de
   quebrar por engano: quem escreve uma tela chama `<Pill tom="warn">` e ganha
   o ponto junto do texto sem precisar lembrar que estado nunca pode ser só
   cor. A classe existe embaixo, mas ninguém precisa saber o nome dela.

   Nenhum deles decide conteúdo. Todos recebem o texto pronto.
--------------------------------------------------------------------------- */

const junta = (...cs) => cs.filter(Boolean).join(' ');

/* ------------------------------------------------------------- estrutura -- */

export function Card({ className, pequeno, children, ...resto }) {
  return (
    <div className={junta('pn-card', pequeno && 'pad-s', className)} {...resto}>
      {children}
    </div>
  );
}

/** Título do card com um acessório opcional à direita (pílula, contador, hash). */
export function CardCabecalho({ titulo, acessorio, nivel: Nivel = 'h3' }) {
  return (
    <div className="pn-card-h">
      <Nivel className="pn-card-t">{titulo}</Nivel>
      {acessorio}
    </div>
  );
}

export function CardNota({ children, ...resto }) {
  return <p className="pn-card-n" {...resto}>{children}</p>;
}

export function Secao({ className, children, ...resto }) {
  return <div className={junta('pn-sect', className)} {...resto}>{children}</div>;
}

/** Rótulo de seção: texto curto e uma régua que ocupa o resto da linha. */
export function RotuloSecao({ children }) {
  return <div className="pn-sect-lab">{children}</div>;
}

/**
 * Grade. `colunas` aceita 2, 3, 4, '5-8' e '7-3'.
 * Todo filho recebe `min-width: 0` pelo CSS, que é o que impede a rolagem
 * horizontal quando o conteúdo interno não quer encolher.
 */
export function Grade({ colunas = 2, className, children, ...resto }) {
  const mapa = { 2: 'pn-g2', 3: 'pn-g3', 4: 'pn-g4', '5-8': 'pn-g-58', '7-3': 'pn-g-73' };
  return (
    <div className={junta('pn-grid', mapa[colunas], className)} {...resto}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------- estados --- */

/**
 * Pílula de estado: ponto mais texto, nunca só cor.
 * `tom` é semântico (ok, warn, crit, wait) e não tem relação com o verde da
 * marca, que fica reservado para ação primária e navegação.
 */
export function Pill({ tom = 'wait', quadrado, children }) {
  return (
    <span className={junta('pn-pill', tom, quadrado && 'sq')}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}

/** Aviso. `tipo` 'i' informa, 'w' pede atenção. */
export function Nota({ tipo = 'i', icone, children }) {
  return (
    <div className={junta('pn-note', tipo)}>
      <span className="ni" aria-hidden="true">
        {typeof icone === 'string' ? <Icon name={icone} /> : icone}
      </span>
      <div>{children}</div>
    </div>
  );
}

/** Estado vazio: o que é, o que faria aparecer, e o caminho para lá. */
export function Vazio({ titulo, dica, acao }) {
  return (
    <div className="pn-empty">
      <div className="t">{titulo}</div>
      {dica && <div className="d">{dica}</div>}
      {acao}
    </div>
  );
}

/* --------------------------------------------------------------- dados --- */

export function Mono({ className, children, ...resto }) {
  return <span className={junta('pn-mono', className)} {...resto}>{children}</span>;
}

/**
 * Hash, endereço ou identificador, com botão de copiar.
 *
 * O retorno da cópia é a cor do botão por 1,1 s, e não a troca do ícone por um
 * "copiado": trocar faria a largura do chip pular no meio da ação, e o desenho
 * do traço mudaria justo quando o olho está ali.
 */
export function HashChip({ texto, copia, rotulo = 'Copiar', className }) {
  const [copiado, setCopiado] = useState(false);
  const relogio = useRef(null);

  useEffect(() => () => clearTimeout(relogio.current), []);

  const copiar = useCallback(() => {
    const valor = copia ?? texto;
    try {
      navigator.clipboard?.writeText(valor);
    } catch {
      /* Sem permissão de área de transferência, o texto segue visível e
         selecionável, que é o plano B honesto. */
    }
    setCopiado(true);
    clearTimeout(relogio.current);
    relogio.current = setTimeout(() => setCopiado(false), 1100);
  }, [copia, texto]);

  return (
    <span className={junta('pn-hashchip', className)}>
      <span>{texto}</span>
      <button
        type="button"
        className={copiado ? 'copiado' : undefined}
        onClick={copiar}
        aria-label={`${rotulo}${copiado ? ' (copiado)' : ''}`}
      >
        <Icon name="copy" className="sm" />
      </button>
    </span>
  );
}

export function Ledger({ className, children, ...resto }) {
  return <div className={junta('pn-ledger', className)} {...resto}>{children}</div>;
}

/** Uma linha do ledger. Sem `valor`, ocupa a largura toda. */
export function LedgerLinha({ chave, valor, children }) {
  return (
    <div className={junta('pn-ledger-row', !valor && !children && 'solo')}>
      {children ?? <span className="k">{chave}</span>}
      {valor}
    </div>
  );
}

/** Link de auditoria para fora, sempre com o ícone de link externo. */
export function LinkAuditoria({ href, children }) {
  return (
    <a className="pn-xlink" href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <Icon name="ext" className="sm" />
    </a>
  );
}

/** Número grande com rótulo em caixa alta, e uma linha de apoio opcional. */
export function Fig({ valor, rotulo, apoio, className, style }) {
  return (
    <div className={junta('pn-fig', className)} style={style}>
      <div className="l">{rotulo}</div>
      <div className="v">{valor}</div>
      {apoio && <div className="s">{apoio}</div>}
    </div>
  );
}

/** Fileira de figuras coladas, separadas só pela linha de 1px. */
export function FigRow({ colunas = 3, children, className, style }) {
  return (
    <div
      className={junta('pn-figrow', className)}
      style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))`, ...style }}
    >
      {children}
    </div>
  );
}

/** Barra de progresso. `alerta` pinta com o token de atenção. */
export function Medidor({ pct, alerta }) {
  return (
    <div className={junta('pn-meter', alerta && 'alerta')} aria-hidden="true">
      <i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

/* ---------------------------------------------------------- formulário --- */

export function Botao({ tom = 'primario', pequeno, className, children, ...resto }) {
  return (
    <button
      type="button"
      className={junta('pn-btn', tom === 'ghost' && 'ghost', pequeno && 'sm', className)}
      {...resto}
    >
      {children}
    </button>
  );
}

/**
 * Campo com rótulo amarrado ao controle.
 *
 * O `id` é obrigatório de propósito: sem ele o rótulo não aponta para nada, e
 * tocar no texto não põe o foco no campo. O linter cobra isso como erro em todo
 * o painel.
 */
export function Campo({ id, rotulo, dica, children, className }) {
  return (
    <div className={junta('pn-field', className)}>
      <label htmlFor={id}>{rotulo}</label>
      {children}
      {dica && <p className="pn-hint">{dica}</p>}
    </div>
  );
}

export function Caixa({ id, children, ...resto }) {
  return (
    <label className="pn-check" htmlFor={id}>
      <input type="checkbox" id={id} {...resto} />
      <span className="cl">{children}</span>
    </label>
  );
}

/** Tabela larga sempre no próprio container rolável, nunca empurrando a página. */
export function Tabela({ children, className }) {
  return (
    <div className={junta('pn-tbl-wrap', className)}>
      <table>{children}</table>
    </div>
  );
}
