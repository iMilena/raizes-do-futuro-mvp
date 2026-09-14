/* ---------------------------------------------------------------------------
   Ancoradora de mentira, com comportamento de verdade.

   Não é um esqueleto: ela guarda estado, é idempotente por dia, recusa ancorar
   raiz diferente para um dia já fechado e sabe falhar quando mandam falhar.
   Serve para três coisas concretas:

     · rodar o módulo inteiro ponta a ponta sem depender de rede nem de chave
     · testar o caminho de erro, que é o caminho que a ilha percorre com
       frequência (rede que cai no meio do envio)
     · deixar um alvo executável para a equipe de blockchain: a implementação
       real tem de passar nos mesmos testes desta, em testes/validacao/ancoragem.test.ts
--------------------------------------------------------------------------- */
import type { PayloadAncoragem } from './lote-diario.js';
import { ErroAncoragem } from './ancoradora.js';
import type { Ancoradora, ReciboAncoragem } from './ancoradora.js';
import { keccak256Canonico } from '../dominio/keccak.js';

export interface OpcoesMock {
  rede?: string;
  /** Falhas de rede a simular antes de cada sucesso. Zera a cada ancoragem bem sucedida. */
  falhasAntesDeSucesso?: number;
  /** Relógio injetável, para o teste não depender do horário da máquina. */
  agora?: () => Date;
}

export class AncoradoraMock implements Ancoradora {
  readonly rede: string;
  private readonly recibos = new Map<string, ReciboAncoragem>();
  private readonly agora: () => Date;
  private falhasRestantes: number;
  private readonly falhasConfiguradas: number;
  /** Quantas transações foram realmente gravadas. O teste de idempotência olha isto. */
  private _transacoes = 0;

  constructor(opcoes: OpcoesMock = {}) {
    this.rede = opcoes.rede ?? 'mock-devnet';
    this.agora = opcoes.agora ?? (() => new Date());
    this.falhasConfiguradas = opcoes.falhasAntesDeSucesso ?? 0;
    this.falhasRestantes = this.falhasConfiguradas;
  }

  get transacoesGravadas(): number {
    return this._transacoes;
  }

  async ancorar(payload: PayloadAncoragem): Promise<ReciboAncoragem> {
    const existente = this.recibos.get(payload.dataLote);
    if (existente) {
      /* Já ancorado. Mesma raiz devolve o mesmo recibo (a rede caiu depois de
         gravar, e o app está perguntando de novo). Raiz diferente é outra
         história: significa que o lote do dia mudou depois de fechado, e isso
         precisa de gente olhando, não de retentativa. */
      if (existente.merkleRoot.toLowerCase() !== payload.merkleRoot.toLowerCase()) {
        throw new ErroAncoragem(
          `o dia ${payload.dataLote} já foi ancorado com outra raiz `
          + `(${existente.merkleRoot}). Um lote fechado não muda.`,
          false,
        );
      }
      return existente;
    }

    if (this.falhasRestantes > 0) {
      this.falhasRestantes--;
      throw new ErroAncoragem('rede indisponível ao enviar a transação', true);
    }
    this.falhasRestantes = this.falhasConfiguradas;

    const idTransacao = keccak256Canonico({ ...payload, rede: this.rede }).slice(2, 42);
    const recibo: ReciboAncoragem = {
      dataLote: payload.dataLote,
      merkleRoot: payload.merkleRoot,
      idTransacao,
      rede: this.rede,
      confirmadoEm: this.agora().toISOString(),
      url: `https://exemplo.invalido/tx/${idTransacao}`,
    };
    this.recibos.set(payload.dataLote, recibo);
    this._transacoes++;
    return recibo;
  }

  async consultar(dataLote: string): Promise<ReciboAncoragem | null> {
    return this.recibos.get(dataLote) ?? null;
  }

  async raizAncorada(dataLote: string): Promise<string | null> {
    return this.recibos.get(dataLote)?.merkleRoot ?? null;
  }
}
