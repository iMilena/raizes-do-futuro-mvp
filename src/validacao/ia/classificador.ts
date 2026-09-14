/* ---------------------------------------------------------------------------
   O classificador, rodando dentro do navegador do catador.

   Nenhuma chamada de rede acontece aqui, e é essa a razão de o módulo existir
   deste jeito: em Boipeba a conectividade é intermitente, e um classificador que
   depende de API na hora da coleta simplesmente não funciona no dia a dia.
   O modelo baixa uma vez com o app, fica no cache do service worker e roda no
   aparelho.

   Duas coisas que este arquivo trata como obrigação, não como cuidado extra:

   1. FALHA DO MODELO NÃO PODE BLOQUEAR O REGISTRO. Se o ONNX não carregar
      (aparelho antigo sem WebAssembly, arquivo ainda não exportado, cache
      corrompido), `estado` vira 'indisponivel' e o app segue com escolha manual
      do material. A coleta é o trabalho de alguém, e não pode depender de o
      nosso modelo estar de pé.

   2. A CONFIANÇA VEM DO MODELO, JÁ CALIBRADA. A temperatura foi embutida no
      grafo em `exportar.py`. Aqui não se aplica softmax de novo, não se ajusta
      nada: o que sai do ONNX é o que a interface mostra e o que o limiar usa.
--------------------------------------------------------------------------- */
/* `onnxruntime-web/wasm`, e não o pacote inteiro: o build padrão traz junto o
   backend WebGPU, e o .wasm dele tem 28 MB contra 14 MB do de WebAssembly puro.
   Celular de entrada em Boipeba não tem WebGPU utilizável, então seriam 14 MB de
   download em 3G para nada. */
import * as ort from 'onnxruntime-web/wasm';
import { dimensoes, imagemParaTensor } from './preprocesso.js';
import type { ParametrosPreprocesso } from './preprocesso.js';
import { CLASSES_MATERIAL } from '../dominio/tipos.js';
import type { ClasseMaterial } from '../dominio/tipos.js';

export interface ManifestoModelo {
  versao: string;
  arquivo: string;
  classes: ClasseMaterial[];
  rotulos: string[];
  tamanho_entrada: number;
  normalizacao: { media: [number, number, number]; desvio: [number, number, number] };
  temperatura_embutida: number;
  limiar_confianca: number;
}

export interface Classificacao {
  classe: ClasseMaterial;
  confianca: number;
  /** Probabilidade de cada classe, para a tela poder mostrar a segunda opção. */
  todas: Array<{ classe: ClasseMaterial; rotulo: string; confianca: number }>;
  /** Quanto demorou, em milissegundos. Medido sempre, porque o alvo é abaixo de 1000. */
  duracaoMs: number;
  versaoModelo: string;
  /** O modelo teve certeza suficiente para valer sozinho? */
  confiavel: boolean;
}

export type EstadoClassificador = 'nao-iniciado' | 'carregando' | 'pronto' | 'indisponivel';

export interface OpcoesClassificador {
  /** Pasta onde estão classificador.onnx e classificador.json. */
  base?: string;
  /** Limiar de confiança. Por padrão, o que veio no manifesto. */
  limiar?: number;
}

export class Classificador {
  private sessao: ort.InferenceSession | null = null;
  private manifesto: ManifestoModelo | null = null;
  private carregamento: Promise<void> | null = null;
  private _estado: EstadoClassificador = 'nao-iniciado';
  private _motivoIndisponivel: string | null = null;

  constructor(private readonly opcoes: OpcoesClassificador = {}) {}

  get estado(): EstadoClassificador {
    return this._estado;
  }

  get motivoIndisponivel(): string | null {
    return this._motivoIndisponivel;
  }

  get limiar(): number {
    return this.opcoes.limiar ?? this.manifesto?.limiar_confianca ?? 0.7;
  }

  get versao(): string {
    return this.manifesto?.versao ?? 'indisponivel';
  }

  private get base(): string {
    return this.opcoes.base ?? './modelo';
  }

  /**
   * Carrega manifesto e modelo. Chamar várias vezes é seguro e barato.
   *
   * A promessa fica guardada porque a tela de câmera e o botão de registrar
   * podem disparar o carregamento ao mesmo tempo, e duas sessões ONNX no mesmo
   * aparelho é o caminho mais rápido para estourar a memória de um celular de entrada.
   */
  async iniciar(): Promise<void> {
    if (this.carregamento) return this.carregamento;
    this.carregamento = this.carregar();
    return this.carregamento;
  }

