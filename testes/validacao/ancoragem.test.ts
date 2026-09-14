/* ---------------------------------------------------------------------------
   Merkle, lote diário e ancoragem.

   A suíte também é a especificação executável para a equipe de blockchain: a
   implementação real de `Ancoradora` tem de passar no bloco "contrato da
   ancoradora" sem mudar uma linha dos testes.
--------------------------------------------------------------------------- */
import { describe, expect, it } from 'vitest';
import {
  alturaDaArvore, combinar, construirArvore, folhaDe, provaDeInclusao,
  RAIZ_VAZIA, verificarProva,
} from '../../src/validacao/dominio/merkle.js';
import {
  agruparPorDia, dataLoteDe, montarLote, montarLotes, provaDeColeta, verificarProvaDeColeta,
} from '../../src/validacao/ancoragem/lote-diario.js';
import { AncoradoraMock } from '../../src/validacao/ancoragem/ancoradora-mock.js';
import { ErroAncoragem } from '../../src/validacao/ancoragem/ancoradora.js';
import { montarRegistro } from '../../src/validacao/dominio/registro.js';
import { varrerDadoPessoal } from '../../src/validacao/dominio/esquema-evidencia.js';
import type { ClasseMaterial, RegistroEvidencia } from '../../src/validacao/dominio/tipos.js';
import { conteudoDeTeste } from './fixtures.js';

let sequencia = 0;
function registroDe(opcoes: {
  peso?: number; quando?: string; classe?: ClasseMaterial; sinalizado?: boolean;
} = {}): RegistroEvidencia {
  sequencia++;
  const classe = opcoes.classe ?? 'PET';
  const { versaoEsquema: _v, ...base } = conteudoDeTeste({
    id: `3f2504e0-4f89-41d3-9a0c-0305e82c${String(sequencia).padStart(4, '0')}`,
    pesoKg: opcoes.peso ?? 10,
    timestampDispositivo: opcoes.quando ?? '2026-09-14T12:00:00.000Z',
    pHash: sequencia.toString(16).padStart(16, '0'),
    classificacao: {
      classeSugerida: classe, classeFinal: classe, confianca: 0.9,
      corrigidoPorHumano: false, versaoModelo: 'classificador-v1',
    },
  });
  return montarRegistro(base, opcoes.sinalizado
    ? [{ codigo: 'peso_incoerente', gravidade: 'atencao', motivo: 'teste de sinalização' }]
    : []);
}

const hashes = (n: number) =>
  Array.from({ length: n }, (_, i) => '0x' + String(i + 1).padStart(64, '0'));

