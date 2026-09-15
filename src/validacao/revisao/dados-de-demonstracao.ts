/* ---------------------------------------------------------------------------
   Um dia de coleta em Boipeba, para a tela ter o que mostrar.

   O problema que isto resolve: a aba de Conferência le o banco do aparelho. Numa
   maquina de demonstracao, esse banco esta vazio, e o modulo aparece como "nada
   esperando conferencia", que e o pior jeito possivel de mostrar justamente a
   parte que faz o projeto escalar.

   A regra que este arquivo segue, e que e o que separa demonstracao honesta de
   encenacao: AS SINALIZACOES NAO SAO ESCRITAS AQUI. Os registros sao montados
   como coletas de verdade e passam por `analisar()`, o mesmo detector que roda
   no celular do catador. O texto que aparece na tela e o que o codigo produz. Se
   alguem mexer num limiar, esta tela muda junto, e se o detector parar de pegar
   um caso, o exemplo para de mostrar aquele caso.

   Tres cuidados para o exemplo nunca se confundir com dado real:

     · cada registro leva `demonstracao: true` NO ENVELOPE, fora do conteudo
       assinado
     · nao entram na fila de sincronizacao, entao nao existe caminho pelo qual
       subam para a base compartilhada
     · o ponto de coleta e `ponto-demonstracao`, visivel na tela
--------------------------------------------------------------------------- */
import { analisar } from '../antifraude/deteccoes.js';
import { geohashCodificar } from '../antifraude/geohash.js';
import { dataLoteDe } from '../ancoragem/lote-diario.js';
import { montarRegistro } from '../dominio/registro.js';
import { VERSAO_ESQUEMA } from '../dominio/tipos.js';
import type { ClasseMaterial, RegistroEvidencia } from '../dominio/tipos.js';
import type { BancoLocal, RegistroGuardado } from '../armazenamento/bd.js';
import { IdentidadeDispositivo } from '../identidade/chave-dispositivo.js';

export const PONTO_DEMONSTRACAO = 'ponto-demonstracao';

/* Lugares de verdade da ilha. O geohash sai da coordenada, como em campo. */
const CUEIRA = geohashCodificar(-13.6320, -38.9170);
const MORERE = geohashCodificar(-13.6540, -38.9250);

/* Dois coletores, como pseudonimos fixos. Nao passam pela funcao de
   pseudonimizacao de proposito: assim o exemplo nao depende do sal do ambiente e
   fica igual em qualquer maquina.

   Sao SHA-256 de "demonstracao-coletor-a" e "-b", e nao 'd'.repeat(64): na tela,
   uma sequencia de 64 letras iguais parece campo por preencher, e o que precisa
   ficar claro para quem assiste e que ali mora um identificador irreversivel. */
const NILZA = '9f030cbaa33c24d60612b30082d3438fa89abcb6001f00d8078143bf070f7afd';
const JOAO = '5f7e417e126efa590951769bfc18509c33b1f81a778965425af281c6d1923353';

/* pHashes escolhidos para ficarem longe uns dos outros (mais de 8 bits de
   diferenca), menos onde o exemplo QUER que estejam perto. */
const FOTO_A = 'f0e1d2c3b4a59687';
const FOTO_B = '0f1e2d3c4b5a6978';
const FOTO_C = 'aaaa5555aaaa5555';
const FOTO_D = '5555aaaa5555aaaa';
const FOTO_E = 'ffff0000ffff0000';
const FOTO_F = '123456789abcdef0';

interface Roteiro {
  hora: string;
  coletor: string;
  geohash: string;
  material: ClasseMaterial;
  pesoKg: number;
  pHash: string;
  ocupacaoQuadro: number | null;
  confianca: number;
  /** O que este registro existe para mostrar. Nao vai para a tela: e nota de codigo. */
  mostra: string;
}

/**
 * O roteiro do dia.
 *
 * Tres coletas normais primeiro, de proposito: sem elas, a tela daria a impressao
 * de que o sistema desconfia de tudo, quando o que ele faz e separar o que pede
 * conferencia do que segue direto.
 */
