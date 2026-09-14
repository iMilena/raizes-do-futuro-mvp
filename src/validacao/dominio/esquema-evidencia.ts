/* ---------------------------------------------------------------------------
   Validação do registro de evidência, e a fronteira do dado pessoal.

   Validador escrito à mão em vez de zod/ajv: são 5 campos aninhados e uma
   dependência a menos num bundle que roda em celular de entrada com rede
   intermitente. O preço é este arquivo ter de acompanhar
   `esquema-evidencia.json`, e existe teste garantindo que os dois não divergem.

   A segunda metade do arquivo é a parte que importa juridicamente:
   `varrerDadoPessoal` existe para que "nenhum dado pessoal atravessa a fronteira
   do on-chain" seja um teste que roda, e não uma promessa escrita no README.
--------------------------------------------------------------------------- */
import { CLASSES_MATERIAL, VERSAO_ESQUEMA } from './tipos.js';
import type { ClasseMaterial } from './tipos.js';

/* --------------------------------------------------------------- validação --- */

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RE_PHASH = /^[0-9a-f]{16}$/;
const RE_GEOHASH = /^[0-9b-hjkmnp-z]{7}$/;
const RE_HMAC = /^[0-9a-f]{64}$/;
const RE_HASH = /^0x[0-9a-f]{64}$/;
const RE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

const ehClasse = (v: unknown): v is ClasseMaterial =>
  typeof v === 'string' && (CLASSES_MATERIAL as readonly string[]).includes(v);

/** Campos obrigatórios do conteúdo. Há teste conferindo contra o JSON Schema. */
export const CAMPOS_CONTEUDO = [
  'id', 'versaoEsquema', 'classificacao', 'pesoKg', 'ocupacaoQuadro',
  'pHash', 'geohash', 'timestampDispositivo', 'pontoColetaId', 'coletorPseudonimo',
] as const;

/**
 * Valida o conteúdo de um registro. Devolve a lista de problemas, vazia quando está bom.
 *
 * Lista, em vez de lançar na primeira falha: quem chama isto é uma tela de campo,
 * e mostrar um erro de cada vez para quem está de pé no sol, com o dedo molhado,
 * é desenho ruim.
 */
export function validarConteudo(valor: unknown): string[] {
  const erros: string[] = [];
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return ['conteúdo não é um objeto'];
  }
  const c = valor as Record<string, unknown>;

  for (const campo of CAMPOS_CONTEUDO) {
    if (!(campo in c)) erros.push(`campo obrigatório ausente: ${campo}`);
  }
  for (const campo of Object.keys(c)) {
    if (!(CAMPOS_CONTEUDO as readonly string[]).includes(campo)) {
      erros.push(`campo desconhecido no conteúdo: ${campo}`);
    }
  }

  if (typeof c['id'] !== 'string' || !RE_UUID.test(c['id'])) erros.push('id não é um UUID');
  if (c['versaoEsquema'] !== VERSAO_ESQUEMA) erros.push(`versaoEsquema deve ser ${VERSAO_ESQUEMA}`);

  const peso = c['pesoKg'];
  if (typeof peso !== 'number' || !Number.isFinite(peso) || peso <= 0 || peso > 2000) {
    erros.push('pesoKg deve ser um número maior que 0 e até 2000');
  }

  const ocupacao = c['ocupacaoQuadro'];
  if (ocupacao !== null && (typeof ocupacao !== 'number' || !(ocupacao >= 0 && ocupacao <= 1))) {
    erros.push('ocupacaoQuadro deve ser null ou um número de 0 a 1');
  }

  if (typeof c['pHash'] !== 'string' || !RE_PHASH.test(c['pHash'])) {
    erros.push('pHash deve ter 16 dígitos hexadecimais (64 bits)');
  }
  if (typeof c['geohash'] !== 'string' || !RE_GEOHASH.test(c['geohash'])) {
    erros.push('geohash deve ter 7 caracteres do alfabeto base32 de geohash');
  }
  if (typeof c['timestampDispositivo'] !== 'string' || !RE_ISO.test(c['timestampDispositivo'])) {
    erros.push('timestampDispositivo deve ser data ISO 8601 com fuso');
  }
  if (typeof c['pontoColetaId'] !== 'string' || c['pontoColetaId'].length === 0) {
    erros.push('pontoColetaId vazio');
  }
  if (typeof c['coletorPseudonimo'] !== 'string' || !RE_HMAC.test(c['coletorPseudonimo'])) {
    erros.push('coletorPseudonimo deve ser HMAC-SHA256 em 64 dígitos hexadecimais');
  }

  erros.push(...validarClassificacao(c['classificacao']));
  return erros;
}