describe('árvore de Merkle', () => {
  it('dia sem coleta tem raiz zero, e isso não é erro', () => {
    const arvore = construirArvore([]);
    expect(arvore.raiz).toBe(RAIZ_VAZIA);
    expect(arvore.folhas).toEqual([]);
  });

  it('um registro só vira raiz igual à própria folha', () => {
    const arvore = construirArvore(hashes(1));
    expect(arvore.raiz).toBe(folhaDe(hashes(1)[0]!));
    expect(alturaDaArvore(arvore)).toBe(0);
  });

  it('a raiz não depende da ordem em que a fila subiu', () => {
    const lista = hashes(7);
    const embaralhada = [lista[4]!, lista[0]!, lista[6]!, lista[2]!, lista[1]!, lista[5]!, lista[3]!];
    expect(construirArvore(lista).raiz).toBe(construirArvore(embaralhada).raiz);
  });

  it('a raiz muda quando um registro entra ou sai', () => {
    expect(construirArvore(hashes(5)).raiz).not.toBe(construirArvore(hashes(6)).raiz);
  });

  it('a folha é o hash do hash, para nó interno não se passar por folha', () => {
    const lista = hashes(2);
    const arvore = construirArvore(lista);
    const noInterno = arvore.raiz;
    // Tentar provar a inclusão de um "registro" cujo hash seja um nó interno falha.
    expect(verificarProva(noInterno, [], arvore.raiz)).toBe(false);
  });

  it('o par é ordenado, então combinar independe da ordem dos argumentos', () => {
    const [a, b] = [folhaDe(hashes(2)[0]!), folhaDe(hashes(2)[1]!)];
    expect(combinar(a!, b!)).toBe(combinar(b!, a!));
  });

  describe('prova de inclusão', () => {
    /* Quantidades ímpares e potências de dois cobrem os dois caminhos da
       construção: nível par e nó que sobe sozinho. */
    for (const quantidade of [1, 2, 3, 4, 5, 8, 9, 17, 64]) {
      it(`funciona para todos os ${quantidade} registros do lote`, () => {
        const lista = hashes(quantidade);
        const arvore = construirArvore(lista);
        for (const hash of lista) {
          const prova = provaDeInclusao(arvore, hash);
          expect(prova).not.toBeNull();
          expect(verificarProva(hash, prova!, arvore.raiz)).toBe(true);
        }
      });
    }

    it('devolve null para registro que não está no lote', () => {
      const arvore = construirArvore(hashes(5));
      expect(provaDeInclusao(arvore, '0x' + 'ab'.repeat(32))).toBeNull();
    });

    it('prova de um registro não serve para outro', () => {
      const lista = hashes(8);
      const arvore = construirArvore(lista);
      const prova = provaDeInclusao(arvore, lista[3]!)!;
      expect(verificarProva(lista[4]!, prova, arvore.raiz)).toBe(false);
    });

    it('prova adulterada não passa', () => {
      const lista = hashes(8);
      const arvore = construirArvore(lista);
      const prova = provaDeInclusao(arvore, lista[3]!)!;
      const adulterada = [...prova];
      adulterada[0] = '0x' + 'ff'.repeat(32);
      expect(verificarProva(lista[3]!, adulterada, arvore.raiz)).toBe(false);
    });

    it('prova válida não passa contra a raiz de outro dia', () => {
      const arvoreA = construirArvore(hashes(8));
      const arvoreB = construirArvore(hashes(9));
      const prova = provaDeInclusao(arvoreA, hashes(8)[2]!)!;
      expect(verificarProva(hashes(8)[2]!, prova, arvoreB.raiz)).toBe(false);
    });

    it('a prova cresce como o logaritmo do lote, não como o lote', () => {
      const arvore = construirArvore(hashes(64));
      expect(provaDeInclusao(arvore, hashes(64)[0]!)!.length).toBeLessThanOrEqual(6);
    });
  });
});

describe('dia de operação', () => {
  it('usa o fuso de Boipeba, não o do aparelho', () => {
    // 01:30 UTC ainda é dia 13 na Bahia (22:30). Usar o dia UTC jogaria a
    // coleta da noite no lote do dia seguinte.
    expect(dataLoteDe('2026-09-14T01:30:00.000Z')).toBe('2026-09-13');
    expect(dataLoteDe('2026-09-14T12:00:00.000Z')).toBe('2026-09-14');
    expect(dataLoteDe('2026-09-14T02:59:00.000Z')).toBe('2026-09-13');
    expect(dataLoteDe('2026-09-14T03:01:00.000Z')).toBe('2026-09-14');
  });

  it('separa os registros por dia', () => {
    const grupos = agruparPorDia([
      registroDe({ quando: '2026-09-14T12:00:00.000Z' }),
      registroDe({ quando: '2026-09-14T23:00:00.000Z' }),
      registroDe({ quando: '2026-09-15T12:00:00.000Z' }),
    ]);
    expect([...grupos.keys()].sort()).toEqual(['2026-09-14', '2026-09-15']);
    expect(grupos.get('2026-09-14')).toHaveLength(2);
  });

  it('recusa timestamp inválido em vez de inventar um dia', () => {
    expect(() => dataLoteDe('ontem de manhã')).toThrow();
  });
});

