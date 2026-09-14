/* ---------------------------------------------------------------------------
   Retenção da foto: o dado pessoal some, a evidência fica.
--------------------------------------------------------------------------- */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { BancoLocal } from '../../src/validacao/armazenamento/bd.js';
import type { RegistroGuardado } from '../../src/validacao/armazenamento/bd.js';
import { aplicarRetencao, DIAS_RETENCAO_PADRAO } from '../../src/validacao/armazenamento/retencao.js';
import { montarRegistro } from '../../src/validacao/dominio/registro.js';
import { hashConfere } from '../../src/validacao/dominio/registro.js';
import { conteudoDeTeste } from './fixtures.js';

let banco: BancoLocal;
let contador = 0;
let sequencia = 0;

const HOJE = new Date('2026-09-14T12:00:00.000Z');
const diasAtras = (n: number) => new Date(HOJE.getTime() - n * 86_400_000);

beforeEach(async () => {
  banco = await BancoLocal.abrir(`retencao-${++contador}`);
  sequencia = 0;
});

/** Grava um registro com foto, com a idade pedida. */
async function comFoto(opcoes: { idadeDias: number; sinalizado?: boolean; revisado?: boolean }) {
  sequencia++;
  const quando = diasAtras(opcoes.idadeDias).toISOString();
  const { versaoEsquema: _v, ...base } = conteudoDeTeste({
    id: `3f2504e0-4f89-41d3-9a0c-0305e82c${String(sequencia).padStart(4, '0')}`,
    pHash: sequencia.toString(16).padStart(16, '0'),
    timestampDispositivo: quando,
  });
  let registro = montarRegistro(base, opcoes.sinalizado
    ? [{ codigo: 'foto_reaproveitada', gravidade: 'alta', motivo: 'foto quase igual à de outro registro' }]
    : []);
  if (opcoes.revisado) {
    registro = {
      ...registro,
      revisao: {
        decisao: 'aprovado', autor: 'coordenacao',
        justificativa: 'Conferido com a coletora, são duas entregas distintas.',
        timestamp: HOJE.toISOString(),
      },
    };
  }

  const guardado: RegistroGuardado = {
    id: registro.conteudo.id,
    dataLote: quando.slice(0, 10),
    timestamp: quando,
    registro,
  };
  // A foto herda o instante da coleta, então basta datar a coleta.
  await banco.salvarRegistro(guardado, new Blob(['foto'], { type: 'image/jpeg' }));
  return guardado;
}

describe('retenção de fotos', () => {
  it('apaga a foto velha e mantém a evidência inteira', async () => {
    const guardado = await comFoto({ idadeDias: DIAS_RETENCAO_PADRAO + 5 });

    const resultado = await aplicarRetencao(banco, { agora: () => HOJE });

    expect(resultado.apagadas).toBe(1);
    expect(await banco.lerFoto(guardado.id)).toBeUndefined();

    const sobrou = await banco.lerRegistro(guardado.id);
    expect(sobrou?.registro.conteudo.pHash).toBe(guardado.registro.conteudo.pHash);
    expect(hashConfere(sobrou!.registro)).toBe(true);
  });

  it('não toca em foto dentro do prazo', async () => {
    const guardado = await comFoto({ idadeDias: 3 });
    expect((await aplicarRetencao(banco, { agora: () => HOJE })).apagadas).toBe(0);
    expect(await banco.lerFoto(guardado.id)).toBeDefined();
  });

  it('segura a foto de registro sinalizado que ainda espera decisão humana', async () => {
    const guardado = await comFoto({ idadeDias: 90, sinalizado: true });

    const resultado = await aplicarRetencao(banco, { agora: () => HOJE });

    expect(resultado.apagadas).toBe(0);
    expect(resultado.mantidasPorRevisao).toBe(1);
    expect(await banco.lerFoto(guardado.id)).toBeDefined();
  });

  it('apaga depois que a revisão decidiu, mesmo tendo sido sinalizado', async () => {
    const guardado = await comFoto({ idadeDias: 90, sinalizado: true, revisado: true });
    expect((await aplicarRetencao(banco, { agora: () => HOJE })).apagadas).toBe(1);
    expect(await banco.lerFoto(guardado.id)).toBeUndefined();
  });

  it('o prazo é parâmetro, porque é decisão de operação e não de código', async () => {
    const guardado = await comFoto({ idadeDias: 10 });
    expect((await aplicarRetencao(banco, { dias: 30, agora: () => HOJE })).apagadas).toBe(0);
    expect((await aplicarRetencao(banco, { dias: 7, agora: () => HOJE })).apagadas).toBe(1);
    expect(await banco.lerRegistro(guardado.id)).toBeDefined();
  });

  it('rodar duas vezes não é erro nem conta em dobro', async () => {
    await comFoto({ idadeDias: 90 });
    expect((await aplicarRetencao(banco, { agora: () => HOJE })).apagadas).toBe(1);
    expect((await aplicarRetencao(banco, { agora: () => HOJE })).apagadas).toBe(0);
  });
});
