/* ---------------------------------------------------------------------------
   keccak256, o mesmo hash que a EVM usa.

   Por que keccak256 e não SHA-256 (que o app já usa em src/lib/evidencia.js):
   a árvore de Merkle vai ser verificada dentro de um contrato inteligente, e lá
   keccak256 é primitiva nativa e barata. Hash diferente obrigaria o contrato a
   carregar uma implementação de SHA-256 em Solidity, mais cara e sem ganho.

   `js-sha3` em vez de trazer ethers/viem inteiro: são 20 kB contra centenas, e
   o que precisamos daqui é uma função só. Os vetores de teste do NIST estão em
   testes/validacao/keccak.test.ts.
--------------------------------------------------------------------------- */
import { keccak256 as keccakLib } from 'js-sha3';
import { bytesCanonicos } from './json-canonico.js';

/** Hash de bytes crus. Devolve hexadecimal com prefixo 0x. */
export function keccak256(dados: Uint8Array): string {
  return '0x' + keccakLib(dados);
}

/** Hash do JSON canônico de um valor. É assim que o conteúdo de um registro vira folha. */
export function keccak256Canonico(valor: unknown): string {
  return keccak256(bytesCanonicos(valor));
}

/**
 * Hexadecimal com 0x, de 32 bytes, para Uint8Array.
 *
 * O tipo de retorno diz `Uint8Array<ArrayBuffer>`, e não só `Uint8Array`, porque
 * o WebCrypto recusa uma visão sobre `SharedArrayBuffer`, que é o que o tipo
 * aberto admite. Sem isso, `crypto.subtle.sign` não aceita o resultado.
 */
export function hexParaBytes(hex: string): Uint8Array<ArrayBuffer> {
  const limpo = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (limpo.length % 2 !== 0 || /[^0-9a-fA-F]/.test(limpo)) {
    throw new Error(`hexadecimal inválido: ${hex}`);
  }
  const saida = new Uint8Array(limpo.length / 2);
  for (let i = 0; i < saida.length; i++) saida[i] = parseInt(limpo.slice(i * 2, i * 2 + 2), 16);
  return saida;
}

export function bytesParaHex(bytes: Uint8Array): string {
  let s = '0x';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}
