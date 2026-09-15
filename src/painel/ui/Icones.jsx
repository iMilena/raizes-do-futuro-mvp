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
        <symbol id="i-split" viewBox="0 0 16 16"><path d="M2.4 8h3.2l2.2-3.4h5.8M13.6 4.6l-1.8-1.6M13.6 4.6l-1.8 1.6" /><path d="M5.6 8l2.2 3.4h5.8M13.6 11.4l-1.8-1.6M13.6 11.4l-1.8 1.6" /></symbol>
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
