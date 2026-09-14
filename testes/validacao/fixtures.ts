/* Conteúdo de registro válido, para os testes não repetirem dez campos cada um.

   Os valores imitam uma coleta real de Boipeba: o geohash 7js6dd7 é a faixa da
   ilha (Velha Boipeba), o ponto é a Praia de Cueira, e o pseudônimo tem o formato
   de um HMAC de verdade, ainda que o valor seja inventado. */
import type { ConteudoRegistro } from '../../src/validacao/dominio/tipos.js';

export function conteudoDeTeste(mudancas: Partial<ConteudoRegistro> = {}): ConteudoRegistro {
  return {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    versaoEsquema: 'evidencia-coleta-v1',
    classificacao: {
      classeSugerida: 'PET',
      confianca: 0.92,
      classeFinal: 'PET',
      corrigidoPorHumano: false,
      versaoModelo: 'classificador-v1',
    },
    pesoKg: 12.5,
    ocupacaoQuadro: 0.42,
    pHash: 'f0e1d2c3b4a59687',
    geohash: '7js6dd7',
    timestampDispositivo: '2026-09-14T09:12:00.000Z',
    pontoColetaId: 'ponto-cueira',
    coletorPseudonimo: 'a'.repeat(64),
    ...mudancas,
  };
}
