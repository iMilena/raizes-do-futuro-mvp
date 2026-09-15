/* ---------------------------------------------------------------------------
   Banco local, em IndexedDB.

   É o banco de verdade do app de campo, não um cache. Em Boipeba a rede é a
   exceção, não a regra: o registro nasce aqui, vive aqui, e a nuvem é uma cópia
   que chega quando chegar.

   Por que IndexedDB e não localStorage (que o resto do app usa, ver
   src/estado/store.jsx): localStorage guarda texto, tem uns 5 MB e é síncrono.
   Aqui precisamos guardar foto (Blob, megabytes), índice por dia e por situação,
   e não travar a interface enquanto grava. localStorage não faz nada disso.

   Sem a biblioteca `idb`: são três funções de promessa em cima da API nativa, e
   o app de campo tem de baixar em 3G de ilha.

   Cinco depósitos, e a separação entre eles é decisão de LGPD, não arrumação:

     registros   evidência sem foto, fica para sempre (é o que sustenta auditoria)
     fotos       o arquivo, separado, para poder ser apagado sozinho depois
     fila        o que falta subir
     ancoragens  recibo do lote diário
     chaves      o par de chaves do aparelho, que assina cada registro
--------------------------------------------------------------------------- */
import type { ItemFila, RegistroEvidencia, SituacaoFila } from '../dominio/tipos.js';

export const NOME_BANCO = 'raizes-validacao';
export const VERSAO_BANCO = 1;

export const DEPOSITOS = {
  registros: 'registros',
  fotos: 'fotos',
  fila: 'fila',
  ancoragens: 'ancoragens',
  chaves: 'chaves',
} as const;

/** Como o registro fica guardado: campos de busca no topo, evidência dentro. */
export interface RegistroGuardado {
  id: string;
  /** Dia de operação, para montar o lote sem varrer tudo. */
  dataLote: string;
  /** Para ordenar e buscar os recentes na hora de rodar as detecções. */
  timestamp: string;
  registro: RegistroEvidencia;
  /**
   * Registro plantado para demonstração, e não coletado por alguém.
   *
   * Fica no ENVELOPE, e nunca dentro de `registro.conteudo`: o conteúdo é o que
   * entra no hash e no que a auditoria confere, e um campo "isto é de mentira"
   * lá dentro seria a primeira coisa que alguém aprenderia a forjar. Aqui, ele
   * serve para a tela avisar e para a limpeza saber o que remover.
   */
  demonstracao?: boolean;
}

export interface FotoGuardada {
  id: string;
  /** A foto nunca sai daqui. O que viaja é o pHash dela. */
  arquivo: Blob;
  /**
   * Instante da COLETA, não da gravação.
   *
   * A diferença importa para a retenção: o prazo da foto conta a partir do
   * momento em que ela foi tirada. Usar a hora da escrita faria um registro
   * importado ou reprocessado ganhar prazo novo, e prazo que se renova sozinho
   * não é prazo.
   */
  criadoEm: string;
}

function promessa<T>(pedido: IDBRequest<T>): Promise<T> {
  return new Promise((resolver, rejeitar) => {
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rejeitar(pedido.error ?? new Error('falha no IndexedDB'));
  });
}

function aoFim(transacao: IDBTransaction): Promise<void> {
  return new Promise((resolver, rejeitar) => {
    transacao.oncomplete = () => resolver();
    transacao.onerror = () => rejeitar(transacao.error ?? new Error('transação falhou'));
    transacao.onabort = () => rejeitar(transacao.error ?? new Error('transação abortada'));
  });
}

export function abrirBanco(nome = NOME_BANCO): Promise<IDBDatabase> {
  return new Promise((resolver, rejeitar) => {
    const pedido = indexedDB.open(nome, VERSAO_BANCO);

    pedido.onupgradeneeded = () => {
      const banco = pedido.result;

      if (!banco.objectStoreNames.contains(DEPOSITOS.registros)) {
        const deposito = banco.createObjectStore(DEPOSITOS.registros, { keyPath: 'id' });
        deposito.createIndex('por-dia', 'dataLote');
        deposito.createIndex('por-tempo', 'timestamp');
      }
      if (!banco.objectStoreNames.contains(DEPOSITOS.fotos)) {
        banco.createObjectStore(DEPOSITOS.fotos, { keyPath: 'id' });
      }
      if (!banco.objectStoreNames.contains(DEPOSITOS.fila)) {
        const deposito = banco.createObjectStore(DEPOSITOS.fila, { keyPath: 'id' });
        deposito.createIndex('por-situacao', 'situacao');
      }
      if (!banco.objectStoreNames.contains(DEPOSITOS.ancoragens)) {
        banco.createObjectStore(DEPOSITOS.ancoragens, { keyPath: 'dataLote' });
      }
      if (!banco.objectStoreNames.contains(DEPOSITOS.chaves)) {
        banco.createObjectStore(DEPOSITOS.chaves, { keyPath: 'id' });
      }
    };

    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rejeitar(pedido.error ?? new Error('não foi possível abrir o banco'));
  });
}

