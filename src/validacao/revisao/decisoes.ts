/* ---------------------------------------------------------------------------
   A decisão humana sobre um registro sinalizado.

   O módulo inteiro existe para que esta frase seja verdade no código, e não só
   no discurso: o sistema aponta, a pessoa decide. Aqui é onde a pessoa decide.

   Três regras, e cada uma resolve um jeito de a revisão virar carimbo:

   1. JUSTIFICATIVA OBRIGATÓRIA, E NÃO TRIVIAL. "ok" não é justificativa. Quem
      aprova um registro sinalizado precisa dizer o que descobriu, porque é esse
      texto que a auditoria vai ler daqui a um ano, e é ele que protege tanto a
      coordenação quanto o coletor.

   2. AUTOR OBRIGATÓRIO. Decisão sem autor não é decisão, é o sistema decidindo
      com outro nome.

   3. DECISÃO NÃO SE APAGA. Mudar uma decisão já registrada exige passar
      `substituindo`, e a justificativa nova tem de explicar a mudança. Revisão
      que pode ser reescrita em silêncio não serve de evidência.

   Nada aqui muda o conteúdo nem o hash do registro: a decisão é metadado. A
   evidência de campo continua sendo o que o catador registrou, inclusive quando
   a revisão a rejeita.
--------------------------------------------------------------------------- */
import type { DecisaoRevisao, RegistroEvidencia } from '../dominio/tipos.js';
import { hashConfere } from '../dominio/registro.js';

export const TAMANHO_MINIMO_JUSTIFICATIVA = 12;

export class ErroDecisao extends Error {}

export interface PedidoDecisao {
  decisao: 'aprovado' | 'rejeitado';
  /** Identificador de quem revisa na operação, não nome de pessoa. */
  autor: string;
  justificativa: string;
  /** Verdadeiro para trocar uma decisão já registrada. */
  substituindo?: boolean;
  agora?: () => Date;
}

export function validarPedido(pedido: PedidoDecisao, registro: RegistroEvidencia): string[] {
  const problemas: string[] = [];

  if (!pedido.autor?.trim()) problemas.push('a decisão precisa de um autor');
  const justificativa = pedido.justificativa?.trim() ?? '';
  if (justificativa.length < TAMANHO_MINIMO_JUSTIFICATIVA) {
    problemas.push(
      `escreva o que você verificou (pelo menos ${TAMANHO_MINIMO_JUSTIFICATIVA} caracteres)`,
    );
  }
  if (registro.revisao && !pedido.substituindo) {
    problemas.push(
      `este registro já foi ${registro.revisao.decisao} por ${registro.revisao.autor}. `
      + 'Para mudar, marque que está substituindo a decisão anterior.',
    );
  }
  return problemas;
}

/** Aplica a decisão, devolvendo um registro novo. Não altera o original. */
export function decidir(registro: RegistroEvidencia, pedido: PedidoDecisao): RegistroEvidencia {
  const problemas = validarPedido(pedido, registro);
  if (problemas.length > 0) throw new ErroDecisao(problemas.join('; '));

  const agora = pedido.agora ?? (() => new Date());
  const anterior = registro.revisao;
  const justificativa = pedido.justificativa.trim();

  const revisao: DecisaoRevisao = {
    decisao: pedido.decisao,
    autor: pedido.autor.trim(),
    // A decisão anterior fica escrita dentro da nova: o esquema guarda uma
    // revisão só, e sumir com a anterior seria perder o rastro de quem mudou o quê.
    justificativa: anterior
      ? `${justificativa} (substitui decisão anterior: ${anterior.decisao} por ${anterior.autor}, `
        + `em ${anterior.timestamp}, com a justificativa "${anterior.justificativa}")`
      : justificativa,
    timestamp: agora().toISOString(),
  };

  return { ...registro, revisao };
}

/* ------------------------------------------------------------- a fila de revisão --- */

export type FiltroRevisao = 'pendentes' | 'decididos' | 'todos';

export interface ItemRevisao {
  registro: RegistroEvidencia;
  /** Registros citados pelas sinalizações, para a tela mostrar a comparação. */
  relacionados: RegistroEvidencia[];
  /** A assinatura do aparelho confere? Falso é problema grave, e não sinalização comum. */
  assinaturaConfere: boolean | null;
  /** O hash bate com o conteúdo? */
  hashConfere: boolean;
}

/**
 * Monta a fila que a coordenação vê.
 *
 * Ordenada por gravidade e depois por tempo: registro com sinalização alta sobe,
 * e entre iguais o mais antigo primeiro, porque coleta parada há três dias é
 * renda que não chegou em alguma casa.
 */
export function montarFilaRevisao(
  registros: RegistroEvidencia[],
  filtro: FiltroRevisao = 'pendentes',
): ItemRevisao[] {
  const porId = new Map(registros.map(r => [r.conteudo.id, r]));

  const selecionados = registros.filter(r => {
    if (r.sinalizacoes.length === 0) return false;
    if (filtro === 'pendentes') return r.revisao === null;
    if (filtro === 'decididos') return r.revisao !== null;
    return true;
  });

  const peso = (r: RegistroEvidencia) => (r.sinalizacoes.some(s => s.gravidade === 'alta') ? 0 : 1);

  return selecionados
    .sort((a, b) =>
      peso(a) - peso(b)
      || a.conteudo.timestampDispositivo.localeCompare(b.conteudo.timestampDispositivo))
    .map(registro => ({
      registro,
      relacionados: [...new Set(registro.sinalizacoes.flatMap(s => s.registrosRelacionados ?? []))]
        .map(id => porId.get(id))
        .filter((r): r is RegistroEvidencia => r !== undefined),
      assinaturaConfere: null,   // preenchido por quem tiver WebCrypto à mão
      hashConfere: hashConfere(registro),
    }));
}

/** Números do topo do painel. */
export function resumoRevisao(registros: RegistroEvidencia[]) {
  const sinalizados = registros.filter(r => r.sinalizacoes.length > 0);
  return {
    total: registros.length,
    sinalizados: sinalizados.length,
    pendentes: sinalizados.filter(r => r.revisao === null).length,
    aprovados: sinalizados.filter(r => r.revisao?.decisao === 'aprovado').length,
    rejeitados: sinalizados.filter(r => r.revisao?.decisao === 'rejeitado').length,
    graves: sinalizados.filter(r =>
      r.revisao === null && r.sinalizacoes.some(s => s.gravidade === 'alta')).length,
  };
}
