/* ---------------------------------------------------------------------------
   Retenção da foto no aparelho.

   A foto é o único dado pessoal de verdade que o módulo produz: pode ter pessoa
   ao fundo, casa, placa, rosto de quem passava. O pHash dela não reconstrói
   imagem nenhuma, e é ele que sustenta a evidência. Logo, a foto tem prazo, e a
   evidência não.

   Isto é o que torna concreta a decisão de manter foto fora da cadeia: passado o
   prazo, o dado pessoal some do aparelho e o registro continua auditável, com
   hash, assinatura e prova de inclusão intactos.

   Uma exceção, e só uma: foto de registro que foi sinalizado e ainda espera
   decisão humana não é apagada. Apagar a evidência que a coordenação precisa
   olhar transformaria a revisão em carimbo. Quando a decisão sai, o prazo volta
   a correr normalmente.

   Por que roda na abertura do app, e não num temporizador: o aparelho do catador
   passa a maior parte do tempo desligado ou com o app fechado, e tarefa de fundo
   em PWA não tem garantia nenhuma de execução. Abrir o app é o único momento em
   que temos certeza de que o código roda.
--------------------------------------------------------------------------- */
import type { BancoLocal } from './bd.js';

/**
 * Prazo padrão, em dias.
 *
 * 30 dias cobre com folga o ciclo de revisão (a coordenação olha a fila em dias,
 * não em meses) e o fechamento do lote diário. Prazo é decisão de operação e de
 * política de privacidade, não de código: por isso é parâmetro.
 */
export const DIAS_RETENCAO_PADRAO = 30;

export interface ResultadoRetencao {
  apagadas: number;
  /** Fotos mantidas por estarem em registro que ainda espera revisão humana. */
  mantidasPorRevisao: number;
}

export async function aplicarRetencao(
  banco: BancoLocal,
  opcoes: { dias?: number; agora?: () => Date } = {},
): Promise<ResultadoRetencao> {
  const dias = opcoes.dias ?? DIAS_RETENCAO_PADRAO;
  const agora = (opcoes.agora ?? (() => new Date()))();
  const limite = new Date(agora.getTime() - dias * 86_400_000);

  let apagadas = 0;
  let mantidasPorRevisao = 0;

  for (const guardado of await banco.listarRegistros()) {
    const foto = await banco.lerFoto(guardado.id);
    if (!foto) continue;
    if (new Date(foto.criadoEm) >= limite) continue;

    const { sinalizacoes, revisao } = guardado.registro;
    if (sinalizacoes.length > 0 && revisao === null) {
      mantidasPorRevisao++;
      continue;
    }
    await banco.apagarFoto(guardado.id);
    apagadas++;
  }

  return { apagadas, mantidasPorRevisao };
}
