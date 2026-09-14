/* ---------------------------------------------------------------------------
   A chave do aparelho, que assina cada registro.

   O que a assinatura acrescenta, já que o hash keccak256 do conteúdo existe:
   o hash prova que o conteúdo não mudou. A assinatura prova DE ONDE ele veio.
   Sem ela, qualquer pessoa com acesso à base poderia inserir um registro bem
   formado, com hash correto, que nunca passou por um aparelho de campo.

   ECDSA P-256 e não HMAC com segredo compartilhado: HMAC seria mais simples,
   mas todo mundo que verifica precisaria do segredo, e quem verifica é
   justamente quem não deve poder assinar. A auditoria de investidor exige essa
   separação.

   A chave privada é gerada com `extractable: false`. Isso não é detalhe: ela
   nunca existe como bytes em JavaScript, nem para ser gravada. O navegador
   guarda, o navegador assina, e nem o nosso próprio código consegue copiá-la.
   O preço é que a chave não pode ser levada para outro aparelho, e isso é
   desejável: um aparelho, uma identidade.
--------------------------------------------------------------------------- */
import type { BancoLocal } from '../armazenamento/bd.js';
import type { Assinatura, ConteudoRegistro, RegistroEvidencia } from '../dominio/tipos.js';
import { hexParaBytes } from '../dominio/keccak.js';
import { jsonCanonico } from '../dominio/json-canonico.js';

const ID_CHAVE = 'aparelho';
const ALGORITMO = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const ASSINA = { name: 'ECDSA', hash: 'SHA-256' } as const;

interface ChavesGuardadas {
  id: string;
  par: CryptoKeyPair;
  criadoEm: string;
}

function base64(bytes: ArrayBuffer): string {
  const octetos = new Uint8Array(bytes);
  let texto = '';
  for (const b of octetos) texto += String.fromCharCode(b);
  return btoa(texto);
}

function deBase64(texto: string): Uint8Array<ArrayBuffer> {
  const bruto = atob(texto);
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

export class IdentidadeDispositivo {
  private constructor(
    private readonly par: CryptoKeyPair,
    private readonly chavePublicaBase64: string,
  ) {}

  /**
   * Carrega a identidade do aparelho, criando na primeira vez.
   *
   * Sem cadastro, sem senha, sem rede. O catador abre o app na praia e ele já
   * tem identidade: qualquer coisa diferente disso seria um passo a mais entre
   * a pessoa e o registro da coleta, e esse passo não existe no fluxo de campo.
   */
  static async carregar(banco: BancoLocal): Promise<IdentidadeDispositivo> {
    const guardadas = await banco.lerChaves<ChavesGuardadas>(ID_CHAVE);
    if (guardadas) {
      return new IdentidadeDispositivo(guardadas.par, await exportarPublica(guardadas.par.publicKey));
    }

    const par = await crypto.subtle.generateKey(ALGORITMO, false, ['sign', 'verify']);
    await banco.salvarChaves<ChavesGuardadas>({
      id: ID_CHAVE, par, criadoEm: new Date().toISOString(),
    });
    return new IdentidadeDispositivo(par, await exportarPublica(par.publicKey));
  }

  get chavePublica(): string {
    return this.chavePublicaBase64;
  }

  /**
   * Assina o hash do conteúdo, não o conteúdo inteiro.
   *
   * O hash já é o compromisso com o conteúdo, e assinar 32 bytes em vez do JSON
   * inteiro deixa a verificação independente de serialização: quem verifica
   * recalcula o hash pelo JSON canônico e confere a assinatura sobre ele.
   */
  async assinar(hashConteudo: string): Promise<Assinatura> {
    const valor = await crypto.subtle.sign(ASSINA, this.par.privateKey, hexParaBytes(hashConteudo));
    return {
      algoritmo: 'ECDSA-P256-SHA256',
      chavePublica: this.chavePublicaBase64,
      valor: base64(valor),
    };
  }

  /** Assina um registro já montado. */
  async assinarRegistro(registro: RegistroEvidencia): Promise<RegistroEvidencia> {
    return { ...registro, assinatura: await this.assinar(registro.hashConteudo) };
  }
}

async function exportarPublica(chave: CryptoKey): Promise<string> {
  // A pública é exportável por definição: ela precisa viajar junto do registro
  // para quem verifica poder usá-la.
  const jwk = await crypto.subtle.exportKey('jwk', chave);
  return btoa(jsonCanonico({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }));
}

/**
 * Verifica a assinatura de um registro. Roda em qualquer lugar: no painel de
 * revisão, no servidor, na máquina de quem audita.
 */
export async function verificarAssinatura(registro: RegistroEvidencia): Promise<boolean> {
  if (!registro.assinatura) return false;
  try {
    const jwk = JSON.parse(atob(registro.assinatura.chavePublica)) as JsonWebKey;
    const chave = await crypto.subtle.importKey(
      'jwk', { ...jwk, ext: true, key_ops: ['verify'] }, ALGORITMO, true, ['verify'],
    );
    return await crypto.subtle.verify(
      ASSINA, chave,
      deBase64(registro.assinatura.valor),
      hexParaBytes(registro.hashConteudo),
    );
  } catch {
    return false;
  }
}

/** O aparelho que assinou este registro é o mesmo que assinou aquele? */
export function mesmoAparelho(a: RegistroEvidencia, b: RegistroEvidencia): boolean {
  return a.assinatura !== null && b.assinatura !== null
    && a.assinatura.chavePublica === b.assinatura.chavePublica;
}

export type { ConteudoRegistro };
