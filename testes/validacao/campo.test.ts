/* ---------------------------------------------------------------------------
   O fluxo de registro de campo, ponta a ponta, sem navegador.

   Este é o teste que responde ao critério "registro completo funcionando sem
   rede": nenhuma das funções exercitadas aqui toca em `fetch`, e o transporte
   nem é construído.
--------------------------------------------------------------------------- */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { BancoLocal } from '../../src/validacao/armazenamento/bd.js';
import { IdentidadeDispositivo, verificarAssinatura } from '../../src/validacao/identidade/chave-dispositivo.js';
import { pseudonimoDe } from '../../src/validacao/identidade/pseudonimo.js';
import { GEOHASH_PADRAO_DA_ILHA, registrarColeta } from '../../src/validacao/campo/registro-de-campo.js';
import type { RascunhoColeta } from '../../src/validacao/campo/registro-de-campo.js';
import { aplicarTecla, pesoValido, textoParaPeso } from '../../src/validacao/campo/telas/TelaPeso.js';
import { ROTULOS_MATERIAL, MATERIAIS } from '../../src/validacao/campo/material.js';
import { CLASSES_MATERIAL } from '../../src/validacao/dominio/tipos.js';
import { hashConfere } from '../../src/validacao/dominio/registro.js';
import { montarLote } from '../../src/validacao/ancoragem/lote-diario.js';

let banco: BancoLocal;
let identidade: IdentidadeDispositivo;
let contador = 0;
let sequenciaId = 0;

const CUEIRA = { lat: -13.6320, lng: -38.9170 };

beforeEach(async () => {
  banco = await BancoLocal.abrir(`campo-${++contador}`);
  identidade = await IdentidadeDispositivo.carregar(banco);
  sequenciaId = 0;
});

async function rascunho(mudancas: Partial<RascunhoColeta> = {}): Promise<RascunhoColeta> {
  return {
    foto: new Blob(['conteúdo da foto'], { type: 'image/jpeg' }),
    pHash: 'f0e1d2c3b4a59687',
    ocupacaoQuadro: 0.45,
    classeSugerida: 'PET',
    confianca: 0.93,
    classeFinal: 'PET',
    versaoModelo: 'classificador-v1',
    pesoKg: 12.5,
    pontoColetaId: 'ponto-cueira',
    coletorPseudonimo: await pseudonimoDe('BOI-001'),
    posicao: CUEIRA,
    ...mudancas,
  };
}

const opcoes = (quando: string) => ({
  agora: () => new Date(quando),
  novoId: () => `3f2504e0-4f89-41d3-9a0c-0305e82c${String(++sequenciaId).padStart(4, '0')}`,
});

