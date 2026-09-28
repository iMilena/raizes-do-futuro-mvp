/* ---------------------------------------------------------------------------
   O lote de exemplo da página de investidores.

   A página publica uma raiz de Merkle e convida o leitor a recalculá-la. Este
   teste garante que o convite não é blefe: a raiz escrita na página é a que o
   código produz, e a prova de inclusão fecha contra ela.
--------------------------------------------------------------------------- */
import { describe, expect, it } from 'vitest';
import { RAIZ_PUBLICADA, montarLoteExemplo, verificarLoteExemplo } from '../../src/investidores/lote-exemplo.js';

describe('lote de exemplo da página de investidores', () => {
  it('a raiz publicada é a que o código calcula', () => {
    expect(montarLoteExemplo().arvore.raiz).toBe(RAIZ_PUBLICADA);
  });

  it('a verificação no navegador confere raiz e prova de inclusão', () => {
    const r = verificarLoteExemplo();
    expect(r.raizConfere).toBe(true);
    expect(r.provaConfere).toBe(true);
  });

  it('o lote tem as sete coletas do exemplo, com as sinalizações dos detectores', () => {
    const { payload } = montarLoteExemplo();
    expect(payload.quantidadeRegistros).toBe(7);
    expect(payload.quantidadeSinalizados).toBeGreaterThanOrEqual(3);
  });
});
