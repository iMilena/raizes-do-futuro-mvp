/* ---------------------------------------------------------------------------
   Montagem do registro de evidência.

   Um lugar só monta registro, e é aqui. O hash é calculado na construção e não
   por quem chama, porque "esqueci de recalcular o hash depois de mexer no
   conteúdo" é o tipo de bug que só aparece na auditoria, meses depois, quando a
   prova de inclusão não fecha e ninguém mais lembra o que mudou.
--------------------------------------------------------------------------- */
import { keccak256Canonico } from './keccak.js';
import { validarConteudo } from './esquema-evidencia.js';
import { VERSAO_ESQUEMA } from './tipos.js';
import type {
  ConteudoRegistro, DecisaoRevisao, RegistroEvidencia, Sinalizacao,
} from './tipos.js';

export class ErroRegistroInvalido extends Error {
  constructor(public readonly problemas: string[]) {
    super(`registro de evidência inválido: ${problemas.join('; ')}`);
    this.name = 'ErroRegistroInvalido';
  }
}

/** O hash que vira folha da árvore de Merkle. */
export function hashDoConteudo(conteudo: ConteudoRegistro): string {
  return keccak256Canonico(conteudo);
}

/**
 * Monta o registro a partir do conteúdo observado em campo.
 *
 * `versaoEsquema` é preenchida aqui de propósito: quem chama descreve a coleta,
 * não a versão do formato.
 */
export function montarRegistro(
  conteudo: Omit<ConteudoRegistro, 'versaoEsquema'>,
  sinalizacoes: Sinalizacao[] = [],
): RegistroEvidencia {
  const completo: ConteudoRegistro = { ...conteudo, versaoEsquema: VERSAO_ESQUEMA };
  const problemas = validarConteudo(completo);
  if (problemas.length > 0) throw new ErroRegistroInvalido(problemas);

  return {
    conteudo: completo,
    hashConteudo: hashDoConteudo(completo),
    assinatura: null,
    sinalizacoes,
    timestampServidor: null,
    revisao: null,
  };
}

/** O hash guardado confere com o conteúdo guardado? */
export function hashConfere(registro: RegistroEvidencia): boolean {
  return hashDoConteudo(registro.conteudo) === registro.hashConteudo;
}

/**
 * Acrescenta sinalizações sem tocar no conteúdo nem no hash.
 *
 * Existe para deixar explícito no código o que a arquitetura promete: checagem
 * que roda depois não reescreve a evidência de campo.
 */
export function comSinalizacoes(
  registro: RegistroEvidencia,
  novas: Sinalizacao[],
): RegistroEvidencia {
  if (novas.length === 0) return registro;
  const jaTem = new Set(registro.sinalizacoes.map(s => s.codigo));
  const acrescentar = novas.filter(s => !jaTem.has(s.codigo));
  if (acrescentar.length === 0) return registro;
  return { ...registro, sinalizacoes: [...registro.sinalizacoes, ...acrescentar] };
}

/** Registra a decisão de quem revisou. Também não mexe no hash. */
export function comRevisao(registro: RegistroEvidencia, revisao: DecisaoRevisao): RegistroEvidencia {
  return { ...registro, revisao };
}

/** Precisa de olho humano? */
export function precisaRevisao(registro: RegistroEvidencia): boolean {
  return registro.sinalizacoes.length > 0 && registro.revisao === null;
}