function validarClassificacao(valor: unknown): string[] {
  if (typeof valor !== 'object' || valor === null) return ['classificacao ausente ou inválida'];
  const k = valor as Record<string, unknown>;
  const erros: string[] = [];

  if (!ehClasse(k['classeSugerida'])) erros.push('classeSugerida fora das classes do projeto');
  if (!ehClasse(k['classeFinal'])) erros.push('classeFinal fora das classes do projeto');
  const conf = k['confianca'];
  if (typeof conf !== 'number' || !(conf >= 0 && conf <= 1)) erros.push('confianca deve ir de 0 a 1');
  if (typeof k['corrigidoPorHumano'] !== 'boolean') erros.push('corrigidoPorHumano deve ser booleano');
  if (typeof k['versaoModelo'] !== 'string' || k['versaoModelo'].length === 0) {
    erros.push('versaoModelo vazio');
  }

  /* Coerência entre sugestão e correção. Marcar errado aqui estragaria o conjunto
     de retreino, que é exatamente o que se extrai deste campo depois. */
  if (ehClasse(k['classeSugerida']) && ehClasse(k['classeFinal'])) {
    if (k['classeSugerida'] !== k['classeFinal'] && k['corrigidoPorHumano'] !== true) {
      erros.push('classeFinal difere da sugerida mas corrigidoPorHumano está falso');
    }
  }
  return erros;
}

/** Valida o registro inteiro: conteúdo mais metadados. */
export function validarRegistro(valor: unknown): string[] {
  if (typeof valor !== 'object' || valor === null) return ['registro não é um objeto'];
  const r = valor as Record<string, unknown>;
  const erros = validarConteudo(r['conteudo']).map(e => `conteudo: ${e}`);

  if (typeof r['hashConteudo'] !== 'string' || !RE_HASH.test(r['hashConteudo'])) {
    erros.push('hashConteudo deve ser keccak256 em 0x mais 64 hexadecimais');
  }
  if (!Array.isArray(r['sinalizacoes'])) erros.push('sinalizacoes deve ser uma lista');
  if (r['timestampServidor'] !== null && typeof r['timestampServidor'] !== 'string') {
    erros.push('timestampServidor deve ser null ou data ISO');
  }
  return erros;
}

/* ------------------------------------------------------ fronteira do LGPD --- */

/**
 * Únicos campos que podem sair do aparelho rumo à cadeia, no lote diário.
 *
 * Lista branca e não lista negra: em lista negra todo campo novo passa por
 * padrão, e o dia em que alguém acrescentar `nomeDoColetor` ao agregado ninguém
 * percebe. Aqui, campo novo fica bloqueado até ser liberado de propósito.
 */
export const CAMPOS_PERMITIDOS_ONCHAIN = [
  'versaoEsquema', 'dataLote', 'merkleRoot', 'quantidadeRegistros',
  'pesoTotalKg', 'pesoPorMaterial', 'quantidadeSinalizados',
] as const;

/**
 * Nomes de campo que denunciam dado pessoal ou registro individual. A varredura
 * olha a chave. Cobre o que o app já coleta hoje (foto, geo, resp, coletor), o
 * óbvio de cadastro, e também identificadores de registro: o lote sobe agregado,
 * então nem um `id` de coleta isolada tem o que fazer ali.
 */
const CHAVES_EXATAS = [
  'id', 'rg', 'cpf', 'lat', 'lng', 'geo', 'nome', 'resp', 'foto', 'face', 'idade',
];

