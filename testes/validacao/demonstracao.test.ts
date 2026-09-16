/* ---------------------------------------------------------------------------
   O exemplo de demonstração.

   Estes testes existem por dois motivos, e o segundo importa mais que o primeiro.

   O primeiro é o óbvio: garantir que a tela tem o que mostrar numa apresentação.

   O segundo é garantir que o exemplo continua HONESTO. As sinalizações que
   aparecem no telão saem dos mesmos detectores que rodam no celular do catador,
   e não de texto escrito à mão. Se alguém mexer num limiar e o caso deixar de
   ser pego, é aqui que isso aparece, antes da apresentação e não durante.
--------------------------------------------------------------------------- */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { BancoLocal } from '../../src/validacao/armazenamento/bd.js';
import { IdentidadeDispositivo, verificarAssinatura } from '../../src/validacao/identidade/chave-dispositivo.js';
import {
  limparDemonstracao, PONTO_DEMONSTRACAO, semearDemonstracao, temDemonstracao,
} from '../../src/validacao/revisao/dados-de-demonstracao.js';
import { montarFilaRevisao, resumoRevisao } from '../../src/validacao/revisao/decisoes.js';
import { hashConfere } from '../../src/validacao/dominio/registro.js';
import { montarLote } from '../../src/validacao/ancoragem/lote-diario.js';

const DIA = '2026-09-14';

let banco: BancoLocal;
let contador = 0;

beforeEach(async () => {
  banco = await BancoLocal.abrir(`demonstracao-${++contador}`);
});

const semear = () => semearDemonstracao(banco, { dia: DIA });

describe('exemplo de demonstração', () => {
  it('planta um dia de coleta com casos normais e casos sinalizados', async () => {
    const resultado = await semear();

    expect(resultado.gravados).toBe(7);
    expect(resultado.sinalizados).toBeGreaterThanOrEqual(3);
    // Nem tudo pode estar sinalizado: a tela precisa mostrar que o sistema
    // separa o que pede conferência do que segue direto.
    expect(resultado.sinalizados).toBeLessThan(resultado.gravados);
  });

  it('as sinalizações vêm dos detectores, e cobrem os quatro casos da tese', async () => {
    const { codigos } = await semear();

    expect(codigos).toContain('foto_reaproveitada');
    expect(codigos).toContain('pilha_recontada');
    expect(codigos).toContain('sequencia_improvavel');
    expect(codigos).toContain('peso_incoerente');
  });

  it('mostra também o caso em que o modelo não teve certeza', async () => {
    expect((await semear()).codigos).toContain('confianca_baixa');
  });

  it('nenhum registro cai fora do território: erro de GPS confundiria quem assiste', async () => {
    expect((await semear()).codigos).not.toContain('fora_do_territorio');
  });

  it('a fila de revisão fica em ordem, com o mais grave na frente', async () => {
    await semear();
    const registros = (await banco.listarRegistros()).map(g => g.registro);
    const fila = montarFilaRevisao(registros);

    expect(fila.length).toBeGreaterThan(0);
    expect(fila[0]?.registro.sinalizacoes.some(s => s.gravidade === 'alta')).toBe(true);
    for (const item of fila) {
      expect(item.hashConfere).toBe(true);
      for (const sinal of item.registro.sinalizacoes) {
        expect(sinal.motivo.length).toBeGreaterThan(20);
        expect(sinal.motivo).not.toMatch(/undefined|NaN|\[object/);
      }
    }
  });

  it('os registros são assinados de verdade, e a verificação passa', async () => {
    const identidade = await IdentidadeDispositivo.carregar(banco);
    await semearDemonstracao(banco, { dia: DIA, identidade });

    for (const guardado of await banco.listarRegistros()) {
      expect(hashConfere(guardado.registro)).toBe(true);
      expect(await verificarAssinatura(guardado.registro)).toBe(true);
    }
  });

  it('vira um lote diário coerente, com raiz de Merkle', async () => {
    await semear();
    const registros = (await banco.listarRegistros()).map(g => g.registro);
    const lote = montarLote(DIA, registros);

    expect(lote.payload.quantidadeRegistros).toBe(7);
    expect(lote.payload.merkleRoot).toMatch(/^0x[0-9a-f]{64}$/);
    expect(lote.payload.pesoTotalKg).toBeGreaterThan(100);
  });
});

describe('o exemplo não se confunde com dado real', () => {
  it('não entra na fila de sincronização, então não sobe para lugar nenhum', async () => {
    await semear();
    expect(await banco.contarFila()).toEqual({
      pendente: 0, enviando: 0, enviado: 0, falhou: 0,
    });
  });

  it('vem marcado no envelope, e não dentro do conteúdo assinado', async () => {
    await semear();
    for (const guardado of await banco.listarRegistros()) {
      expect(guardado.demonstracao).toBe(true);
      /* Nenhum CAMPO chamado `demonstracao` dentro do conteúdo: é o conteúdo que
         entra no hash, e uma marca de "isto é de mentira" lá dentro seria a
         primeira coisa que alguém aprenderia a forjar. A palavra aparece nos
         VALORES, em `ponto-demonstracao` e na versão do modelo, e aí é de
         propósito: é o que a tela mostra para quem estiver olhando. */
      expect(Object.keys(guardado.registro.conteudo)).not.toContain('demonstracao');
      expect(guardado.registro.conteudo.pontoColetaId).toBe(PONTO_DEMONSTRACAO);
      expect(guardado.registro.conteudo.classificacao.versaoModelo).toMatch(/demonstracao/);
    }
    expect(temDemonstracao(await banco.listarRegistros())).toBe(true);
  });

  it('sai inteiro quando removido', async () => {
    await semear();
    expect(await limparDemonstracao(banco)).toBe(7);
    expect(await banco.listarRegistros()).toEqual([]);
    expect(temDemonstracao(await banco.listarRegistros())).toBe(false);
  });

  it('a remoção não encosta no que veio de campo', async () => {
    await semear();
    const deCampo = (await banco.listarRegistros())[0]!;
    // Um registro igual, mas sem a marca: é como chega o que veio do app.
    await banco.salvarRegistro({
      ...deCampo,
      id: 'aaaa0000-0000-4000-8000-000000000001',
      demonstracao: false,
      registro: {
        ...deCampo.registro,
        conteudo: { ...deCampo.registro.conteudo, id: 'aaaa0000-0000-4000-8000-000000000001' },
      },
    });

    await limparDemonstracao(banco);
    const restantes = await banco.listarRegistros();
    expect(restantes).toHaveLength(1);
    expect(restantes[0]?.id).toBe('aaaa0000-0000-4000-8000-000000000001');
    expect((await banco.contarFila()).pendente).toBe(1);
  });

  it('carregar duas vezes não duplica: os ids são determinísticos', async () => {
    await semear();
    await semear();
    expect(await banco.listarRegistros()).toHaveLength(7);
  });

  it('o resumo do topo conta o exemplo como conta qualquer coleta', async () => {
    await semear();
    const resumo = resumoRevisao((await banco.listarRegistros()).map(g => g.registro));
    expect(resumo.total).toBe(7);
    expect(resumo.pendentes).toBeGreaterThan(0);
    expect(resumo.aprovados).toBe(0);
  });
});