const ROTEIRO: Roteiro[] = [
  {
    hora: '09:10', coletor: NILZA, geohash: CUEIRA, material: 'PET', pesoKg: 12.5,
    pHash: FOTO_A, ocupacaoQuadro: 0.42, confianca: 0.94,
    mostra: 'coleta normal, nada sinalizado',
  },
  {
    hora: '09:45', coletor: NILZA, geohash: CUEIRA, material: 'papelao', pesoKg: 18,
    pHash: FOTO_B, ocupacaoQuadro: 0.55, confianca: 0.91,
    mostra: 'coleta normal',
  },
  {
    hora: '10:05', coletor: JOAO, geohash: MORERE, material: 'aluminio', pesoKg: 9,
    pHash: FOTO_C, ocupacaoQuadro: 0.38, confianca: 0.88,
    mostra: 'coleta normal, outro coletor, outro ponto',
  },
  {
    hora: '10:20', coletor: JOAO, geohash: CUEIRA, material: 'papelao', pesoKg: 18.4,
    pHash: FOTO_D, ocupacaoQuadro: 0.52, confianca: 0.9,
    mostra: 'pilha recontada: mesmo material e peso, 35 min e poucos metros da coleta das 09:45',
  },
  {
    hora: '10:22', coletor: JOAO, geohash: CUEIRA, material: 'vidro', pesoKg: 30,
    pHash: FOTO_E, ocupacaoQuadro: 0.6, confianca: 0.86,
    mostra: 'sequencia improvavel: 2 min depois da anterior do mesmo coletor',
  },
  {
    hora: '11:30', coletor: NILZA, geohash: CUEIRA, material: 'PET', pesoKg: 12.5,
    pHash: FOTO_A, ocupacaoQuadro: 0.42, confianca: 0.93,
    mostra: 'foto reaproveitada: pHash identico ao da coleta das 09:10',
  },
  {
    hora: '14:05', coletor: NILZA, geohash: CUEIRA, material: 'vidro', pesoKg: 62,
    pHash: FOTO_F, ocupacaoQuadro: 0.04, confianca: 0.52,
    mostra: 'peso incoerente com a foto, e confianca do modelo abaixo do limiar',
  },
];

/** Monta o conteudo de uma coleta do roteiro, no dia informado. */
function conteudoDe(item: Roteiro, dia: string, indice: number) {
  return {
    /* UUID deterministico, para recarregar o exemplo nao criar copias. O sufixo
       marca a origem e aparece no painel, entao quem olhar sabe o que e. */
    id: `dede0000-0000-4000-8000-${String(indice).padStart(12, '0')}`,
    classificacao: {
      classeSugerida: item.material,
      confianca: item.confianca,
      classeFinal: item.material,
      corrigidoPorHumano: false,
      versaoModelo: 'exemplo-de-demonstracao',
    },
    pesoKg: item.pesoKg,
    ocupacaoQuadro: item.ocupacaoQuadro,
    pHash: item.pHash,
    geohash: item.geohash,
    timestampDispositivo: `${dia}T${item.hora}:00.000-03:00`,
    pontoColetaId: PONTO_DEMONSTRACAO,
    coletorPseudonimo: item.coletor,
  };
}

export interface ResultadoSemeadura {
  gravados: number;
  sinalizados: number;
  /** Codigos de sinalizacao que o detector realmente produziu. */
  codigos: string[];
}

/**
 * Planta o exemplo no banco.
 *
 * `dia` existe para o exemplo cair sempre no dia de hoje: lote de tres semanas
 * atras aparece no painel como historico velho, e nao como "o dia de trabalho
 * que acabou de acontecer".
 */
export async function semearDemonstracao(
  banco: BancoLocal,
  opcoes: { dia?: string; identidade?: IdentidadeDispositivo } = {},
): Promise<ResultadoSemeadura> {
  const dia = opcoes.dia ?? dataLoteDe(new Date().toISOString());
  const identidade = opcoes.identidade ?? await IdentidadeDispositivo.carregar(banco);

  /* Os registros ja plantados entram na comparacao junto com os do roteiro: e
     assim que a coleta das 11:30 "enxerga" a das 09:10 e a sinalizacao de foto
     reaproveitada nasce do detector, e nao de uma linha escrita aqui. */
  const anteriores: RegistroEvidencia[] = [];
  const codigos = new Set<string>();
  let sinalizados = 0;

  for (const [indice, item] of ROTEIRO.entries()) {
    const conteudo = conteudoDe(item, dia, indice);
    const sinalizacoes = analisar({ ...conteudo, versaoEsquema: VERSAO_ESQUEMA }, anteriores);
    const registro = await identidade.assinarRegistro(montarRegistro(conteudo, sinalizacoes));

    const guardado: RegistroGuardado = {
      id: registro.conteudo.id,
      dataLote: dataLoteDe(registro.conteudo.timestampDispositivo),
      timestamp: registro.conteudo.timestampDispositivo,
      registro,
      demonstracao: true,
    };
    // Sem foto e sem fila: a tela de conferencia nao mostra foto, e exemplo que
    // entra na fila e exemplo que um dia sobe para a base de verdade.
    await banco.salvarRegistro(guardado, undefined, { enfileirar: false });

    anteriores.push(registro);
    if (sinalizacoes.length > 0) sinalizados++;
    for (const s of sinalizacoes) codigos.add(s.codigo);
  }

  return { gravados: ROTEIRO.length, sinalizados, codigos: [...codigos].sort() };
}

/** Tira o exemplo do banco, sem tocar em nada que tenha vindo de campo. */
export async function limparDemonstracao(banco: BancoLocal): Promise<number> {
  const todos = await banco.listarRegistros();
  const doExemplo = todos.filter(g => g.demonstracao === true);
  for (const g of doExemplo) await banco.apagarRegistro(g.id);
  return doExemplo.length;
}

/** Ha exemplo plantado? */
export function temDemonstracao(registros: RegistroGuardado[]): boolean {
  return registros.some(g => g.demonstracao === true);
}

/** O que o exemplo contem, para a tela poder dizer em voz alta. */
export const O_QUE_O_EXEMPLO_MOSTRA = ROTEIRO.map(r => r.mostra);
