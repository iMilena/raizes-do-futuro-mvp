/* ---------------------------------------------------------------------------
   Árvore de Merkle do lote diário.

   Para que serve, em uma frase: um único hash de 32 bytes vai para a cadeia, e
   qualquer pessoa consegue provar depois que uma coleta específica estava
   naquele lote, sem que o lote inteiro tenha ido para a cadeia.

   É isso que torna a auditoria possível sem violar a LGPD. O comprador do
   Relatório de Circularidade recebe a prova de uma coleta e verifica sozinho.
   A cadeia nunca viu a coleta, só a raiz.

   Três escolhas de construção, todas com consequência:

   1. FOLHA COM HASH DUPLO. A folha é keccak256(hashDoConteudo), não o
      hashDoConteudo cru. Sem isso, um nó interno da árvore (que também é um
      hash de 32 bytes) poderia ser apresentado como se fosse uma folha, e
      alguém provaria a inclusão de uma "coleta" que nunca existiu.

   2. PAR ORDENADO. Ao subir, o par é ordenado pelo valor antes de virar hash.
      Assim a prova não precisa carregar o lado de cada irmão, e a verificação
      fica compatível com `MerkleProof.verify` da OpenZeppelin, que é o que a
      equipe de blockchain vai usar no contrato. O custo é que a árvore não
      distingue esquerda de direita, o que aqui não faz falta.

   3. NÓ ÍMPAR SOBE, NÃO DUPLICA. Quando um nível tem quantidade ímpar, o último
      nó sobe inalterado. Duplicá-lo (o outro jeito comum) cria duas folhas
      idênticas na árvore, e com par ordenado isso abre caminho para prova
      forjada.
--------------------------------------------------------------------------- */
import { hexParaBytes, keccak256, bytesParaHex } from './keccak.js';

export interface ArvoreMerkle {
  /** O que vai para a cadeia. */
  raiz: string;
  /** Folhas em ordem canônica (ordenadas), como entraram na árvore. */
  folhas: string[];
  /** Todos os níveis, da base ao topo. Guardado para gerar prova sem recalcular. */
  niveis: string[][];
  /** Hashes de conteúdo que originaram as folhas, na mesma ordem. */
  hashesOriginais: string[];
}

/** Árvore vazia tem raiz zero, e é um estado legítimo: dia sem coleta existe. */
export const RAIZ_VAZIA = '0x' + '00'.repeat(32);

/** Folha: hash do hash, para nó interno nunca poder se passar por folha. */
export function folhaDe(hashConteudo: string): string {
  return keccak256(hexParaBytes(hashConteudo));
}

/** Combina dois nós, ordenando o par. */
export function combinar(a: string, b: string): string {
  const [primeiro, segundo] = a.toLowerCase() <= b.toLowerCase() ? [a, b] : [b, a];
  const juntos = new Uint8Array(64);
  juntos.set(hexParaBytes(primeiro), 0);
  juntos.set(hexParaBytes(segundo), 32);
  return keccak256(juntos);
}

/**
 * Constrói a árvore a partir dos hashes de conteúdo dos registros do dia.
 *
 * Os hashes são ordenados antes de virar folha: o mesmo conjunto de coletas tem
 * de dar a mesma raiz, tenha a fila subido na ordem que tiver. Sem isso, dois
 * celulares sincronizando em ordens diferentes produziriam raízes diferentes
 * para o mesmo dia, e a ancoragem viraria loteria.
 */
export function construirArvore(hashesConteudo: string[]): ArvoreMerkle {
  const unicos = [...new Set(hashesConteudo.map(h => h.toLowerCase()))].sort();
  if (unicos.length === 0) {
    return { raiz: RAIZ_VAZIA, folhas: [], niveis: [], hashesOriginais: [] };
  }

  const folhas = unicos.map(folhaDe);
  const niveis: string[][] = [folhas];

  let atual = folhas;
  while (atual.length > 1) {
    const proximo: string[] = [];
    for (let i = 0; i < atual.length; i += 2) {
      const esquerda = atual[i]!;
      const direita = atual[i + 1];
      proximo.push(direita === undefined ? esquerda : combinar(esquerda, direita));
    }
    niveis.push(proximo);
    atual = proximo;
  }

  return { raiz: atual[0]!, folhas, niveis, hashesOriginais: unicos };
}

/**
 * Prova de inclusão de um registro: os irmãos no caminho até a raiz.
 *
 * Devolve null quando o registro não está no lote, em vez de lançar: perguntar
 * "esta coleta está neste lote?" e receber "não" é uso normal, não erro.
 */
export function provaDeInclusao(arvore: ArvoreMerkle, hashConteudo: string): string[] | null {
  let indice = arvore.hashesOriginais.indexOf(hashConteudo.toLowerCase());
  if (indice < 0) return null;

  const prova: string[] = [];
  for (let nivel = 0; nivel < arvore.niveis.length - 1; nivel++) {
    const nos = arvore.niveis[nivel]!;
    const parIndice = indice % 2 === 0 ? indice + 1 : indice - 1;
    const irmao = nos[parIndice];
    // Irmão ausente é o nó ímpar que subiu sozinho: não entra na prova.
    if (irmao !== undefined) prova.push(irmao);
    indice = Math.floor(indice / 2);
  }
  return prova;
}

/**
 * Verifica uma prova. É esta função que o contrato vai espelhar em Solidity.
 *
 * Recebe o hash de conteúdo do registro (não a folha): quem verifica tem o
 * registro em mãos, e converter para folha é justamente parte da verificação.
 */
export function verificarProva(hashConteudo: string, prova: string[], raiz: string): boolean {
  let atual = folhaDe(hashConteudo);
  for (const irmao of prova) atual = combinar(atual, irmao);
  return atual.toLowerCase() === raiz.toLowerCase();
}

/** Quantos níveis a árvore tem. Só para diagnóstico e para o painel. */
export function alturaDaArvore(arvore: ArvoreMerkle): number {
  return Math.max(0, arvore.niveis.length - 1);
}

/** Bytes da raiz, para quem for montar a transação on-chain. */
export function raizEmBytes(arvore: ArvoreMerkle): Uint8Array {
  return hexParaBytes(arvore.raiz);
}

export { bytesParaHex };