describe('registro de coleta em campo', () => {
  it('guarda registro, foto e fila numa passada só, sem rede', async () => {
    const resultado = await registrarColeta(
      await rascunho(), banco, identidade, opcoes('2026-09-14T12:00:00.000Z'));

    expect(resultado.vaiParaRevisao).toBe(false);
    expect(await banco.lerFoto(resultado.registro.conteudo.id)).toBeDefined();
    expect((await banco.contarFila()).pendente).toBe(1);
  });

  it('a evidência sai assinada e com hash que fecha', async () => {
    const { registro } = await registrarColeta(
      await rascunho(), banco, identidade, opcoes('2026-09-14T12:00:00.000Z'));

    expect(hashConfere(registro)).toBe(true);
    expect(await verificarAssinatura(registro)).toBe(true);
  });

  it('converte a posição em geohash de 7, e não guarda a coordenada', async () => {
    const { registro } = await registrarColeta(
      await rascunho(), banco, identidade, opcoes('2026-09-14T12:00:00.000Z'));

    expect(registro.conteudo.geohash).toBe('7js66qm');
    const serializado = JSON.stringify(registro);
    expect(serializado).not.toContain('-13.632');
    expect(serializado).not.toContain('-38.917');
  });

  it('registra mesmo sem GPS, porque o trabalho aconteceu de qualquer jeito', async () => {
    const { registro } = await registrarColeta(
      await rascunho({ posicao: null }), banco, identidade, opcoes('2026-09-14T12:00:00.000Z'));

    expect(registro.conteudo.geohash).toBe(GEOHASH_PADRAO_DA_ILHA);
    expect((await banco.contarFila()).pendente).toBe(1);
  });

  it('marca correção humana quando o catador troca o material sugerido', async () => {
    const { registro } = await registrarColeta(
      await rascunho({ classeSugerida: 'PET', classeFinal: 'vidro' }),
      banco, identidade, opcoes('2026-09-14T12:00:00.000Z'));

    expect(registro.conteudo.classificacao.corrigidoPorHumano).toBe(true);
    expect(registro.conteudo.classificacao.classeSugerida).toBe('PET');
    expect(registro.conteudo.classificacao.classeFinal).toBe('vidro');
  });

  it('a foto fica no aparelho: o registro leva só o pHash', async () => {
    const { registro } = await registrarColeta(
      await rascunho(), banco, identidade, opcoes('2026-09-14T12:00:00.000Z'));

    expect(registro.conteudo.pHash).toBe('f0e1d2c3b4a59687');
    expect(JSON.stringify(registro)).not.toContain('image/jpeg');
  });

  it('sinaliza a segunda foto igual, e guarda as duas assim mesmo', async () => {
    await registrarColeta(await rascunho(), banco, identidade, opcoes('2026-09-14T09:00:00.000Z'));
    const segunda = await registrarColeta(
      await rascunho(), banco, identidade, opcoes('2026-09-14T11:00:00.000Z'));

    expect(segunda.vaiParaRevisao).toBe(true);
    expect(segunda.sinalizacoes.map(s => s.codigo)).toContain('foto_reaproveitada');
    // Nada foi rejeitado: as duas coletas estão guardadas e na fila.
    expect((await banco.listarRegistros())).toHaveLength(2);
    expect((await banco.contarFila()).pendente).toBe(2);
  });

  it('a sinalização traz motivo legível para quem for revisar', async () => {
    await registrarColeta(await rascunho(), banco, identidade, opcoes('2026-09-14T09:00:00.000Z'));
    const segunda = await registrarColeta(
      await rascunho(), banco, identidade, opcoes('2026-09-14T11:00:00.000Z'));

    for (const sinal of segunda.sinalizacoes) {
      expect(sinal.motivo).toMatch(/[a-zà-ú]{4,}/i);
      expect(sinal.motivo).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  it('um dia de trabalho vira um lote diário coerente', async () => {
    const horas = ['08:30', '10:15', '13:40', '16:20'];
    for (const [i, hora] of horas.entries()) {
      await registrarColeta(
        await rascunho({ pesoKg: 10 + i, pHash: (i + 1).toString(16).padStart(16, '0') }),
        banco, identidade, opcoes(`2026-09-14T${hora}:00.000Z`));
    }

    const guardados = await banco.registrosDoDia('2026-09-14');
    const lote = montarLote('2026-09-14', guardados.map(g => g.registro));

    expect(lote.payload.quantidadeRegistros).toBe(4);
    expect(lote.payload.pesoTotalKg).toBe(46);
    expect(lote.payload.merkleRoot).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('a coleta da noite entra no lote do dia certo, pelo fuso da Bahia', async () => {
    // 01:00 UTC do dia 15 é 22:00 do dia 14 em Boipeba.
    await registrarColeta(await rascunho(), banco, identidade, opcoes('2026-09-15T01:00:00.000Z'));
    expect(await banco.registrosDoDia('2026-09-14')).toHaveLength(1);
    expect(await banco.registrosDoDia('2026-09-15')).toHaveLength(0);
  });
});

describe('teclado do peso', () => {
  it('monta o número dígito a dígito', () => {
    let valor = '';
    for (const tecla of ['1', '2', ',', '5']) valor = aplicarTecla(valor, tecla);
    expect(valor).toBe('12,5');
    expect(textoParaPeso(valor)).toBe(12.5);
  });

  it('aceita uma casa decimal só', () => {
    expect(aplicarTecla('12,5', '7')).toBe('12,5');
  });

  it('aceita uma vírgula só', () => {
    expect(aplicarTecla('12,5', ',')).toBe('12,5');
  });

  it('vírgula no começo vira 0,', () => {
    expect(aplicarTecla('', ',')).toBe('0,');
  });

  it('não deixa começar com zero à esquerda', () => {
    expect(aplicarTecla('0', '5')).toBe('0');
  });

  it('apaga de trás para frente', () => {
    expect(aplicarTecla('12,5', 'apagar')).toBe('12,');
    expect(aplicarTecla('', 'apagar')).toBe('');
  });

  it('recusa peso zero, vazio ou absurdo', () => {
    expect(pesoValido('')).toBe(false);
    expect(pesoValido('0')).toBe(false);
    expect(pesoValido('0,0')).toBe(false);
    expect(pesoValido('12,5')).toBe(true);
    expect(pesoValido('9999')).toBe(false);
  });
});

describe('rótulos de material', () => {
  it('cobrem todas as classes do modelo, sem sobrar nem faltar', () => {
    expect(Object.keys(ROTULOS_MATERIAL).sort()).toEqual([...CLASSES_MATERIAL].sort());
    expect(MATERIAIS).toHaveLength(CLASSES_MATERIAL.length);
  });

  it('cada material tem ícone e palavra: ícone sozinho é adivinhação', () => {
    for (const { icone, rotulo } of MATERIAIS) {
      expect(icone.length).toBeGreaterThan(0);
      expect(rotulo.length).toBeGreaterThan(2);
    }
  });
});
