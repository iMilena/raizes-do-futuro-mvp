/* ---------------------------------------------------------------------------
   O lote diário: de uma lista de registros para um hash e um agregado.

   Aqui acontece a passagem de fronteira. De um lado, registros individuais com
   pHash, geohash e pseudônimo de coletor, que vivem no aparelho e na base da
   operação. Do outro, um payload com uma raiz de Merkle e números somados, que
   é a única coisa que pode ir para a cadeia.

   A travessia é obrigatoriamente checada: `montarPayloadAncoragem` chama
   `exigirPayloadSemDadoPessoal` e lança se alguém tiver acrescentado um campo
   novo sem pensar. Não existe caminho neste módulo que monte payload sem passar
   por essa porta.
--------------------------------------------------------------------------- */
import { construirArvore, provaDeInclusao, verificarProva } from '../dominio/merkle.js';
import type { ArvoreMerkle } from '../dominio/merkle.js';
import { exigirPayloadSemDadoPessoal } from '../dominio/esquema-evidencia.js';
import { CLASSES_MATERIAL, VERSAO_ESQUEMA } from '../dominio/tipos.js';
import type { ClasseMaterial, RegistroEvidencia } from '../dominio/tipos.js';

/**
 * Fuso de Boipeba, fixo em UTC-3.
 *
 * Fixo e não `toLocaleDateString` do aparelho: o celular do catador pode estar
 * com fuso errado, e o dia do lote define em qual raiz a coleta vai cair. O
 * Brasil não tem mais horário de verão desde 2019, então o deslocamento é
 * constante e isso é seguro.
 */
export const DESLOCAMENTO_BAHIA_HORAS = -3;

/** Converte um instante ISO no dia de operação (AAAA-MM-DD) em Boipeba. */
export function dataLoteDe(timestampISO: string): string {
  const instante = new Date(timestampISO);
  if (Number.isNaN(instante.getTime())) throw new Error(`timestamp inválido: ${timestampISO}`);
  const local = new Date(instante.getTime() + DESLOCAMENTO_BAHIA_HORAS * 3600_000);
  return local.toISOString().slice(0, 10);
}

export interface PayloadAncoragem {
  versaoEsquema: string;
  dataLote: string;
  merkleRoot: string;
  quantidadeRegistros: number;
  pesoTotalKg: number;
  pesoPorMaterial: Record<ClasseMaterial, number>;
  quantidadeSinalizados: number;
}

export interface LoteDiario {
  dataLote: string;
  /** Os registros que entraram, em memória. NÃO vai para a cadeia. */
  registros: RegistroEvidencia[];
  arvore: ArvoreMerkle;
  payload: PayloadAncoragem;
}

/** Separa os registros por dia de operação. */
export function agruparPorDia(registros: RegistroEvidencia[]): Map<string, RegistroEvidencia[]> {
  const mapa = new Map<string, RegistroEvidencia[]>();
  for (const registro of registros) {
    const dia = dataLoteDe(registro.conteudo.timestampDispositivo);
    const lista = mapa.get(dia) ?? [];
    lista.push(registro);
    mapa.set(dia, lista);
  }
  return mapa;
}

/**
 * Registros que podem entrar no lote.
 *
 * Fica de fora o que foi rejeitado na revisão. Fica DENTRO o que está sinalizado
 * mas ainda sem decisão humana: o lote do dia não pode esperar a coordenação, e
 * a sinalização continua visível no painel. O que vai para a cadeia é o que a
 * operação registrou, com a contagem de quantos pedem conferência.
 */
export function elegiveis(registros: RegistroEvidencia[]): RegistroEvidencia[] {
  return registros.filter(r => r.revisao?.decisao !== 'rejeitado');
}

function somarPorMaterial(registros: RegistroEvidencia[]): Record<ClasseMaterial, number> {
  const soma = Object.fromEntries(CLASSES_MATERIAL.map(c => [c, 0])) as Record<ClasseMaterial, number>;
  for (const r of registros) {
    // Duas casas: a balança do projeto pesa em gramas, e somar float sem
    // arredondar produz 148.20000000000002 na raiz que vai para a cadeia.
    soma[r.conteudo.classificacao.classeFinal] =
      Math.round((soma[r.conteudo.classificacao.classeFinal] + r.conteudo.pesoKg) * 100) / 100;
  }
  return soma;
}

/** Monta o lote de um dia, com árvore e payload prontos. */
export function montarLote(dataLote: string, registros: RegistroEvidencia[]): LoteDiario {
  const doDia = elegiveis(registros)
    .filter(r => dataLoteDe(r.conteudo.timestampDispositivo) === dataLote);

  const arvore = construirArvore(doDia.map(r => r.hashConteudo));
  const pesoPorMaterial = somarPorMaterial(doDia);
  const pesoTotalKg = Math.round(
    Object.values(pesoPorMaterial).reduce((a, b) => a + b, 0) * 100,
  ) / 100;

  const payload: PayloadAncoragem = {
    versaoEsquema: VERSAO_ESQUEMA,
    dataLote,
    merkleRoot: arvore.raiz,
    quantidadeRegistros: doDia.length,
    pesoTotalKg,
    pesoPorMaterial,
    quantidadeSinalizados: doDia.filter(r => r.sinalizacoes.length > 0).length,
  };

  // A porta da fronteira. Se um campo novo entrou no payload sem passar pela
  // lista branca, a montagem falha aqui, antes de qualquer transação.
  exigirPayloadSemDadoPessoal(payload as unknown as Record<string, unknown>);

  return { dataLote, registros: doDia, arvore, payload };
}

/** Monta todos os lotes de uma lista de registros de vários dias. */
export function montarLotes(registros: RegistroEvidencia[]): LoteDiario[] {
  return [...agruparPorDia(registros).keys()]
    .sort()
    .map(dia => montarLote(dia, registros));
}

export interface ProvaDeColeta {
  dataLote: string;
  hashConteudo: string;
  merkleRoot: string;
  prova: string[];
}

/**
 * Gera a prova que acompanha uma coleta específica.
 *
 * É o artefato que o comprador do relatório recebe: com ele, o hash do registro
 * e a raiz que está na cadeia, dá para verificar sozinho, sem confiar em nós.
 */
export function provaDeColeta(lote: LoteDiario, hashConteudo: string): ProvaDeColeta | null {
  const prova = provaDeInclusao(lote.arvore, hashConteudo);
  if (prova === null) return null;
  return {
    dataLote: lote.dataLote,
    hashConteudo: hashConteudo.toLowerCase(),
    merkleRoot: lote.arvore.raiz,
    prova,
  };
}

/** Verifica uma prova de coleta contra a raiz que está na cadeia. */
export function verificarProvaDeColeta(prova: ProvaDeColeta, raizNaCadeia: string): boolean {
  return prova.merkleRoot.toLowerCase() === raizNaCadeia.toLowerCase()
    && verificarProva(prova.hashConteudo, prova.prova, raizNaCadeia);
}