export class BancoLocal {
  constructor(private readonly banco: IDBDatabase) {}

  static async abrir(nome = NOME_BANCO): Promise<BancoLocal> {
    return new BancoLocal(await abrirBanco(nome));
  }

  fechar(): void {
    this.banco.close();
  }

  /* ------------------------------------------------------------ registros --- */

  /**
   * Grava registro, foto e item de fila numa transação só.
   *
   * Numa transação só de propósito: registro guardado sem entrar na fila nunca
   * sobe, e item de fila sem registro sobe vazio. A gravação é o momento em que
   * o catador solta o celular e vai cuidar da vida, então ela não pode deixar
   * estado pela metade.
   */
  async salvarRegistro(
    guardado: RegistroGuardado,
    foto?: Blob,
    opcoes: { enfileirar?: boolean } = {},
  ): Promise<void> {
    /* `enfileirar: false` existe para os dados de demonstração: eles precisam
       aparecer na tela de conferência e NÃO podem subir para lugar nenhum. Sem
       entrar na fila, não há caminho pelo qual o sincronizador os alcance, o que
       é mais seguro que filtrá-los na hora do envio e lembrar disso para sempre. */
    const enfileirar = opcoes.enfileirar ?? true;
    const depositos: string[] = [DEPOSITOS.registros];
    if (foto) depositos.push(DEPOSITOS.fotos);
    if (enfileirar) depositos.push(DEPOSITOS.fila);
    const transacao = this.banco.transaction(depositos, 'readwrite');

    transacao.objectStore(DEPOSITOS.registros).put(guardado);
    if (foto) {
      transacao.objectStore(DEPOSITOS.fotos).put({
        id: guardado.id, arquivo: foto, criadoEm: guardado.timestamp,
      } satisfies FotoGuardada);
    }
    if (enfileirar) {
      transacao.objectStore(DEPOSITOS.fila).put({
        id: guardado.id, situacao: 'pendente', tentativas: 0,
        ultimoErro: null, atualizadoEm: new Date().toISOString(),
      } satisfies ItemFila);
    }

    await aoFim(transacao);
  }

  /** Atualiza só o registro (sinalização nova, revisão, carimbo do servidor). */
  async atualizarRegistro(guardado: RegistroGuardado): Promise<void> {
    const transacao = this.banco.transaction([DEPOSITOS.registros], 'readwrite');
    transacao.objectStore(DEPOSITOS.registros).put(guardado);
    await aoFim(transacao);
  }

  /** Apaga registro, foto e item de fila de uma vez. */
  async apagarRegistro(id: string): Promise<void> {
    const transacao = this.banco.transaction(
      [DEPOSITOS.registros, DEPOSITOS.fotos, DEPOSITOS.fila], 'readwrite');
    transacao.objectStore(DEPOSITOS.registros).delete(id);
    transacao.objectStore(DEPOSITOS.fotos).delete(id);
    transacao.objectStore(DEPOSITOS.fila).delete(id);
    await aoFim(transacao);
  }

  async lerRegistro(id: string): Promise<RegistroGuardado | undefined> {
    const transacao = this.banco.transaction([DEPOSITOS.registros], 'readonly');
    return promessa(transacao.objectStore(DEPOSITOS.registros).get(id));
  }

  async listarRegistros(): Promise<RegistroGuardado[]> {
    const transacao = this.banco.transaction([DEPOSITOS.registros], 'readonly');
    return promessa(transacao.objectStore(DEPOSITOS.registros).getAll());
  }

  async registrosDoDia(dataLote: string): Promise<RegistroGuardado[]> {
    const transacao = this.banco.transaction([DEPOSITOS.registros], 'readonly');
    const indice = transacao.objectStore(DEPOSITOS.registros).index('por-dia');
    return promessa(indice.getAll(IDBKeyRange.only(dataLote)));
  }

  /**
   * Os N registros mais recentes. É a memória que as detecções antifraude usam.
   *
   * Limitado de propósito: comparar a foto nova contra tudo o que já foi
   * coletado desde o começo do projeto ficaria lento no celular, e fraude de
   * recontagem acontece em janela de horas, não de meses.
   */
  async registrosRecentes(limite = 200): Promise<RegistroGuardado[]> {
    const transacao = this.banco.transaction([DEPOSITOS.registros], 'readonly');
    const indice = transacao.objectStore(DEPOSITOS.registros).index('por-tempo');
    const encontrados: RegistroGuardado[] = [];

    await new Promise<void>((resolver, rejeitar) => {
      const cursor = indice.openCursor(null, 'prev');
      cursor.onsuccess = () => {
        const atual = cursor.result;
        if (!atual || encontrados.length >= limite) return resolver();
        encontrados.push(atual.value as RegistroGuardado);
        atual.continue();
      };
      cursor.onerror = () => rejeitar(cursor.error);
    });

    return encontrados;
  }

