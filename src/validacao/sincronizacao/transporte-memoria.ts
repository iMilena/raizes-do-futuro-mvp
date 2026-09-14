/* ---------------------------------------------------------------------------
   Transporte em memória: um servidor de mentira que erra como o de verdade.

   Serve para duas coisas. A primeira é o app rodar ponta a ponta na demonstração
   sem depender de Supabase configurado. A segunda, mais importante, é poder
   testar o que não dá para testar com servidor de verdade: a resposta que se
   perde DEPOIS da gravação, que é exatamente o caso em que um sincronizador mal
   feito duplica registro.

   `falharDepoisDeGravar` existe só por causa disso.
--------------------------------------------------------------------------- */
import { ErroTransporte } from './transporte.js';
import type { RespostaEnvio, TransporteSincronizacao } from './transporte.js';
import { validarRegistro } from '../dominio/esquema-evidencia.js';
import { hashConfere } from '../dominio/registro.js';
import type { RegistroEvidencia } from '../dominio/tipos.js';

export interface OpcoesTransporteMemoria {
  /** Simula "sem rede": lança antes de gravar. */
  offline?: boolean;
  /** Lança DEPOIS de gravar, imitando resposta perdida na volta. */
  falharDepoisDeGravar?: boolean;
  /** Relógio injetável. */
  agora?: () => Date;
}

export class TransporteMemoria implements TransporteSincronizacao {
  /** O "banco" do servidor. Chave é o id do registro, e é só isso que garante idempotência. */
  private readonly gravados = new Map<string, RegistroEvidencia>();
  /** Quantas vezes `enviar` foi chamado. O teste de retentativa olha isto. */
  chamadas = 0;

  offline: boolean;
  falharDepoisDeGravar: boolean;
  private readonly agora: () => Date;

  constructor(opcoes: OpcoesTransporteMemoria = {}) {
    this.offline = opcoes.offline ?? false;
    this.falharDepoisDeGravar = opcoes.falharDepoisDeGravar ?? false;
    this.agora = opcoes.agora ?? (() => new Date());
  }

  get quantidadeGravada(): number {
    return this.gravados.size;
  }

  listar(): RegistroEvidencia[] {
    return [...this.gravados.values()];
  }

  async enviar(registros: RegistroEvidencia[]): Promise<RespostaEnvio> {
    this.chamadas++;
    if (this.offline) throw new ErroTransporte('sem conexão', true);

    const aceitos: string[] = [];
    const rejeitados: Array<{ id: string; motivo: string }> = [];

    for (const registro of registros) {
      const problemas = validarRegistro(registro);
      if (problemas.length > 0) {
        rejeitados.push({ id: registro.conteudo.id, motivo: problemas.join('; ') });
        continue;
      }
      /* O servidor reconfere o hash. Sem isso, um registro adulterado no caminho
         entraria na árvore de Merkle do dia com hash que não corresponde ao
         conteúdo, e a prova de inclusão apontaria para uma evidência falsa. */
      if (!hashConfere(registro)) {
        rejeitados.push({ id: registro.conteudo.id, motivo: 'hash não corresponde ao conteúdo' });
        continue;
      }

      // Idempotência: id repetido não grava de novo, e mesmo assim é aceito.
      if (!this.gravados.has(registro.conteudo.id)) {
        this.gravados.set(registro.conteudo.id, registro);
      }
      aceitos.push(registro.conteudo.id);
    }

    if (this.falharDepoisDeGravar) {
      throw new ErroTransporte('a conexão caiu depois do servidor gravar', true);
    }

    return { aceitos, rejeitados, timestampServidor: this.agora().toISOString() };
  }

  async jaRecebidos(ids: string[]): Promise<string[]> {
    if (this.offline) throw new ErroTransporte('sem conexão', true);
    return ids.filter(id => this.gravados.has(id));
  }
}