describe('lote diário', () => {
  const registros = [
    registroDe({ peso: 12.5, classe: 'PET' }),
    registroDe({ peso: 8.25, classe: 'PET' }),
    registroDe({ peso: 30, classe: 'vidro', sinalizado: true }),
    registroDe({ peso: 5.5, classe: 'aluminio' }),
  ];

  it('soma peso por material e no total', () => {
    const lote = montarLote('2026-09-14', registros);
    expect(lote.payload.quantidadeRegistros).toBe(4);
    expect(lote.payload.pesoPorMaterial.PET).toBe(20.75);
    expect(lote.payload.pesoPorMaterial.vidro).toBe(30);
    expect(lote.payload.pesoTotalKg).toBe(56.25);
    expect(lote.payload.quantidadeSinalizados).toBe(1);
  });

  it('inclui registro sinalizado que ainda espera revisão, e conta separado', () => {
    const lote = montarLote('2026-09-14', registros);
    expect(lote.registros).toHaveLength(4);
    expect(lote.payload.quantidadeSinalizados).toBe(1);
  });

  it('deixa de fora o que a revisão humana rejeitou', () => {
    const rejeitado: RegistroEvidencia = {
      ...registroDe({ peso: 100 }),
      revisao: {
        decisao: 'rejeitado', autor: 'coordenacao-viva',
        justificativa: 'pilha já contada de manhã', timestamp: '2026-09-14T18:00:00.000Z',
      },
    };
    const lote = montarLote('2026-09-14', [...registros, rejeitado]);
    expect(lote.payload.quantidadeRegistros).toBe(4);
    expect(lote.payload.pesoTotalKg).toBe(56.25);
  });

  it('dia sem coleta gera lote válido, com raiz zero', () => {
    const lote = montarLote('2026-09-20', registros);
    expect(lote.payload.quantidadeRegistros).toBe(0);
    expect(lote.payload.merkleRoot).toBe(RAIZ_VAZIA);
    expect(lote.payload.pesoTotalKg).toBe(0);
  });

  it('monta um lote por dia presente nos registros', () => {
    const lotes = montarLotes([
      registroDe({ quando: '2026-09-14T12:00:00.000Z' }),
      registroDe({ quando: '2026-09-15T12:00:00.000Z' }),
    ]);
    expect(lotes.map(l => l.dataLote)).toEqual(['2026-09-14', '2026-09-15']);
  });

  it('soma sem lixo de ponto flutuante na raiz que vai para a cadeia', () => {
    const lote = montarLote('2026-09-14', [
      registroDe({ peso: 0.1 }), registroDe({ peso: 0.2 }),
    ]);
    expect(lote.payload.pesoTotalKg).toBe(0.3);
  });
});

describe('fronteira on-chain', () => {
  const lote = montarLote('2026-09-14', [
    registroDe({ peso: 12.5 }), registroDe({ peso: 30, classe: 'vidro', sinalizado: true }),
  ]);

  it('o payload não carrega nenhum dado pessoal, e a varredura confirma', () => {
    const achados = Object.entries(lote.payload)
      .flatMap(([chave, valor]) => varrerDadoPessoal(valor, `$.${chave}`));
    expect(achados).toEqual([]);
  });

  it('o payload não carrega pHash, geohash, pseudônimo, foto nem id de registro', () => {
    const serializado = JSON.stringify(lote.payload);
    for (const registro of lote.registros) {
      expect(serializado).not.toContain(registro.conteudo.pHash);
      expect(serializado).not.toContain(registro.conteudo.geohash);
      expect(serializado).not.toContain(registro.conteudo.coletorPseudonimo);
      expect(serializado).not.toContain(registro.conteudo.id);
      expect(serializado).not.toContain(registro.conteudo.pontoColetaId);
      expect(serializado).not.toContain(registro.hashConteudo);
    }
  });

  it('o payload tem exatamente os campos da lista branca', () => {
    expect(Object.keys(lote.payload).sort()).toEqual([
      'dataLote', 'merkleRoot', 'pesoPorMaterial', 'pesoTotalKg',
      'quantidadeRegistros', 'quantidadeSinalizados', 'versaoEsquema',
    ]);
  });

  it('a raiz não permite recuperar nenhum registro: só confirmar os que já se tem', () => {
    // A raiz é 32 bytes para um lote de qualquer tamanho. Serve para verificar,
    // nunca para reconstruir. Este teste registra a propriedade em forma de código.
    expect(lote.payload.merkleRoot).toMatch(/^0x[0-9a-f]{64}$/);
    expect(lote.payload.merkleRoot).not.toContain(lote.registros[0]!.conteudo.pHash);
  });
});

