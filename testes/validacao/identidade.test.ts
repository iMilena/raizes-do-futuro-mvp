/* ---------------------------------------------------------------------------
   Identidade do aparelho e pseudônimo do coletor.
--------------------------------------------------------------------------- */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { BancoLocal } from '../../src/validacao/armazenamento/bd.js';
import {
  IdentidadeDispositivo, mesmoAparelho, verificarAssinatura,
} from '../../src/validacao/identidade/chave-dispositivo.js';
import { pseudonimoCorresponde, pseudonimoDe } from '../../src/validacao/identidade/pseudonimo.js';
import { montarRegistro } from '../../src/validacao/dominio/registro.js';
import { conteudoDeTeste } from './fixtures.js';

let banco: BancoLocal;
let contador = 0;

beforeEach(async () => {
  banco = await BancoLocal.abrir(`identidade-${++contador}`);
});

function registro(id: string) {
  const { versaoEsquema: _v, ...base } = conteudoDeTeste({ id });
  return montarRegistro(base);
}

const ID_A = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const ID_B = '3f2504e0-4f89-41d3-9a0c-0305e82c3302';

describe('chave do aparelho', () => {
  it('nasce sozinha na primeira abertura, sem cadastro nem rede', async () => {
    const identidade = await IdentidadeDispositivo.carregar(banco);
    expect(identidade.chavePublica.length).toBeGreaterThan(0);
  });

  it('é a mesma depois de fechar e abrir o app', async () => {
    const primeira = await IdentidadeDispositivo.carregar(banco);
    const segunda = await IdentidadeDispositivo.carregar(banco);
    expect(segunda.chavePublica).toBe(primeira.chavePublica);
  });

  it('assina o registro e a assinatura confere', async () => {
    const identidade = await IdentidadeDispositivo.carregar(banco);
    const assinado = await identidade.assinarRegistro(registro(ID_A));

    expect(assinado.assinatura?.algoritmo).toBe('ECDSA-P256-SHA256');
    expect(await verificarAssinatura(assinado)).toBe(true);
  });

  it('registro adulterado depois de assinado não passa na verificação', async () => {
    const identidade = await IdentidadeDispositivo.carregar(banco);
    const assinado = await identidade.assinarRegistro(registro(ID_A));

    // Trocar o peso obriga a trocar o hash, e a assinatura era do hash antigo.
    const adulterado = {
      ...assinado,
      conteudo: { ...assinado.conteudo, pesoKg: 999 },
      hashConteudo: '0x' + 'ab'.repeat(32),
    };
    expect(await verificarAssinatura(adulterado)).toBe(false);
  });

  it('registro sem assinatura não passa por assinado', async () => {
    expect(await verificarAssinatura(registro(ID_A))).toBe(false);
  });

  it('assinatura de um registro não serve para outro', async () => {
    const identidade = await IdentidadeDispositivo.carregar(banco);
    const a = await identidade.assinarRegistro(registro(ID_A));
    const b = registro(ID_B);

    expect(await verificarAssinatura({ ...b, assinatura: a.assinatura })).toBe(false);
  });

  it('a chave privada não é exportável nem pelo nosso próprio código', async () => {
    await IdentidadeDispositivo.carregar(banco);
    const guardadas = await banco.lerChaves<{ par: CryptoKeyPair }>('aparelho');

    expect(guardadas?.par.privateKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('jwk', guardadas!.par.privateKey)).rejects.toThrow();
  });

  it('reconhece dois registros assinados pelo mesmo aparelho', async () => {
    const identidade = await IdentidadeDispositivo.carregar(banco);
    const a = await identidade.assinarRegistro(registro(ID_A));
    const b = await identidade.assinarRegistro(registro(ID_B));
    expect(mesmoAparelho(a, b)).toBe(true);

    const outroBanco = await BancoLocal.abrir(`identidade-outro-${contador}`);
    const outraIdentidade = await IdentidadeDispositivo.carregar(outroBanco);
    expect(mesmoAparelho(a, await outraIdentidade.assinarRegistro(registro(ID_B)))).toBe(false);
  });
});

describe('pseudônimo do coletor', () => {
  it('é estável para o mesmo id', async () => {
    expect(await pseudonimoDe('BOI-001')).toBe(await pseudonimoDe('BOI-001'));
  });

  it('tem o formato que o esquema exige', async () => {
    expect(await pseudonimoDe('BOI-001')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('coletores diferentes têm pseudônimos diferentes', async () => {
    expect(await pseudonimoDe('BOI-001')).not.toBe(await pseudonimoDe('BOI-002'));
  });

  it('muda com o sal, que é o que impede reidentificação por força bruta', async () => {
    const comum = await pseudonimoDe('BOI-001', 'sal-de-um-territorio');
    const outro = await pseudonimoDe('BOI-001', 'sal-de-outro-territorio');
    expect(comum).not.toBe(outro);
  });

  it('a coordenação consegue ligar pseudônimo a id, tendo a lista e o sal', async () => {
    const pseudonimo = await pseudonimoDe('BOI-007', 'sal-do-piloto');
    expect(await pseudonimoCorresponde(pseudonimo, 'BOI-007', 'sal-do-piloto')).toBe(true);
    expect(await pseudonimoCorresponde(pseudonimo, 'BOI-008', 'sal-do-piloto')).toBe(false);
  });

  it('ignora espaço em volta, para digitação não criar coletor fantasma', async () => {
    expect(await pseudonimoDe(' BOI-001 ')).toBe(await pseudonimoDe('BOI-001'));
  });

  it('recusa id vazio em vez de gerar um pseudônimo órfão', async () => {
    await expect(pseudonimoDe('  ')).rejects.toThrow(/vazio/);
  });
});