/**
 * Nomes curtos precisam de igualdade exata, nomes distintivos casam por pedaço.
 * Sem essa separação, "vidro" seria barrado por conter "id", e a varredura viraria
 * ruído que alguém desliga na primeira semana.
 */
const CHAVES_PARCIAIS = [
  'nome', 'responsavel', 'telefone', 'celular', 'email', 'endereco', 'cpf',
  'foto', 'imagem', 'selfie', 'rosto', 'biometria', 'assinatura',
  'latitude', 'longitude', 'coordenada', 'nascimento',
  'crianca', 'escola', 'saude', 'familia', 'coletor', 'pseudonimo',
  'phash', 'hashconteudo', 'registro',
];

const chaveSuspeita = (chave: string): boolean =>
  CHAVES_EXATAS.includes(chave) || CHAVES_PARCIAIS.some(s => chave.includes(s));

/** Valores que denunciam dado pessoal mesmo sob um nome de campo inocente. */
const PADROES_SUSPEITOS: Array<[RegExp, string]> = [
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, 'parece CPF'],
  [/[\w.+-]+@[\w-]+\.[\w.]+/, 'parece e-mail'],
  [/\b(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/, 'parece telefone'],
  [/-?\d{1,2}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/, 'parece coordenada exata'],
];

export interface AchadoPessoal {
  caminho: string;
  motivo: string;
}

/**
 * Varre uma estrutura atrás de dado pessoal, por nome de campo e por formato de
 * valor. Devolve os achados, vazio quando está limpo.
 *
 * Heurística, e assumidamente pessimista: falso positivo aqui custa um campo
 * renomeado, falso negativo custa dado de família na blockchain para sempre.
 */
export function varrerDadoPessoal(valor: unknown, caminho = '$'): AchadoPessoal[] {
  const achados: AchadoPessoal[] = [];

  if (typeof valor === 'string') {
    for (const [re, motivo] of PADROES_SUSPEITOS) {
      if (re.test(valor)) achados.push({ caminho, motivo });
    }
    return achados;
  }
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => achados.push(...varrerDadoPessoal(v, `${caminho}[${i}]`)));
    return achados;
  }
  if (typeof valor === 'object' && valor !== null) {
    for (const [chave, v] of Object.entries(valor)) {
      const normal = chave.toLowerCase();
      if (chaveSuspeita(normal)) {
        achados.push({
          caminho: `${caminho}.${chave}`,
          motivo: `campo "${chave}" carrega dado de pessoa ou de registro individual`,
        });
      }
      achados.push(...varrerDadoPessoal(v, `${caminho}.${chave}`));
    }
  }
  return achados;
}

/**
 * O payload do lote pode ir para a cadeia?
 *
 * Duas checagens em série: lista branca de campos, depois varredura de conteúdo.
 * Lança em vez de devolver false porque não há recuperação razoável: se chegou
 * aqui com dado pessoal, o certo é abortar a ancoragem e alguém olhar o código.
 */
export function exigirPayloadSemDadoPessoal(payload: Record<string, unknown>): void {
  const permitidos = CAMPOS_PERMITIDOS_ONCHAIN as readonly string[];
  const proibidos = Object.keys(payload).filter(k => !permitidos.includes(k));
  if (proibidos.length > 0) {
    throw new Error(
      `ancoragem bloqueada: campo fora da lista permitida on-chain (${proibidos.join(', ')})`,
    );
  }
  /* A varredura corre sobre os VALORES, não sobre as chaves de primeiro nível:
     essas já passaram pela lista branca, e varrê-las de novo bloquearia campos
     legítimos do agregado (`quantidadeRegistros` contém "registro"). */
  const achados = Object.entries(payload).flatMap(([chave, valor]) =>
    varrerDadoPessoal(valor, `$.${chave}`),
  );
  if (achados.length > 0) {
    const lista = achados.map(a => `${a.caminho} (${a.motivo})`).join('; ');
    throw new Error(`ancoragem bloqueada: possível dado pessoal no payload: ${lista}`);
  }
}
