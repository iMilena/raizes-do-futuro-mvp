/* ---------------------------------------------------------------------------
   A interface de ancoragem.

   Este arquivo é o contrato entre este módulo e a equipe que cuida da parte
   blockchain. Nada aqui sabe o que é Solana, EVM, carteira ou chave privada, e
   isso é de propósito: o módulo de validação produz evidência e raiz de Merkle,
   e quem assina transação é outra camada, com outras chaves e outro risco.

   O app já tem um precedente disso em src/lib/ancoragem.js, onde o navegador
   calcula o hash e quem assina é um script fora do navegador. A mesma divisão
   vale aqui, e por isso a implementação real vai ser um adaptador que fala com
   esse processo, não código de carteira dentro do PWA.

   IDEMPOTÊNCIA É PARTE DO CONTRATO. Ancorar o mesmo dia duas vezes tem de
   devolver o mesmo recibo, e não gravar duas transações. A rede da ilha cai no
   meio de requisição o tempo todo, e "será que subiu?" precisa ter resposta
   barata, não uma segunda transação paga.
--------------------------------------------------------------------------- */
import type { PayloadAncoragem } from './lote-diario.js';

export interface ReciboAncoragem {
  /** Dia de operação ancorado. É a chave de idempotência. */
  dataLote: string;
  /** Raiz que foi para a cadeia. */
  merkleRoot: string;
  /** Identificador da transação na rede. */
  idTransacao: string;
  /** Rede onde foi ancorado, para o painel mostrar e o auditor conferir. */
  rede: string;
  /** Quando a rede confirmou, ISO 8601. */
  confirmadoEm: string;
  /** Link para o explorador de blocos, quando a rede tiver um. */
  url: string | null;
}

export class ErroAncoragem extends Error {
  constructor(mensagem: string, public readonly recuperavel: boolean) {
    super(mensagem);
    this.name = 'ErroAncoragem';
  }
}

/**
 * Camada de ancoragem.
 *
 * Quem implementar isto para valer só precisa respeitar três coisas:
 *
 *   · `ancorar` é idempotente por `dataLote`. Chamar de novo com a mesma data
 *     devolve o recibo existente, sem nova transação.
 *   · `ancorar` recebe apenas o payload agregado. Se a implementação precisar de
 *     algo que não está ali, a resposta certa é não precisar: o que falta é
 *     dado que não pode ir para a cadeia.
 *   · erro de rede é `ErroAncoragem` com `recuperavel: true`. Erro de regra
 *     (raiz diferente para um dia já ancorado) é `recuperavel: false`, porque
 *     repetir não resolve e alguém precisa olhar.
 */
export interface Ancoradora {
  /** Nome da rede, para exibição. */
  readonly rede: string;
  /** Ancora o lote do dia. Idempotente por dataLote. */
  ancorar(payload: PayloadAncoragem): Promise<ReciboAncoragem>;
  /** Recibo de um dia já ancorado, ou null. */
  consultar(dataLote: string): Promise<ReciboAncoragem | null>;
  /** A raiz registrada na cadeia para aquele dia, ou null. Base da verificação. */
  raizAncorada(dataLote: string): Promise<string | null>;
}
