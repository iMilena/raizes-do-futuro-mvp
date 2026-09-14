/* ---------------------------------------------------------------------------
   O sincronizador: sobe a fila quando dá, sem duplicar e sem perder.

   O problema real que ele resolve não é "enviar dados". É este: o catador
   registra 14 coletas na praia sem sinal, guarda o celular, e às cinco da tarde
   passa perto do ponto com wi-fi por três minutos. No meio do envio a conexão
   cai. O que acontece com o registro número 8?

   Três respostas erradas, e a que este arquivo implementa:

     · reenviar tudo do zero: duplica registro, e registro duplicado vira peso
       duplicado, que vira dinheiro duplicado no cofre. Inaceitável.
     · marcar como enviado e seguir: perde a coleta de alguém. Pior ainda.
     · perguntar ao servidor o que ele já tem, e agir sobre a resposta. É isto.

   O ciclo, portanto, tem duas fases:

     1. RECONCILIAR. Todo item preso em "enviando" (o app morreu no meio, a
        resposta se perdeu) é confrontado com o servidor: ele tem? então está
        enviado. Não tem? volta para pendente.
     2. ENVIAR. Os pendentes sobem em lotes pequenos, um lote por vez.

   Lote pequeno de propósito: em rede de ilha, mandar 200 registros de uma vez
   significa recomeçar 200 quando cair. Com lotes de 10, o prejuízo de uma queda
   é um lote.
--------------------------------------------------------------------------- */
import type { BancoLocal, RegistroGuardado } from '../armazenamento/bd.js';
import type { ItemFila, RegistroEvidencia } from '../dominio/tipos.js';
import { ErroTransporte } from './transporte.js';
import type { TransporteSincronizacao } from './transporte.js';

export interface OpcoesSincronizacao {
  /** Quantos registros por requisição. */
  tamanhoLote?: number;
  /** Tentativas antes de marcar como falhou e parar de insistir sozinho. */
  maxTentativas?: number;
}

export interface ResultadoSincronizacao {
  enviados: number;
  /** Itens que o servidor já tinha: a prova de que a idempotência funcionou. */
  reconciliados: number;
  rejeitados: number;
  /** Ficaram para a próxima janela de rede. */
  pendentes: number;
  falharam: number;
  erro: string | null;
}

const RESULTADO_VAZIO: ResultadoSincronizacao = {
  enviados: 0, reconciliados: 0, rejeitados: 0, pendentes: 0, falharam: 0, erro: null,
};

export class Sincronizador {
  private rodando = false;

  constructor(
    private readonly banco: BancoLocal,
    private readonly transporte: TransporteSincronizacao,
    private readonly opcoes: OpcoesSincronizacao = {},
  ) {}

  private get tamanhoLote(): number {
    return this.opcoes.tamanhoLote ?? 10;
  }

  private get maxTentativas(): number {
    return this.opcoes.maxTentativas ?? 5;
  }

  /**
   * Roda um ciclo completo.
   *
   * A trava `rodando` não é zelo excessivo: o app chama isto no evento `online`,
   * num temporizador e no botão de sincronizar. Sem a trava, voltar a rede
   * enquanto um ciclo está no ar faria dois ciclos lerem a mesma fila pendente e
   * enviarem o mesmo registro duas vezes. O servidor é idempotente e aguentaria,
   * mas contar com isso para corrigir bug local é desenho ruim.
   */
  async sincronizar(): Promise<ResultadoSincronizacao> {
    if (this.rodando) return { ...RESULTADO_VAZIO, erro: 'já existe uma sincronização em andamento' };
    this.rodando = true;
    try {
      const reconciliados = await this.reconciliar();
      const resultado = await this.enviarPendentes();
      const contagem = await this.banco.contarFila();
      return {
        ...resultado,
        reconciliados,
        pendentes: contagem.pendente + contagem.enviando,
        falharam: contagem.falhou,
      };
    } finally {
      this.rodando = false;
    }
  }

