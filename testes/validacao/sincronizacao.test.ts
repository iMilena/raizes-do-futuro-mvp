/* ---------------------------------------------------------------------------
   Banco local e sincronização.

   O teste que importa mais nesta suíte é "a conexão cai depois do servidor
   gravar". É o caso que duplica registro em quase todo app offline feito às
   pressas, e registro duplicado aqui vira peso duplicado, que vira dinheiro
   duplicado no cofre multisig.
--------------------------------------------------------------------------- */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { BancoLocal } from '../../src/validacao/armazenamento/bd.js';
import type { RegistroGuardado } from '../../src/validacao/armazenamento/bd.js';
import { TransporteMemoria } from '../../src/validacao/sincronizacao/transporte-memoria.js';
import { Sincronizador } from '../../src/validacao/sincronizacao/sincronizador.js';
import { montarRegistro } from '../../src/validacao/dominio/registro.js';
import { dataLoteDe } from '../../src/validacao/ancoragem/lote-diario.js';
import { conteudoDeTeste } from './fixtures.js';

let sequencia = 0;
function guardado(opcoes: { peso?: number; quando?: string } = {}): RegistroGuardado {
  sequencia++;
  const quando = opcoes.quando ?? '2026-09-14T12:00:00.000Z';
  const { versaoEsquema: _v, ...base } = conteudoDeTeste({
    id: `3f2504e0-4f89-41d3-9a0c-0305e82c${String(sequencia).padStart(4, '0')}`,
    pesoKg: opcoes.peso ?? 10,
    timestampDispositivo: quando,
    pHash: sequencia.toString(16).padStart(16, '0'),
  });
  const registro = montarRegistro(base);
  return { id: registro.conteudo.id, dataLote: dataLoteDe(quando), timestamp: quando, registro };
}

let banco: BancoLocal;
let contadorBancos = 0;

beforeEach(async () => {
  // Banco novo por teste: IndexedDB é global, e teste que enxerga o lixo do
  // anterior passa por engano.
  banco = await BancoLocal.abrir(`teste-${++contadorBancos}`);
});

describe('banco local', () => {
  it('grava registro, foto e item de fila juntos', async () => {
    const item = guardado();
    await banco.salvarRegistro(item, new Blob(['foto falsa'], { type: 'image/jpeg' }));

    expect((await banco.lerRegistro(item.id))?.registro.hashConteudo).toBe(item.registro.hashConteudo);
    expect(await banco.lerFoto(item.id)).toBeDefined();
    expect(await banco.contarFila()).toMatchObject({ pendente: 1 });
  });

  it('busca os registros de um dia sem varrer tudo', async () => {
    await banco.salvarRegistro(guardado({ quando: '2026-09-14T12:00:00.000Z' }));
    await banco.salvarRegistro(guardado({ quando: '2026-09-14T15:00:00.000Z' }));
    await banco.salvarRegistro(guardado({ quando: '2026-09-15T12:00:00.000Z' }));

    expect(await banco.registrosDoDia('2026-09-14')).toHaveLength(2);
    expect(await banco.registrosDoDia('2026-09-15')).toHaveLength(1);
  });

  it('devolve os recentes primeiro, limitados, para as detecções não varrerem o histórico', async () => {
    for (let i = 0; i < 12; i++) {
      await banco.salvarRegistro(guardado({ quando: `2026-09-14T${String(8 + i).padStart(2, '0')}:00:00.000Z` }));
    }
    const recentes = await banco.registrosRecentes(5);
    expect(recentes).toHaveLength(5);
    expect(recentes[0]!.timestamp > recentes[4]!.timestamp).toBe(true);
  });

  it('apaga a foto e mantém a evidência, que é o que a LGPD pede', async () => {
    const item = guardado();
    await banco.salvarRegistro(item, new Blob(['foto'], { type: 'image/jpeg' }));
    await banco.apagarFoto(item.id);

    expect(await banco.lerFoto(item.id)).toBeUndefined();
    const restante = await banco.lerRegistro(item.id);
    expect(restante?.registro.conteudo.pHash).toBe(item.registro.conteudo.pHash);
    expect(restante?.registro.hashConteudo).toBe(item.registro.hashConteudo);
  });

  it('apaga fotos antigas pelo prazo de retenção', async () => {
    await banco.salvarRegistro(guardado(), new Blob(['a']));
    await banco.salvarRegistro(guardado(), new Blob(['b']));
    const amanha = new Date(Date.now() + 86_400_000);
    expect(await banco.apagarFotosAnterioresA(amanha)).toBe(2);
  });
});

