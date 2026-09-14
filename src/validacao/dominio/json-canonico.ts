/* ---------------------------------------------------------------------------
   Serialização canônica: mesmo conteúdo, sempre os mesmos bytes.

   Sem isto o hash é uma loteria. `JSON.stringify` preserva a ordem de inserção
   das chaves, então o mesmo registro montado em outra ordem no código daria
   outro hash, e a prova de inclusão do dia falharia sem ninguém entender por quê.

   Regras, deliberadamente rígidas:
     · chaves de objeto em ordem crescente de code point
     · `undefined`, função, NaN e Infinity são erro, não viram null em silêncio
     · nada de espaço, quebra de linha ou indentação
--------------------------------------------------------------------------- */

export class ErroCanonico extends Error {}

/** Converte um valor em JSON canônico. Lança se o valor não for serializável de forma estável. */
export function jsonCanonico(valor: unknown, caminho = '$'): string {
  if (valor === null) return 'null';

  switch (typeof valor) {
    case 'boolean':
      return valor ? 'true' : 'false';

    case 'number':
      if (!Number.isFinite(valor)) {
        throw new ErroCanonico(`número não finito em ${caminho}: ${String(valor)}`);
      }
      // -0 e 0 são o mesmo número para quem lê o registro, viram os mesmos bytes.
      return JSON.stringify(valor === 0 ? 0 : valor);

    case 'string':
      return JSON.stringify(valor);

    case 'object': {
      if (Array.isArray(valor)) {
        return '[' + valor.map((v, i) => jsonCanonico(v, `${caminho}[${i}]`)).join(',') + ']';
      }
      const obj = valor as Record<string, unknown>;
      const chaves = Object.keys(obj).sort();
      const partes: string[] = [];
      for (const chave of chaves) {
        const v = obj[chave];
        if (v === undefined) {
          throw new ErroCanonico(`campo ${caminho}.${chave} está undefined (use null explícito)`);
        }
        partes.push(JSON.stringify(chave) + ':' + jsonCanonico(v, `${caminho}.${chave}`));
      }
      return '{' + partes.join(',') + '}';
    }

    default:
      throw new ErroCanonico(`tipo não serializável em ${caminho}: ${typeof valor}`);
  }
}

/** Os bytes UTF-8 da forma canônica. É o que vai para o keccak256. */
export function bytesCanonicos(valor: unknown): Uint8Array {
  return new TextEncoder().encode(jsonCanonico(valor));
}
