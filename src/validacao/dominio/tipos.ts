/* ---------------------------------------------------------------------------
   Tipos do módulo de Validação de Coleta.

   Um registro de evidência tem duas metades, e a separação é a decisão mais
   importante deste arquivo:

     · CONTEÚDO: o que foi observado em campo, no momento da coleta. É isso, e
       só isso, que entra no hash e depois na árvore de Merkle. Não muda nunca.
     · METADADOS: o que o sistema descobriu depois (sinalizações de fraude,
       carimbo de tempo do servidor, decisão de quem revisou). Muda, e por isso
       fica fora do hash.

   Se sinalização entrasse no hash, o hash mudaria a cada nova checagem rodada
   sobre registros antigos, e a prova de inclusão de ontem quebraria hoje.
--------------------------------------------------------------------------- */

/** Classes que o projeto opera hoje. A ordem é a ordem de saída do modelo. */
export const CLASSES_MATERIAL = ['PET', 'aluminio', 'vidro', 'papelao', 'outros'] as const;
export type ClasseMaterial = (typeof CLASSES_MATERIAL)[number];

/** Versão do esquema. Sobe quando o formato do CONTEÚDO muda, porque isso muda o hash. */
export const VERSAO_ESQUEMA = 'evidencia-coleta-v1';

export type CodigoSinalizacao =
  | 'confianca_baixa'        // o modelo não teve certeza do material
  | 'foto_reaproveitada'     // pHash muito próximo do de outro registro
  | 'pilha_recontada'        // mesma pilha registrada duas vezes, perto no tempo e no espaço
  | 'sequencia_improvavel'   // volume registrado não cabe no intervalo entre coletas
  | 'peso_incoerente'        // peso declarado fora da faixa esperada para o que aparece na foto
  | 'fora_do_territorio';    // geohash fora da área de operação

export type Gravidade = 'atencao' | 'alta';

export interface Sinalizacao {
  codigo: CodigoSinalizacao;
  gravidade: Gravidade;
  /** Frase pronta para quem revisa, em português, sem jargão. */
  motivo: string;
  /** Números que sustentam o motivo (distância de Hamming, minutos, kg). */
  detalhes?: Record<string, string | number>;
  /** Ids de outros registros envolvidos, quando a detecção compara registros. */
  registrosRelacionados?: string[];
}

export interface Classificacao {
  /** O que o modelo sugeriu. */
  classeSugerida: ClasseMaterial;
  /** Confiança do modelo na sugestão, de 0 a 1. */
  confianca: number;
  /** O que ficou valendo (igual à sugestão, ou o que o catador corrigiu). */
  classeFinal: ClasseMaterial;
  /** Correção humana é dado de retreino, por isso fica registrada. */
  corrigidoPorHumano: boolean;
  /** Identifica qual modelo classificou, para auditoria posterior. */
  versaoModelo: string;
}

export interface Assinatura {
  algoritmo: 'ECDSA-P256-SHA256';
  /** Chave pública do aparelho, JWK em base64url. A privada nunca sai do WebCrypto. */
  chavePublica: string;
  /** Assinatura do hashConteudo, em base64. */
  valor: string;
}

export interface DecisaoRevisao {
  decisao: 'aprovado' | 'rejeitado';
  /** Quem decidiu. Identificador de operação, não nome de pessoa. */
  autor: string;
  justificativa: string;
  timestamp: string;
}

/**
 * O que foi observado em campo. Entra no hash, na íntegra e em ordem canônica.
 *
 * NÃO existe aqui, de propósito: foto, nome, coordenada exata, telefone, ou
 * qualquer coisa que identifique pessoa. A foto fica no aparelho, o que viaja
 * é o pHash dela.
 */
export interface ConteudoRegistro {
  /** UUID gerado no aparelho. É também a chave de idempotência da sincronização. */
  id: string;
  versaoEsquema: string;
  classificacao: Classificacao;
  /** Peso da balança, em kg. A balança é a fonte, a foto não estima peso. */
  pesoKg: number;
  /**
   * Fração do quadro ocupada pelo material na foto, de 0 a 1.
   *
   * Não é volume em litros e não vira peso: sem câmera calibrada e sem
   * referência de escala isso não se sustenta. Serve só para comparar com o
   * peso declarado e sinalizar incoerência grosseira (foto de meia sacola com
   * 40 kg declarados).
   */
  ocupacaoQuadro: number | null;
  /** pHash perceptual da foto, 64 bits em 16 dígitos hexadecimais. */
  pHash: string;
  /** Geohash de 7 caracteres (aproximadamente 150 m). Confirma a ilha, não a casa. */
  geohash: string;
  /** Relógio do aparelho, ISO 8601. Pode estar errado, e é por isso que existe o do servidor. */
  timestampDispositivo: string;
  /** Ponto de coleta (lugar, não pessoa). */
  pontoColetaId: string;
  /** HMAC do id do coletor. Estável para agrupar, irreversível sem o sal. */
  coletorPseudonimo: string;
}

/**
 * O registro completo, como fica guardado no aparelho e na base.
 *
 * O conteúdo fica aninhado, e não espalhado no mesmo nível dos metadados, para
 * que "o que entra no hash" seja uma resposta de uma palavra: `registro.conteudo`.
 * Achatar convidaria ao erro de incluir uma sinalização no hash sem perceber.
 */
export interface RegistroEvidencia {
  conteudo: ConteudoRegistro;
  /** keccak256 do conteúdo canônico, com prefixo 0x. É a folha da árvore de Merkle. */
  hashConteudo: string;
  assinatura: Assinatura | null;
  /** Descobertas posteriores. Fora do hash. */
  sinalizacoes: Sinalizacao[];
  /** Carimbo do servidor, preenchido quando a fila sobe. Fora do hash. */
  timestampServidor: string | null;
  /** Decisão humana, quando houve sinalização. Fora do hash. */
  revisao: DecisaoRevisao | null;
}

/** Situação do registro na fila local. */
export type SituacaoFila = 'pendente' | 'enviando' | 'enviado' | 'falhou';

export interface ItemFila {
  id: string;
  situacao: SituacaoFila;
  tentativas: number;
  ultimoErro: string | null;
  atualizadoEm: string;
}
