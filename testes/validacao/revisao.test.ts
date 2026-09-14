/* ---------------------------------------------------------------------------
   Revisão humana: a fila da coordenação e o registro da decisão.
--------------------------------------------------------------------------- */
import { describe, expect, it } from 'vitest';
import {
  decidir, ErroDecisao, montarFilaRevisao, resumoRevisao,
  TAMANHO_MINIMO_JUSTIFICATIVA, validarPedido,
} from '../../src/validacao/revisao/decisoes.js';
import { montarRegistro } from '../../src/validacao/dominio/registro.js';
import { montarLote } from '../../src/validacao/ancoragem/lote-diario.js';
import type { Gravidade, RegistroEvidencia } from '../../src/validacao/dominio/tipos.js';
import { conteudoDeTeste } from './fixtures.js';

let sequencia = 0;
function registro(opcoes: {
  gravidade?: Gravidade; quando?: string; relacionado?: string; sem?: boolean;
} = {}): RegistroEvidencia {
  sequencia++;
  const { versaoEsquema: _v, ...base } = conteudoDeTeste({
    id: `3f2504e0-4f89-41d3-9a0c-0305e82c${String(sequencia).padStart(4, '0')}`,
    timestampDispositivo: opcoes.quando ?? '2026-09-14T12:00:00.000Z',
    pHash: sequencia.toString(16).padStart(16, '0'),
  });
  return montarRegistro(base, opcoes.sem ? [] : [{
    codigo: 'foto_reaproveitada',
    gravidade: opcoes.gravidade ?? 'atencao',
    motivo: 'A foto é quase igual à de outro registro.',
    registrosRelacionados: opcoes.relacionado ? [opcoes.relacionado] : undefined,
  }]);
}

const PEDIDO_BOM = {
  decisao: 'aprovado' as const,
  autor: 'coordenacao-viva',
  justificativa: 'Conferi com a coletora: são duas entregas do mesmo ponto, no mesmo dia.',
  agora: () => new Date('2026-09-14T18:00:00.000Z'),
};

describe('decisão humana', () => {
  it('registra decisão, autor, justificativa e horário', () => {
    const decidido = decidir(registro(), PEDIDO_BOM);
    expect(decidido.revisao).toMatchObject({
      decisao: 'aprovado', autor: 'coordenacao-viva', timestamp: '2026-09-14T18:00:00.000Z',
    });
  });

  it('não muda o conteúdo nem o hash da evidência de campo', () => {
    const original = registro();
    const decidido = decidir(original, { ...PEDIDO_BOM, decisao: 'rejeitado' });
    expect(decidido.hashConteudo).toBe(original.hashConteudo);
    expect(decidido.conteudo).toEqual(original.conteudo);
    expect(decidido.sinalizacoes).toEqual(original.sinalizacoes);
  });

  it('não altera o registro original: devolve um novo', () => {
    const original = registro();
    decidir(original, PEDIDO_BOM);
    expect(original.revisao).toBeNull();
  });

  it('recusa decisão sem autor', () => {
    expect(() => decidir(registro(), { ...PEDIDO_BOM, autor: '  ' })).toThrow(ErroDecisao);
  });

  it('recusa justificativa vazia ou de uma palavra', () => {
    expect(() => decidir(registro(), { ...PEDIDO_BOM, justificativa: 'ok' })).toThrow(ErroDecisao);
    expect(validarPedido({ ...PEDIDO_BOM, justificativa: 'ok' }, registro())[0])
      .toContain(String(TAMANHO_MINIMO_JUSTIFICATIVA));
  });

  it('recusa decidir de novo sem dizer que está substituindo', () => {
    const decidido = decidir(registro(), PEDIDO_BOM);
    expect(() => decidir(decidido, { ...PEDIDO_BOM, decisao: 'rejeitado' })).toThrow(/já foi aprovado/);
  });

  it('ao substituir, guarda a decisão anterior por escrito', () => {
    const decidido = decidir(registro(), PEDIDO_BOM);
    const trocado = decidir(decidido, {
      decisao: 'rejeitado',
      autor: 'coordenacao-detrash',
      justificativa: 'Reabri o caso: a pesagem da tarde já estava contada na entrega da manhã.',
      substituindo: true,
      agora: () => new Date('2026-09-15T09:00:00.000Z'),
    });

    expect(trocado.revisao?.decisao).toBe('rejeitado');
    expect(trocado.revisao?.justificativa).toContain('substitui decisão anterior: aprovado');
    expect(trocado.revisao?.justificativa).toContain('coordenacao-viva');
  });
});

