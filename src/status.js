/* ---------------------------------------------------------------------------
   Em que pé o projeto está, num lugar só.

   O site em português e a página de investidores em inglês leem daqui. Hoje a
   coleta ainda não começou, e é isso que as duas páginas dizem.

   QUANDO O PRIMEIRO LOTE REAL ACONTECER EM BOIPEBA, a troca é só aqui:

     1. `fase` passa de 'implantacao' para 'piloto';
     2. `real` recebe os números medidos, com a data em que foram conferidos.

   As metas continuam aparecendo como metas. Os números reais entram AO LADO
   delas, nunca no lugar: a distância entre um e outro é justamente o que um
   investidor quer ver.

   Deixe `null` o que ainda não foi medido. A página mostra só o que tiver
   número, e não inventa zero.
--------------------------------------------------------------------------- */

export const STATUS = {
  /** 'implantacao' (ainda sem coleta) ou 'piloto' (primeiro lote já aconteceu). */
  fase: 'implantacao',

  /**
   * Números reais do piloto. Exemplo de como preencher:
   *
   *   real: {
   *     conferidoEm: '2026-11-05',
   *     toneladas: 0.84,
   *     familias: 12,
   *     criancas: 23,
   *     lotes: 3,
   *     // o primeiro lote ancorado, para quem quiser conferir na rede
   *     primeiroLote: { data: '2026-10-21', raiz: '0x…', tx: 'https://explorer.solana.com/tx/…?cluster=devnet' },
   *   },
   */
  real: null,
};

export const emPiloto = () => STATUS.fase === 'piloto';