  private async carregar(): Promise<void> {
    this._estado = 'carregando';
    try {
      const respostaManifesto = await fetch(`${this.base}/classificador.json`);
      if (!respostaManifesto.ok) throw new Error(`manifesto não encontrado (${respostaManifesto.status})`);
      const manifesto = (await respostaManifesto.json()) as ManifestoModelo;
      conferirManifesto(manifesto);
      this.manifesto = manifesto;

      /* Um thread só: celular de entrada raramente ganha com mais, e multithread
         em WebAssembly exige cabeçalhos de isolamento cruzado (COOP/COEP) que o
         app teria de servir, o que complica a hospedagem sem ganho garantido. */
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.simd = true;

      this.sessao = await ort.InferenceSession.create(`${this.base}/${manifesto.arquivo}`, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });

      await this.aquecer();
      this._estado = 'pronto';
    } catch (erro) {
      this._estado = 'indisponivel';
      this._motivoIndisponivel = erro instanceof Error ? erro.message : String(erro);
      this.sessao = null;
      // Não relança: o app tem de continuar funcionando com escolha manual.
      console.warn('[validação] classificador indisponível:', this._motivoIndisponivel);
    }
  }

  /**
   * Primeira inferência, com imagem preta.
   *
   * Sem isso, a primeira foto do dia paga o custo de alocar tudo, e é justamente
   * a primeira que o catador cronometra mentalmente para decidir se o app presta.
   */
  private async aquecer(): Promise<void> {
    if (!this.sessao || !this.manifesto) return;
    const lado = this.manifesto.tamanho_entrada;
    const vazio = new Float32Array(3 * lado * lado);
    const tensor = new ort.Tensor('float32', vazio, [1, 3, lado, lado]);
    await this.sessao.run({ [this.sessao.inputNames[0]!]: tensor });
  }

  private get parametros(): ParametrosPreprocesso {
    const m = this.manifesto!;
    return {
      tamanhoEntrada: m.tamanho_entrada,
      media: m.normalizacao.media,
      desvio: m.normalizacao.desvio,
    };
  }

  /** Classifica uma foto. Devolve null quando o modelo não está disponível. */
  async classificar(fonte: CanvasImageSource): Promise<Classificacao | null> {
    await this.iniciar();
    if (!this.sessao || !this.manifesto) return null;

    const inicio = performance.now();
    const { largura, altura } = dimensoes(fonte);
    const dados = imagemParaTensor(fonte, largura, altura, this.parametros);
    const lado = this.manifesto.tamanho_entrada;

    const saida = await this.sessao.run({
      [this.sessao.inputNames[0]!]: new ort.Tensor('float32', dados, [1, 3, lado, lado]),
    });
    const probabilidades = saida[this.sessao.outputNames[0]!]!.data as Float32Array;

    const todas = this.manifesto.classes.map((classe, i) => ({
      classe,
      rotulo: this.manifesto!.rotulos[i] ?? classe,
      confianca: probabilidades[i] ?? 0,
    }));
    todas.sort((a, b) => b.confianca - a.confianca);
    const melhor = todas[0]!;

    return {
      classe: melhor.classe,
      confianca: melhor.confianca,
      todas,
      duracaoMs: Math.round(performance.now() - inicio),
      versaoModelo: this.manifesto.versao,
      confiavel: melhor.confianca >= this.limiar,
    };
  }

  /** Libera a sessão. Usado ao sair da tela de registro em aparelho apertado de memória. */
  async encerrar(): Promise<void> {
    await this.sessao?.release();
    this.sessao = null;
    this.carregamento = null;
    this._estado = 'nao-iniciado';
  }
}

/**
 * Confere o manifesto contra as classes que o app conhece.
 *
 * Existe por causa de um erro específico e silencioso: reexportar o modelo com
 * as classes em outra ordem. O ONNX continua respondendo, o app continua
 * mostrando nomes, e todo vidro vira PET. Melhor não carregar do que classificar
 * errado com cara de certo.
 */
export function conferirManifesto(manifesto: ManifestoModelo): void {
  const esperadas = CLASSES_MATERIAL.join(',');
  const recebidas = (manifesto.classes ?? []).join(',');
  if (esperadas !== recebidas) {
    throw new Error(
      `as classes do modelo (${recebidas}) não batem com as do app (${esperadas}). `
      + 'Reexporte o modelo ou atualize o app: classificar com a ordem errada é pior que não classificar.',
    );
  }
  if (!manifesto.tamanho_entrada || !manifesto.normalizacao?.media?.length) {
    throw new Error('manifesto do modelo incompleto: falta tamanho de entrada ou normalização');
  }
}

/** Instância única do app. Uma sessão ONNX por aparelho basta e é o que cabe na memória. */
let instancia: Classificador | null = null;

export function classificadorPadrao(opcoes?: OpcoesClassificador): Classificador {
  if (!instancia) instancia = new Classificador(opcoes);
  return instancia;
}