  /* ----------------------------------------------------------------- fotos --- */

  async lerFoto(id: string): Promise<FotoGuardada | undefined> {
    const transacao = this.banco.transaction([DEPOSITOS.fotos], 'readonly');
    return promessa(transacao.objectStore(DEPOSITOS.fotos).get(id));
  }

  /**
   * Apaga a foto e mantém o registro.
   *
   * É o que torna o direito ao esquecimento possível: a foto é o dado pessoal
   * (pode ter pessoa, casa, placa ao fundo), e o pHash dela não é reversível.
   * Apagada a foto, a evidência continua auditável e o dado pessoal some.
   */
  async apagarFoto(id: string): Promise<void> {
    const transacao = this.banco.transaction([DEPOSITOS.fotos], 'readwrite');
    transacao.objectStore(DEPOSITOS.fotos).delete(id);
    await aoFim(transacao);
  }

  /** Apaga fotos mais velhas que o prazo de retenção. */
  async apagarFotosAnterioresA(limite: Date): Promise<number> {
    const transacao = this.banco.transaction([DEPOSITOS.fotos], 'readwrite');
    const deposito = transacao.objectStore(DEPOSITOS.fotos);
    const todas = await promessa<FotoGuardada[]>(deposito.getAll());
    let apagadas = 0;
    for (const foto of todas) {
      if (new Date(foto.criadoEm) < limite) {
        deposito.delete(foto.id);
        apagadas++;
      }
    }
    await aoFim(transacao);
    return apagadas;
  }

  /* ------------------------------------------------------------------ fila --- */

  async itensDaFila(situacao?: SituacaoFila): Promise<ItemFila[]> {
    const transacao = this.banco.transaction([DEPOSITOS.fila], 'readonly');
    const deposito = transacao.objectStore(DEPOSITOS.fila);
    if (!situacao) return promessa(deposito.getAll());
    return promessa(deposito.index('por-situacao').getAll(IDBKeyRange.only(situacao)));
  }

  async atualizarItemFila(item: ItemFila): Promise<void> {
    const transacao = this.banco.transaction([DEPOSITOS.fila], 'readwrite');
    transacao.objectStore(DEPOSITOS.fila).put({ ...item, atualizadoEm: new Date().toISOString() });
    await aoFim(transacao);
  }

  async atualizarItensFila(itens: ItemFila[]): Promise<void> {
    const transacao = this.banco.transaction([DEPOSITOS.fila], 'readwrite');
    const deposito = transacao.objectStore(DEPOSITOS.fila);
    const agora = new Date().toISOString();
    for (const item of itens) deposito.put({ ...item, atualizadoEm: agora });
    await aoFim(transacao);
  }

  async contarFila(): Promise<Record<SituacaoFila, number>> {
    const itens = await this.itensDaFila();
    const contagem: Record<SituacaoFila, number> = {
      pendente: 0, enviando: 0, enviado: 0, falhou: 0,
    };
    for (const item of itens) contagem[item.situacao]++;
    return contagem;
  }

  /* ------------------------------------------------------------ ancoragens --- */

  async salvarAncoragem<T extends { dataLote: string }>(recibo: T): Promise<void> {
    const transacao = this.banco.transaction([DEPOSITOS.ancoragens], 'readwrite');
    transacao.objectStore(DEPOSITOS.ancoragens).put(recibo);
    await aoFim(transacao);
  }

  async lerAncoragem<T>(dataLote: string): Promise<T | undefined> {
    const transacao = this.banco.transaction([DEPOSITOS.ancoragens], 'readonly');
    return promessa(transacao.objectStore(DEPOSITOS.ancoragens).get(dataLote));
  }

  /* --------------------------------------------------------------- chaves --- */

  /**
   * Guarda o par de chaves do aparelho.
   *
   * O IndexedDB guarda `CryptoKey` diretamente, sem serializar. É o que permite
   * a chave privada ser não exportável: ela nunca existe como bytes no
   * JavaScript, nem para gravar. Um `localStorage` obrigaria a exportá-la, e aí
   * qualquer script da página poderia lê-la.
   */
  async salvarChaves<T extends { id: string }>(chaves: T): Promise<void> {
    const transacao = this.banco.transaction([DEPOSITOS.chaves], 'readwrite');
    transacao.objectStore(DEPOSITOS.chaves).put(chaves);
    await aoFim(transacao);
  }

  async lerChaves<T>(id: string): Promise<T | undefined> {
    const transacao = this.banco.transaction([DEPOSITOS.chaves], 'readonly');
    return promessa(transacao.objectStore(DEPOSITOS.chaves).get(id));
  }
}