describe('sincronização', () => {
  it('sobe a fila quando há rede e esvazia os pendentes', async () => {
    const transporte = new TransporteMemoria();
    const sincronizador = new Sincronizador(banco, transporte);
    for (let i = 0; i < 3; i++) await banco.salvarRegistro(guardado());

    const resultado = await sincronizador.sincronizar();
    expect(resultado.enviados).toBe(3);
    expect(resultado.pendentes).toBe(0);
    expect(transporte.quantidadeGravada).toBe(3);
  });

  it('sem rede, não perde nada: tudo continua pendente', async () => {
    const transporte = new TransporteMemoria({ offline: true });
    const sincronizador = new Sincronizador(banco, transporte);
    await banco.salvarRegistro(guardado());

    const resultado = await sincronizador.sincronizar();
    expect(resultado.enviados).toBe(0);
    expect(resultado.pendentes).toBe(1);
    expect(resultado.erro).toMatch(/conexão/);

    transporte.offline = false;
    expect((await sincronizador.sincronizar()).enviados).toBe(1);
  });

  it('a conexão cai DEPOIS do servidor gravar, e mesmo assim não duplica', async () => {
    const transporte = new TransporteMemoria({ falharDepoisDeGravar: true });
    const sincronizador = new Sincronizador(banco, transporte);
    for (let i = 0; i < 4; i++) await banco.salvarRegistro(guardado());

    // Primeira janela de rede: o servidor grava, a resposta se perde no caminho
    // de volta. Do lado do aparelho, isso é indistinguível de "não chegou".
    const primeira = await sincronizador.sincronizar();
    expect(primeira.enviados).toBe(0);
    expect(primeira.pendentes).toBe(4);     // volta para pendente, não some
    expect(transporte.quantidadeGravada).toBe(4);

    // Segunda janela: reenvia os mesmos ids, e o servidor reconhece que já tem.
    transporte.falharDepoisDeGravar = false;
    const segunda = await sincronizador.sincronizar();

    expect(segunda.enviados).toBe(4);
    expect(transporte.quantidadeGravada).toBe(4);   // não duplicou
    expect((await banco.contarFila()).enviado).toBe(4);
    expect((await banco.contarFila()).pendente).toBe(0);
  });

  it('o app morre no meio do envio, e a reconciliação fecha o que o servidor já tem', async () => {
    /* O celular desliga (bateria, queda, o catador força o fechamento) depois de
       marcar "enviando" e antes de processar a resposta. Ninguém volta para
       ajustar a fila: o item fica preso. É a reconciliação do ciclo seguinte que
       resolve, perguntando ao servidor. */
    const transporte = new TransporteMemoria();
    const sincronizador = new Sincronizador(banco, transporte);

    const naServidor = guardado();
    const perdido = guardado();
    await banco.salvarRegistro(naServidor);
    await banco.salvarRegistro(perdido);

    // O servidor recebeu um dos dois antes de o aparelho morrer.
    await transporte.enviar([naServidor.registro]);
    for (const item of await banco.itensDaFila('pendente')) {
      await banco.atualizarItemFila({ ...item, situacao: 'enviando' });
    }

    const resultado = await sincronizador.sincronizar();

    expect(resultado.reconciliados).toBe(1);        // o que o servidor já tinha
    expect(resultado.enviados).toBe(1);             // o que faltava, reenviado
    expect(transporte.quantidadeGravada).toBe(2);   // e nada duplicado
    expect((await banco.contarFila()).enviado).toBe(2);
    expect((await banco.lerRegistro(perdido.id))?.registro.timestampServidor).not.toBeNull();
  });

  it('sem rede nem para reconciliar, o item preso continua preso, e não vira duplicata', async () => {
    const transporte = new TransporteMemoria();
    const sincronizador = new Sincronizador(banco, transporte);
    const item = guardado();
    await banco.salvarRegistro(item);
    await transporte.enviar([item.registro]);
    for (const daFila of await banco.itensDaFila('pendente')) {
      await banco.atualizarItemFila({ ...daFila, situacao: 'enviando' });
    }

    transporte.offline = true;
    const resultado = await sincronizador.sincronizar();
    expect(resultado.reconciliados).toBe(0);
    expect(resultado.pendentes).toBe(1);
    expect(transporte.quantidadeGravada).toBe(1);

    transporte.offline = false;
    expect((await sincronizador.sincronizar()).reconciliados).toBe(1);
    expect(transporte.quantidadeGravada).toBe(1);
  });

  it('sincronizar duas vezes seguidas não grava nada duas vezes', async () => {
    const transporte = new TransporteMemoria();
    const sincronizador = new Sincronizador(banco, transporte);
    await banco.salvarRegistro(guardado());

    await sincronizador.sincronizar();
    await sincronizador.sincronizar();
    expect(transporte.quantidadeGravada).toBe(1);
  });

  it('o mesmo registro enviado duas vezes é aceito e gravado uma vez só', async () => {
    const transporte = new TransporteMemoria();
    const item = guardado();
    const primeira = await transporte.enviar([item.registro]);
    const segunda = await transporte.enviar([item.registro]);

    expect(primeira.aceitos).toEqual([item.id]);
    expect(segunda.aceitos).toEqual([item.id]);   // aceito de novo, e não erro
    expect(transporte.quantidadeGravada).toBe(1);
  });

  it('envia em lotes pequenos, para uma queda custar um lote e não o dia inteiro', async () => {
    const transporte = new TransporteMemoria();
    const sincronizador = new Sincronizador(banco, transporte, { tamanhoLote: 3 });
    for (let i = 0; i < 7; i++) await banco.salvarRegistro(guardado());

    await sincronizador.sincronizar();
    expect(transporte.chamadas).toBe(3);   // 3 + 3 + 1
    expect(transporte.quantidadeGravada).toBe(7);
  });

  it('carimba o horário do servidor nos registros aceitos', async () => {
    const transporte = new TransporteMemoria({ agora: () => new Date('2026-09-14T18:00:00.000Z') });
    const sincronizador = new Sincronizador(banco, transporte);
    const item = guardado();
    await banco.salvarRegistro(item);

    await sincronizador.sincronizar();
    expect((await banco.lerRegistro(item.id))?.registro.timestampServidor)
      .toBe('2026-09-14T18:00:00.000Z');
  });

  it('o carimbo do servidor não mexe no hash da evidência de campo', async () => {
    const transporte = new TransporteMemoria();
    const sincronizador = new Sincronizador(banco, transporte);
    const item = guardado();
    await banco.salvarRegistro(item);

    await sincronizador.sincronizar();
    expect((await banco.lerRegistro(item.id))?.registro.hashConteudo).toBe(item.registro.hashConteudo);
  });

  it('registro adulterado é recusado pelo servidor e marcado para alguém olhar', async () => {
    const transporte = new TransporteMemoria();
    const sincronizador = new Sincronizador(banco, transporte);
    const item = guardado();
    // Peso trocado depois de assinado: o hash guardado não fecha mais.
    const adulterado: RegistroGuardado = {
      ...item,
      registro: { ...item.registro, conteudo: { ...item.registro.conteudo, pesoKg: 999 } },
    };
    await banco.salvarRegistro(adulterado);

    const resultado = await sincronizador.sincronizar();
    expect(resultado.rejeitados).toBe(1);
    expect(transporte.quantidadeGravada).toBe(0);
    const fila = await banco.itensDaFila('falhou');
    expect(fila[0]?.ultimoErro).toMatch(/hash/);
  });

  it('desiste depois do limite de tentativas, em vez de insistir para sempre', async () => {
    const transporte = new TransporteMemoria({ offline: true });
    const sincronizador = new Sincronizador(banco, transporte, { maxTentativas: 2 });
    await banco.salvarRegistro(guardado());

    await sincronizador.sincronizar();
    expect((await banco.contarFila()).pendente).toBe(1);
    await sincronizador.sincronizar();
    expect((await banco.contarFila()).falhou).toBe(1);
  });

  it('não roda dois ciclos ao mesmo tempo', async () => {
    const transporte = new TransporteMemoria();
    const sincronizador = new Sincronizador(banco, transporte);
    await banco.salvarRegistro(guardado());

    const [a, b] = await Promise.all([sincronizador.sincronizar(), sincronizador.sincronizar()]);
    const erros = [a.erro, b.erro].filter(e => e?.includes('andamento'));
    expect(erros).toHaveLength(1);
    expect(transporte.quantidadeGravada).toBe(1);
  });

  it('fila vazia é operação barata, não erro', async () => {
    const sincronizador = new Sincronizador(banco, new TransporteMemoria());
    expect(await sincronizador.sincronizar()).toMatchObject({ enviados: 0, erro: null });
  });
});