describe('fila de revisão', () => {
  it('mostra só o que foi sinalizado e ainda não foi decidido', () => {
    const limpo = registro({ sem: true });
    const sinalizado = registro();
    const decidido = decidir(registro(), PEDIDO_BOM);

    const fila = montarFilaRevisao([limpo, sinalizado, decidido]);
    expect(fila.map(i => i.registro.conteudo.id)).toEqual([sinalizado.conteudo.id]);
  });

  it('põe o mais grave na frente, e entre iguais o mais antigo', () => {
    const atencaoNova = registro({ gravidade: 'atencao', quando: '2026-09-14T16:00:00.000Z' });
    const atencaoVelha = registro({ gravidade: 'atencao', quando: '2026-09-14T08:00:00.000Z' });
    const grave = registro({ gravidade: 'alta', quando: '2026-09-14T17:00:00.000Z' });

    const fila = montarFilaRevisao([atencaoNova, atencaoVelha, grave]);
    expect(fila.map(i => i.registro.conteudo.id))
      .toEqual([grave.conteudo.id, atencaoVelha.conteudo.id, atencaoNova.conteudo.id]);
  });

  it('traz junto os registros que a sinalização cita, para a comparação', () => {
    const primeiro = registro({ sem: true });
    const segundo = registro({ relacionado: primeiro.conteudo.id });

    const fila = montarFilaRevisao([primeiro, segundo]);
    expect(fila[0]?.relacionados.map(r => r.conteudo.id)).toEqual([primeiro.conteudo.id]);
  });

  it('confere o hash de cada registro que chega para revisão', () => {
    const adulterado: RegistroEvidencia = {
      ...registro(),
      conteudo: { ...registro().conteudo, pesoKg: 999 },
    };
    const fila = montarFilaRevisao([adulterado]);
    expect(fila[0]?.hashConfere).toBe(false);
  });

  it('o filtro de decididos mostra o histórico', () => {
    const decidido = decidir(registro(), PEDIDO_BOM);
    expect(montarFilaRevisao([decidido], 'decididos')).toHaveLength(1);
    expect(montarFilaRevisao([decidido], 'pendentes')).toHaveLength(0);
    expect(montarFilaRevisao([decidido], 'todos')).toHaveLength(1);
  });

  it('resume a situação do dia para o topo do painel', () => {
    const resumo = resumoRevisao([
      registro({ sem: true }),
      registro({ gravidade: 'alta' }),
      registro(),
      decidir(registro(), PEDIDO_BOM),
      decidir(registro(), { ...PEDIDO_BOM, decisao: 'rejeitado' }),
    ]);
    expect(resumo).toMatchObject({
      total: 5, sinalizados: 4, pendentes: 2, aprovados: 1, rejeitados: 1, graves: 1,
    });
  });
});

describe('efeito da revisão no lote do dia', () => {
  it('rejeitar tira a coleta do lote, aprovar mantém', () => {
    const aprovado = decidir(registro(), PEDIDO_BOM);
    const rejeitado = decidir(registro(), { ...PEDIDO_BOM, decisao: 'rejeitado' });
    const semSinal = registro({ sem: true });

    const lote = montarLote('2026-09-14', [aprovado, rejeitado, semSinal]);
    expect(lote.payload.quantidadeRegistros).toBe(2);
    expect(lote.registros.map(r => r.conteudo.id)).not.toContain(rejeitado.conteudo.id);
  });

  it('coleta sinalizada e ainda sem decisão entra no lote, e aparece na contagem', () => {
    const pendente = registro();
    const lote = montarLote('2026-09-14', [pendente]);
    expect(lote.payload.quantidadeRegistros).toBe(1);
    expect(lote.payload.quantidadeSinalizados).toBe(1);
  });
});
