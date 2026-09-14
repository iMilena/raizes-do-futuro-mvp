/* ---------------------------------------------------------------------------
   O transporte: como o registro sai do aparelho.

   Interface, e não implementação, pelo mesmo motivo da ancoradora: a base
   compartilhada do projeto é o Supabase (ver src/lib/nuvem.js), mas o módulo de
   validação não precisa saber disso, e amarrá-lo agora impediria de testar o
   caminho que mais importa, que é o da falha.

   IDEMPOTÊNCIA É OBRIGAÇÃO DO SERVIDOR, e está escrita aqui como contrato:
   receber duas vezes o mesmo `conteudo.id` tem de gravar uma vez só. O id é
   gerado no aparelho justamente para isso. A alternativa (o servidor gerar o id)
   não funciona offline: o registro precisa existir e ter identidade antes de
   qualquer rede.

   O esquema do banco compartilhado já trabalha assim, ver
   supabase/migracoes/01-chave-e-idempotencia.sql.
--------------------------------------------------------------------------- */
import type { RegistroEvidencia } from '../dominio/tipos.js';

export interface RespostaEnvio {
  /** Ids gravados agora OU que já estavam lá. Para quem envia, dá no mesmo. */
  aceitos: string[];
  /** Ids que o servidor recusou, com motivo legível. Não adianta reenviar. */
  rejeitados: Array<{ id: string; motivo: string }>;
  /** Carimbo de tempo do servidor, que entra no registro como segunda testemunha. */
  timestampServidor: string;
}

export class ErroTransporte extends Error {
  constructor(mensagem: string, public readonly recuperavel = true) {
    super(mensagem);
    this.name = 'ErroTransporte';
  }
}

export interface TransporteSincronizacao {
  /**
   * Envia um lote de registros.
   *
   * Pode falhar de três jeitos, e os três acontecem na ilha:
   *   · não chega ao servidor (sem rede): lança ErroTransporte recuperável
   *   · chega, grava, e a resposta se perde no caminho de volta: quem chamou
   *     não sabe se gravou. É por isso que existe `jaRecebidos`.
   *   · chega e o servidor recusa por regra: vem em `rejeitados`, não lança.
   */
  enviar(registros: RegistroEvidencia[]): Promise<RespostaEnvio>;

  /**
   * Quais destes ids o servidor já tem?
   *
   * É a reconciliação. Sem ela, todo registro que ficou preso em "enviando"
   * (celular desligou no meio, rede caiu depois do envio) teria de ser reenviado
   * no escuro, e a decisão entre duplicar e perder ficaria no chute.
   */
  jaRecebidos(ids: string[]): Promise<string[]>;
}