describe('prova de coleta para o comprador do relatório', () => {
  const registros = [registroDe({ peso: 12.5 }), registroDe({ peso: 9 }), registroDe({ peso: 30 })];
  const lote = montarLote('2026-09-14', registros);

  it('gera prova verificável contra a raiz que está na cadeia', () => {
    const prova = provaDeColeta(lote, registros[1]!.hashConteudo)!;
    expect(verificarProvaDeColeta(prova, lote.payload.merkleRoot)).toBe(true);
  });

  it('não valida contra raiz de outro dia', () => {
    const prova = provaDeColeta(lote, registros[1]!.hashConteudo)!;
    expect(verificarProvaDeColeta(prova, '0x' + 'cd'.repeat(32))).toBe(false);
  });

  it('coleta que não está no lote não gera prova', () => {
    expect(provaDeColeta(lote, '0x' + 'ee'.repeat(32))).toBeNull();
  });
});

describe('contrato da ancoradora', () => {
  /* Estes testes valem para QUALQUER implementação de Ancoradora, mock ou real. */
  const payloadDe = (dia: string) => montarLote(dia, [registroDe({ quando: `${dia}T12:00:00.000Z` })]).payload;

  it('ancora o lote e devolve recibo com raiz, transação e rede', async () => {
    const ancoradora = new AncoradoraMock();
    const recibo = await ancoradora.ancorar(payloadDe('2026-09-14'));
    expect(recibo.dataLote).toBe('2026-09-14');
    expect(recibo.merkleRoot).toMatch(/^0x[0-9a-f]{64}$/);
    expect(recibo.idTransacao.length).toBeGreaterThan(0);
    expect(recibo.rede).toBe('mock-devnet');
  });

  it('é idempotente: ancorar o mesmo dia de novo não gera segunda transação', async () => {
    const ancoradora = new AncoradoraMock();
    const payload = payloadDe('2026-09-14');
    const primeiro = await ancoradora.ancorar(payload);
    const segundo = await ancoradora.ancorar(payload);
    expect(segundo).toEqual(primeiro);
    expect(ancoradora.transacoesGravadas).toBe(1);
  });

  it('recusa mudar a raiz de um dia já ancorado, e o erro não pede retentativa', async () => {
    const ancoradora = new AncoradoraMock();
    await ancoradora.ancorar(payloadDe('2026-09-14'));
    const outro = { ...payloadDe('2026-09-14'), merkleRoot: '0x' + 'aa'.repeat(32) };

    await expect(ancoradora.ancorar(outro)).rejects.toThrow(ErroAncoragem);
    await ancoradora.ancorar(outro).catch((e: ErroAncoragem) => {
      expect(e.recuperavel).toBe(false);
    });
  });

  it('falha de rede é recuperável, e a retentativa fecha o dia sem duplicar', async () => {
    const ancoradora = new AncoradoraMock({ falhasAntesDeSucesso: 2 });
    const payload = payloadDe('2026-09-14');

    await expect(ancoradora.ancorar(payload)).rejects.toMatchObject({ recuperavel: true });
    await expect(ancoradora.ancorar(payload)).rejects.toMatchObject({ recuperavel: true });
    const recibo = await ancoradora.ancorar(payload);

    expect(recibo.merkleRoot).toBe(payload.merkleRoot);
    expect(ancoradora.transacoesGravadas).toBe(1);
  });

  it('consultar dia não ancorado devolve null, não erro', async () => {
    const ancoradora = new AncoradoraMock();
    expect(await ancoradora.consultar('2026-01-01')).toBeNull();
    expect(await ancoradora.raizAncorada('2026-01-01')).toBeNull();
  });

  it('a prova de uma coleta bate com a raiz que a ancoradora devolve', async () => {
    const ancoradora = new AncoradoraMock();
    const registros = [registroDe({ peso: 12 }), registroDe({ peso: 7 })];
    const lote = montarLote('2026-09-14', registros);
    await ancoradora.ancorar(lote.payload);

    const naCadeia = await ancoradora.raizAncorada('2026-09-14');
    const prova = provaDeColeta(lote, registros[0]!.hashConteudo)!;
    expect(verificarProvaDeColeta(prova, naCadeia!)).toBe(true);
  });
});
