import './icones.css';

/* ---------------------------------------------------------------------------
   Os ícones do painel.

   Um sprite de `<symbol>` montado uma vez, e um `<Icon name="…" />` que só
   aponta para ele com `<use>`. Assim o mesmo desenho aparece dez vezes na tela
   sem dez cópias no DOM, e trocar um ícone é mexer num lugar só.

   Todos no mesmo sistema: caixa 16×16, traço de 1.45, sem preenchimento, pontas
   e junções arredondadas, `currentColor`. É o que faz um ícone ao lado de um
   texto parecer da mesma família que a letra, em vez de um adesivo colado.

   Nenhum emoji na interface: emoji muda de desenho conforme o sistema
   operacional, não herda a cor do texto, e alguns são lidos em voz alta pelo
   leitor de tela com nomes que não dizem nada no contexto ("rosto sorridente
   com olhos de coração" no meio de um saldo). Ícone de traço não tem nenhum
   desses três problemas.
--------------------------------------------------------------------------- */

/** Monte uma vez, no topo do painel. Fora da árvore de acessibilidade. */
export function SpriteIcones() {
  return (
    <svg className="sprite-icones" aria-hidden="true" focusable="false">
      <defs>
        <symbol id="i-copy" viewBox="0 0 16 16"><rect x="5.6" y="5.6" width="7.8" height="7.8" rx="1.6" /><path d="M10.4 3.4H4a1.4 1.4 0 0 0-1.4 1.4v6.4" /></symbol>
        <symbol id="i-ext" viewBox="0 0 16 16"><path d="M9.2 3.2h3.6v3.6M12.8 3.2 7.6 8.4" /><path d="M12.2 9.6v2.6a1.4 1.4 0 0 1-1.4 1.4H3.8a1.4 1.4 0 0 1-1.4-1.4V5.2a1.4 1.4 0 0 1 1.4-1.4h2.6" /></symbol>
        <symbol id="i-check" viewBox="0 0 16 16"><path d="m3.4 8.4 3 3 6.2-6.6" /></symbol>
        <symbol id="i-close" viewBox="0 0 16 16"><path d="m4 4 8 8M12 4l-8 8" /></symbol>
        <symbol id="i-download" viewBox="0 0 16 16"><path d="M8 2.6v7.6M5 7.6 8 10.6l3-3M2.8 12.6h10.4" /></symbol>
        <symbol id="i-gear" viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.1" /><path d="M8 1.9v1.6M8 12.5v1.6M13.1 8h-1.6M4.5 8H2.9M11.6 4.4l-1.1 1.1M5.5 10.5l-1.1 1.1M11.6 11.6l-1.1-1.1M5.5 5.5 4.4 4.4" /></symbol>
        <symbol id="i-help" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.8" /><path d="M6.4 6.3a1.7 1.7 0 0 1 3.3.5c0 1.1-1.7 1.4-1.7 2.5" /><path d="M8 11.5v.1" strokeWidth="1.8" /></symbol>
        <symbol id="i-sound" viewBox="0 0 16 16"><path d="M7.6 3.2 4.8 5.6H2.6v4.8h2.2l2.8 2.4V3.2Z" /><path d="M10.4 6a3 3 0 0 1 0 4" /></symbol>
        <symbol id="i-left" viewBox="0 0 16 16"><path d="M9.6 3.6 5.2 8l4.4 4.4" /></symbol>
        <symbol id="i-right" viewBox="0 0 16 16"><path d="M6.4 3.6 10.8 8l-4.4 4.4" /></symbol>
        <symbol id="i-alert" viewBox="0 0 16 16"><path d="M8 2.6 14 13H2L8 2.6Z" /><path d="M8 6.6v2.8" /><path d="M8 11.2v.1" strokeWidth="1.8" /></symbol>
        <symbol id="i-coin" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.8" /><path d="M8 4.8v6.4M9.9 6.2a2 2 0 0 0-1.9-1c-1 0-1.9.6-1.9 1.5 0 2 3.8 1 3.8 3 0 .9-.9 1.5-1.9 1.5a2 2 0 0 1-1.9-1" /></symbol>
        <symbol id="i-scan" viewBox="0 0 16 16"><path d="M2.6 5.6V3.8a1.2 1.2 0 0 1 1.2-1.2h1.8M13.4 5.6V3.8a1.2 1.2 0 0 0-1.2-1.2h-1.8M2.6 10.4v1.8a1.2 1.2 0 0 0 1.2 1.2h1.8M13.4 10.4v1.8a1.2 1.2 0 0 1-1.2 1.2h-1.8" /><circle cx="8" cy="8" r="1.9" /></symbol>
        <symbol id="i-shield" viewBox="0 0 16 16"><path d="M8 2.2 3.2 4v4.1c0 2.6 2 4.6 4.8 5.7 2.8-1.1 4.8-3.1 4.8-5.7V4L8 2.2Z" /><path d="m6.1 8.1 1.4 1.4 2.6-2.8" /></symbol>
        <symbol id="i-type" viewBox="0 0 16 16"><path d="M2.4 12.6 6 3.4l3.6 9.2M3.6 9.8h4.8M11.2 12.6l1.9-5 1.9 5M11.9 10.9h2.4" /></symbol>
        <symbol id="i-lock" viewBox="0 0 16 16"><rect x="3.4" y="7" width="9.2" height="6.4" rx="1.5" /><path d="M5.7 7V5.3a2.3 2.3 0 0 1 4.6 0V7" /></symbol>
        <symbol id="i-guide" viewBox="0 0 16 16"><circle cx="8" cy="5.9" r="2.6" /><path d="M3.1 13.4a4.9 4.9 0 0 1 9.8 0" /></symbol>
        <symbol id="i-sun" viewBox="0 0 16 16"><circle cx="8" cy="8" r="3.1" /><path d="M8 1.4v1.5M8 13.1v1.5M14.6 8h-1.5M2.9 8H1.4M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1M12.7 12.7l-1.1-1.1M4.4 4.4 3.3 3.3" /></symbol>
        <symbol id="i-moon" viewBox="0 0 16 16"><path d="M13.2 9.6A5.7 5.7 0 0 1 6.4 2.8a5.7 5.7 0 1 0 6.8 6.8Z" /></symbol>
        <symbol id="i-search" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.6" /><path d="M10.6 10.6 14 14" /></symbol>
        <symbol id="i-bell" viewBox="0 0 16 16"><path d="M8 2a3.6 3.6 0 0 0-3.6 3.6v2.1L3.2 10h9.6l-1.2-2.3V5.6A3.6 3.6 0 0 0 8 2Z" /><path d="M6.4 12a1.6 1.6 0 0 0 3.2 0" /></symbol>
        <symbol id="i-menu" viewBox="0 0 16 16"><path d="M2.6 4.4h10.8M2.6 8h10.8M2.6 11.6h10.8" /></symbol>
        <symbol id="i-play" viewBox="0 0 16 16"><path d="M4.6 3.2 12.4 8l-7.8 4.8V3.2Z" /></symbol>

        {/* Produtos do turismo responsável. Caixa 20 porque vêm da referência
            com essa proporção; o traço é o mesmo. */}
        <symbol id="i-lamp" viewBox="0 0 20 20"><path d="M7 3h6l1.4 5.2a4.6 4.6 0 0 1-8.8 0L7 3Z" /><path d="M10 13v4M7.6 17h4.8" /></symbol>
        <symbol id="i-bag" viewBox="0 0 20 20"><path d="M4.5 7h11l-1 9.5h-9L4.5 7Z" /><path d="M7.5 7V5.4a2.5 2.5 0 0 1 5 0V7" /></symbol>
        <symbol id="i-pot" viewBox="0 0 20 20"><path d="M5.5 9h9l-1.1 7.5h-6.8L5.5 9Z" /><path d="M10 9c0-2.4 1.6-4.2 4-4.6M10 9c0-1.9-1.3-3.3-3.4-3.6" /></symbol>
        <symbol id="i-key" viewBox="0 0 20 20"><circle cx="7.5" cy="7.5" r="3.4" /><path d="M10.2 10.2 16 16M13.4 13.4l1.6-1.6" /></symbol>
        <symbol id="i-building" viewBox="0 0 16 16"><path d="M2.6 13.4V4.2a1 1 0 0 1 1-1h5.2a1 1 0 0 1 1 1v9.2" /><path d="M9.8 6.8h2.8a1 1 0 0 1 1 1v5.6" /><path d="M1.6 13.4h12.8M5 6h2M5 8.6h2M5 11.2h2" /></symbol>
        <symbol id="i-tag" viewBox="0 0 16 16"><path d="M2.6 8.2V3.4a.8.8 0 0 1 .8-.8h4.8l5.2 5.2a1.1 1.1 0 0 1 0 1.6l-4 4a1.1 1.1 0 0 1-1.6 0L2.6 8.2Z" /><path d="M5.6 5.6v.01" strokeWidth="1.8" /></symbol>
        {/* Navegação do redesign: início, trilha, cofre e família. */}
        <symbol id="i-home" viewBox="0 0 16 16"><path d="M2.4 7.4 8 3l5.6 4.4v5.4a.8.8 0 0 1-.8.8H9.8V9.8H6.2v3.8H3.2a.8.8 0 0 1-.8-.8Z" /></symbol>
        <symbol id="i-trilha" viewBox="0 0 16 16"><circle cx="4" cy="4" r="1.7" /><circle cx="12" cy="12" r="1.7" /><path d="M5.7 4h3.6a2.7 2.7 0 0 1 0 5.4H6.7a2.7 2.7 0 0 0 0 5.4" /></symbol>
        <symbol id="i-cofre" viewBox="0 0 16 16"><rect x="2.4" y="3.2" width="11.2" height="10" rx="1.4" /><circle cx="8" cy="8.2" r="2.3" /><path d="M8 5.9v.7M8 9.8v.7M5.7 8.2h.7M9.6 8.2h.7" /></symbol>
        <symbol id="i-casa" viewBox="0 0 16 16"><path d="M2.4 13.6V6.8L8 3l5.6 3.8v6.8" /><path d="M6.2 13.6V9.8h3.6v3.8" /></symbol>
        <symbol id="i-ia" viewBox="0 0 16 16"><rect x="3.2" y="3.2" width="9.6" height="9.6" rx="1.8" /><path d="M6.2 6.2h3.6v3.6H6.2zM6 1.6v1.6M10 1.6v1.6M6 12.8v1.6M10 12.8v1.6M1.6 6h1.6M1.6 10h1.6M12.8 6h1.6M12.8 10h1.6" /></symbol>
        <symbol id="i-viva" viewBox="0 0 16 16"><circle cx="6" cy="5.4" r="2" /><circle cx="11.4" cy="6" r="1.6" /><path d="M2 13.4a4 4 0 0 1 8 0M9.4 13.4a3 3 0 0 1 5-2.2" /></symbol>
        <symbol id="i-mercado" viewBox="0 0 16 16"><path d="M2.6 6 3.6 2.8h8.8L13.4 6" /><path d="M2.6 6h10.8v1.2a2 2 0 0 1-3.6 1.2 2 2 0 0 1-3.6 0 2 2 0 0 1-3.6-1.2Z" /><path d="M3.4 8.8v4.6h9.2V8.8" /></symbol>
        <symbol id="i-split" viewBox="0 0 16 16"><path d="M2.4 8h3.2l2.2-3.4h5.8M13.6 4.6l-1.8-1.6M13.6 4.6l-1.8 1.6" /><path d="M5.6 8l2.2 3.4h5.8M13.6 11.4l-1.8-1.6M13.6 11.4l-1.8 1.6" /></symbol>

        {/* App da Família. Cada um destes substitui um emoji que estava no
            lugar: o desenho passa a herdar a cor do texto, a ficar igual em
            todo aparelho, e a não ser lido em voz alta com um nome de catálogo
            no meio de um saldo. */}
        <symbol id="i-caranguejo" viewBox="0 0 20 20"><path d="M6 11.2a4 4 0 0 1 8 0" /><path d="M6.6 8.2 5.2 6.4M13.4 8.2l1.4-1.8M8.4 7.4V5.8M11.6 7.4V5.8" /><path d="M6.1 11.6H4.3l-1.6 1.5M13.9 11.6h1.8l1.6 1.5M6.4 12.6l-2 1.8M13.6 12.6l2 1.8M8.4 12.8l-.8 2.4M11.6 12.8l.8 2.4" /></symbol>
        <symbol id="i-estrela" viewBox="0 0 16 16"><path d="m8 2.4 1.7 3.5 3.9.5-2.8 2.7.7 3.8L8 11.1l-3.5 1.8.7-3.8L2.4 6.4l3.9-.5L8 2.4Z" /></symbol>
        <symbol id="i-medalha" viewBox="0 0 16 16"><circle cx="8" cy="10.2" r="3.4" /><path d="M6 7.1 4.2 2.4M10 7.1l1.8-4.7M6.6 2.4h2.8" /></symbol>
        <symbol id="i-alvo" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.6" /><circle cx="8" cy="8" r="2.4" /><path d="M8 8h.01" strokeWidth="1.8" /></symbol>
        <symbol id="i-clipe" viewBox="0 0 16 16"><path d="M12.4 7.4 7.7 12a2.9 2.9 0 0 1-4.1-4.1l5.2-5.2a1.9 1.9 0 0 1 2.7 2.7L6.2 10.7a.9.9 0 0 1-1.3-1.3l4.6-4.6" /></symbol>
        <symbol id="i-lista" viewBox="0 0 16 16"><rect x="3.4" y="2.8" width="9.2" height="10.4" rx="1.4" /><path d="M6 2.8V2a.8.8 0 0 1 .8-.8h2.4A.8.8 0 0 1 10 2v.8" /><path d="M5.8 7h4.4M5.8 9.8h3" /></symbol>
        <symbol id="i-celular" viewBox="0 0 16 16"><rect x="4.4" y="1.8" width="7.2" height="12.4" rx="1.6" /><path d="M7 3.6h2M7.2 12.2h1.6" /></symbol>
        <symbol id="i-conversa" viewBox="0 0 16 16"><path d="M13.4 8.6a4.9 4.9 0 0 1-5.3 4.8L3 14.2l.9-3.6A4.9 4.9 0 1 1 13.4 8.6Z" /><path d="M6 8h4" /></symbol>
        <symbol id="i-ligar" viewBox="0 0 16 16"><path d="M5.2 2.6 6.9 6l-1.5 1.5a8.7 8.7 0 0 0 3.1 3.1L10 9.1l3.4 1.7v2a1.2 1.2 0 0 1-1.3 1.2A11 11 0 0 1 2 3.9a1.2 1.2 0 0 1 1.2-1.3h2Z" /></symbol>
        <symbol id="i-relogio" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.7" /><path d="M8 4.7V8l2.2 1.6" /></symbol>
        <symbol id="i-dinheiro" viewBox="0 0 16 16"><rect x="1.8" y="4.2" width="12.4" height="7.6" rx="1.4" /><circle cx="8" cy="8" r="1.8" /><path d="M4.3 8h.01M11.7 8h.01" strokeWidth="1.8" /></symbol>
        <symbol id="i-copo" viewBox="0 0 16 16"><path d="M3.2 4.4h8v4.4a4 4 0 0 1-8 0V4.4Z" /><path d="M11.2 5.6h1.4a1.6 1.6 0 0 1 0 3.2h-1.4M2.8 13.6h8.8" /></symbol>
        <symbol id="i-teclado" viewBox="0 0 16 16"><rect x="2.4" y="2.4" width="11.2" height="11.2" rx="1.6" /><path d="M6 2.4v11.2M10 2.4v11.2M2.4 6h11.2M2.4 10h11.2" /></symbol>
        <symbol id="i-sem-olho" viewBox="0 0 16 16"><path d="M6.3 4.1A6.6 6.6 0 0 1 8 3.9c3.3 0 5.6 2.6 6.3 4.1a8.7 8.7 0 0 1-1.9 2.4M3.6 5.6A8.8 8.8 0 0 0 1.7 8c.7 1.5 3 4.1 6.3 4.1a6.5 6.5 0 0 0 2.2-.4" /><path d="m2.4 2.4 11.2 11.2" /><path d="M6.6 6.7a2 2 0 0 0 2.8 2.7" /></symbol>
        <symbol id="i-maos" viewBox="0 0 16 16"><path d="M1.8 7.4 4.4 5l2.4 1.8 1.6-.8 3.8 2.8a1.1 1.1 0 0 1-1.3 1.8L9 9.2" /><path d="m14.2 7.4-2.3-2.2M6.2 10.4l1.8 1.4a1.1 1.1 0 0 0 1.5-.2M8.6 12.6l1.2.9a1 1 0 0 0 1.4-.2" /></symbol>
        <symbol id="i-partilhar" viewBox="0 0 16 16"><path d="M8 10.6V2.6M5.4 5.2 8 2.6l2.6 2.6" /><path d="M3.4 9.6v2.8a1.4 1.4 0 0 0 1.4 1.4h6.4a1.4 1.4 0 0 0 1.4-1.4V9.6" /></symbol>
        <symbol id="i-sem-sinal" viewBox="0 0 16 16"><path d="M2.2 6.2a9 9 0 0 1 3.4-2M13.8 6.2a9 9 0 0 0-2.6-1.7M4.7 8.7a5.6 5.6 0 0 1 1.7-1M11.3 8.7a5.6 5.6 0 0 0-1.3-.9" /><path d="M8 12.4h.01" strokeWidth="1.9" /><path d="m2.4 2.4 11.2 11.2" /></symbol>
        <symbol id="i-sem-som" viewBox="0 0 16 16"><path d="M7.6 3.2 4.8 5.6H2.6v4.8h2.2l2.8 2.4V3.2Z" /><path d="m10.4 6.6 3 2.8M13.4 6.6l-3 2.8" /></symbol>
      </defs>
    </svg>
  );
}

/**
 * Um ícone do sprite.
 *
 * Decorativo por padrão (`aria-hidden`), porque na esmagadora maioria dos casos
 * ele repete o que o texto ao lado já diz, e anunciar duas vezes atrapalha.
 * Botão só de ícone não usa `titulo` daqui: põe `aria-label` no próprio botão,
 * que é o elemento que recebe o foco.
 */
export function Icon({ name, className = '', titulo, ...resto }) {
  const rotulado = Boolean(titulo);
  return (
    <svg
      className={`ic${className ? ` ${className}` : ''}`}
      role={rotulado ? 'img' : undefined}
      aria-hidden={rotulado ? undefined : 'true'}
      aria-label={titulo}
      focusable="false"
      {...resto}
    >
      <use href={`#i-${name}`} />
    </svg>
  );
}

export default Icon;