  /** Resolve o que ficou preso em "enviando". */
  private async reconciliar(): Promise<number> {
    const presos = await this.banco.itensDaFila('enviando');
    if (presos.length === 0) return 0;

    let resolvidos = 0;
    try {
      const noServidor = new Set(await this.transporte.jaRecebidos(presos.map(i => i.id)));
      const atualizados: ItemFila[] = presos.map(item => {
        if (noServidor.has(item.id)) {
          resolvidos++;
          return { ...item, situacao: 'enviado', ultimoErro: null };
        }
        return { ...item, situacao: 'pendente' };
      });
      await this.banco.atualizarItensFila(atualizados);
    } catch {
      /* Sem rede também para reconciliar. Devolver tudo para pendente seria
         arriscar duplicar; deixar preso em "enviando" seria travar a fila para
         sempre. Fica como está: a próxima janela de rede resolve, e é por isso
         que a reconciliação é a primeira fase de todo ciclo. */
      return 0;
    }
    return resolvidos;
  }

  private async enviarPendentes(): Promise<ResultadoSincronizacao> {
    const pendentes = await this.banco.itensDaFila('pendente');
    if (pendentes.length === 0) return { ...RESULTADO_VAZIO };

    let enviados = 0;
    let rejeitados = 0;
    let erro: string | null = null;

    for (let i = 0; i < pendentes.length; i += this.tamanhoLote) {
      const lote = pendentes.slice(i, i + this.tamanhoLote);
      const guardados = await this.carregarRegistros(lote);
      if (guardados.length === 0) continue;

      // Marca "enviando" ANTES de enviar. É esta marca que a reconciliação lê
      // depois, se o app morrer no meio do envio.
      await this.banco.atualizarItensFila(lote.map(item => ({ ...item, situacao: 'enviando' as const })));

      try {
        const resposta = await this.transporte.enviar(guardados.map(g => g.registro));
        const aceitos = new Set(resposta.aceitos);
        const motivoPorId = new Map(resposta.rejeitados.map(r => [r.id, r.motivo]));

        const atualizados: ItemFila[] = lote.map(item => {
          if (aceitos.has(item.id)) {
            enviados++;
            return { ...item, situacao: 'enviado' as const, ultimoErro: null };
          }
          const motivo = motivoPorId.get(item.id) ?? 'o servidor não confirmou o registro';
          rejeitados++;
          // Rejeição por regra não melhora com insistência: vai direto para
          // "falhou", que é a situação que o painel mostra para alguém olhar.
          return {
            ...item, situacao: 'falhou' as const,
            tentativas: item.tentativas + 1, ultimoErro: motivo,
          };
        });
        await this.banco.atualizarItensFila(atualizados);

        // Carimbo do servidor no registro: segunda testemunha do tempo, ao lado
        // do relógio do aparelho, que pode estar errado.
        await this.carimbarServidor(guardados.filter(g => aceitos.has(g.id)), resposta.timestampServidor);
      } catch (e) {
        const recuperavel = e instanceof ErroTransporte ? e.recuperavel : true;
        erro = e instanceof Error ? e.message : String(e);

        const atualizados: ItemFila[] = lote.map(item => {
          const tentativas = item.tentativas + 1;
          const desistir = !recuperavel || tentativas >= this.maxTentativas;
          return {
            ...item,
            /* Volta para "pendente", nunca direto para "enviado": daqui não dá
               para saber se o servidor gravou. Quem descobre isso é a
               reconciliação do próximo ciclo, perguntando ao servidor. */
            situacao: desistir ? ('falhou' as const) : ('pendente' as const),
            tentativas, ultimoErro: erro,
          };
        });
        await this.banco.atualizarItensFila(atualizados);
        break; // rede caiu: não adianta tentar os próximos lotes agora
      }
    }

    return { ...RESULTADO_VAZIO, enviados, rejeitados, erro };
  }

  private async carregarRegistros(itens: ItemFila[]): Promise<RegistroGuardado[]> {
    const guardados: RegistroGuardado[] = [];
    for (const item of itens) {
      const registro = await this.banco.lerRegistro(item.id);
      if (registro) guardados.push(registro);
    }
    return guardados;
  }

  private async carimbarServidor(guardados: RegistroGuardado[], timestamp: string): Promise<void> {
    for (const guardado of guardados) {
      if (guardado.registro.timestampServidor !== null) continue;
      const registro: RegistroEvidencia = { ...guardado.registro, timestampServidor: timestamp };
      await this.banco.atualizarRegistro({ ...guardado, registro });
    }
  }
}
