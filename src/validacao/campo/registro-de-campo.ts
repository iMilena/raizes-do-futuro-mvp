/* ---------------------------------------------------------------------------
   O fluxo de registro, sem interface.

   Toda a sequência que acontece quando o catador aperta "salvar" mora aqui, e
   não dentro de um componente React: a ordem das operações é a parte que precisa
   de teste, e teste de ordem de operações não deveria depender de renderizar
   tela. O componente cuida de foto, dedo e cor; este arquivo cuida da evidência.

   A ordem importa, e é esta:

     1. pHash e ocupação, da foto (antes de qualquer coisa: se a foto não presta,
        o resto não faz sentido)
     2. geohash, da localização (ou registro sem geo, se o GPS negou)
     3. monta o conteúdo e calcula o hash keccak256
     4. roda as detecções contra os registros recentes do aparelho
     5. assina com a chave do aparelho
     6. grava registro, foto e item de fila, numa transação só

   O que NÃO acontece aqui: rede. Nenhum passo depende de conexão, e é por isso
   que o registro termina na praia, com o celular no modo avião, em dois toques.
--------------------------------------------------------------------------- */
import type { BancoLocal, RegistroGuardado } from '../armazenamento/bd.js';
import type { IdentidadeDispositivo } from '../identidade/chave-dispositivo.js';
import { analisar, CONFIG_PADRAO } from '../antifraude/deteccoes.js';
import type { ConfigDeteccao } from '../antifraude/deteccoes.js';
import { geohashCodificar } from '../antifraude/geohash.js';
import { montarRegistro } from '../dominio/registro.js';
import { dataLoteDe } from '../ancoragem/lote-diario.js';
import { VERSAO_ESQUEMA } from '../dominio/tipos.js';
import type { ClasseMaterial, RegistroEvidencia, Sinalizacao } from '../dominio/tipos.js';

/** O que a tela junta enquanto o catador registra. */
export interface RascunhoColeta {
  /** A foto tirada. Fica no aparelho. */
  foto: Blob;
  /** pHash já calculado pela tela (que tem a imagem decodificada em mãos). */
  pHash: string;
  /** Fração do quadro ocupada por material, ou null se não deu para medir. */
  ocupacaoQuadro: number | null;
  /** O que o modelo sugeriu, e com quanta confiança. */
  classeSugerida: ClasseMaterial;
  confianca: number;
  /** O que ficou valendo, depois de o catador confirmar ou corrigir. */
  classeFinal: ClasseMaterial;
  versaoModelo: string;
  /** Peso lido na balança. */
  pesoKg: number;
  pontoColetaId: string;
  /** Pseudônimo do coletor, já calculado (o id nunca chega aqui). */
  coletorPseudonimo: string;
  /** Coordenada do aparelho, quando houver permissão. */
  posicao: { lat: number; lng: number } | null;
}

export interface ResultadoRegistro {
  registro: RegistroEvidencia;
  sinalizacoes: Sinalizacao[];
  /** Quando true, a tela avisa que o registro vai para conferência. */
  vaiParaRevisao: boolean;
}

export interface OpcoesRegistro {
  configDeteccao?: ConfigDeteccao;
  /** Quantos registros recentes entram na comparação antifraude. */
  janelaComparacao?: number;
  /** Relógio injetável, para teste. */
  agora?: () => Date;
  /** Gerador de id injetável, para teste. */
  novoId?: () => string;
}

/**
 * Geohash usado quando o aparelho não entrega posição.
 *
 * Permissão negada ou GPS frio dentro do galpão não bloqueiam o registro: a
 * coleta existe e a pessoa trabalhou. Fica o geohash do território, que é a
 * informação verdadeira disponível.
 *
 * O contrário (recusar registro sem GPS) transformaria limitação de aparelho em
 * perda de renda de família.
 */
export const GEOHASH_PADRAO_DA_ILHA = '7js6dd7'; // Velha Boipeba

export async function registrarColeta(
  rascunho: RascunhoColeta,
  banco: BancoLocal,
  identidade: IdentidadeDispositivo,
  opcoes: OpcoesRegistro = {},
): Promise<ResultadoRegistro> {
  const agora = opcoes.agora ?? (() => new Date());
  const novoId = opcoes.novoId ?? (() => crypto.randomUUID());

  const geohash = rascunho.posicao
    ? geohashCodificar(rascunho.posicao.lat, rascunho.posicao.lng)
    : GEOHASH_PADRAO_DA_ILHA;

  const timestamp = agora().toISOString();
  const conteudo = {
    id: novoId(),
    classificacao: {
      classeSugerida: rascunho.classeSugerida,
      confianca: rascunho.confianca,
      classeFinal: rascunho.classeFinal,
      corrigidoPorHumano: rascunho.classeFinal !== rascunho.classeSugerida,
      versaoModelo: rascunho.versaoModelo,
    },
    pesoKg: rascunho.pesoKg,
    ocupacaoQuadro: rascunho.ocupacaoQuadro,
    pHash: rascunho.pHash,
    geohash,
    timestampDispositivo: timestamp,
    pontoColetaId: rascunho.pontoColetaId,
    coletorPseudonimo: rascunho.coletorPseudonimo,
  };

  const recentes = await banco.registrosRecentes(opcoes.janelaComparacao ?? 200);
  const sinalizacoes = analisar(
    { ...conteudo, versaoEsquema: VERSAO_ESQUEMA },
    recentes.map(r => r.registro),
    opcoes.configDeteccao ?? CONFIG_PADRAO,
  );

  const registro = montarRegistro(conteudo, sinalizacoes);
  const assinado = await identidade.assinarRegistro(registro);

  const guardado: RegistroGuardado = {
    id: assinado.conteudo.id,
    dataLote: dataLoteDe(timestamp),
    timestamp,
    registro: assinado,
  };
  await banco.salvarRegistro(guardado, rascunho.foto);

  return {
    registro: assinado,
    sinalizacoes,
    vaiParaRevisao: sinalizacoes.length > 0,
  };
}

/**
 * Lê a posição do aparelho, desistindo rápido.
 *
 * Cinco segundos e segue sem GPS: ficar parado no sol esperando satélite é o
 * tipo de espera que faz o catador desistir do app e voltar para o caderno.
 */
export function lerPosicao(timeoutMs = 5000): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolver => {
    if (!('geolocation' in navigator)) return resolver(null);
    navigator.geolocation.getCurrentPosition(
      p => resolver({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolver(null),
      { timeout: timeoutMs, maximumAge: 60_000, enableHighAccuracy: false },
    );
  });
}
