/* ---------------------------------------------------------------------------
   As detecções antifraude.

   Regra que vale para o arquivo inteiro, e que não é detalhe de implementação:
   NADA AQUI REJEITA REGISTRO. Toda função devolve sinalização, e sinalização é
   um pedido de olho humano. O sistema aponta, a pessoa decide.

   Isso tem razão técnica e razão social. Técnica: todo limiar abaixo é um chute
   informado que ainda não viu um dia de coleta em Boipeba, e limiar não calibrado
   que rejeita sozinho tira renda de família por erro de estatística. Social: a
   coleta é o trabalho de 30 famílias que se conhecem, e um sistema que acusa
   sozinho quebra a confiança que faz o projeto funcionar. O que precisamos é que
   a auditoria consiga verificar, não que a máquina julgue.

   Por isso cada sinalização carrega `motivo` em português comum, e `detalhes`
   com os números. Quem revisa precisa entender o que o sistema viu, não receber
   um código de erro.
--------------------------------------------------------------------------- */
import type { ClasseMaterial, ConteudoRegistro, RegistroEvidencia, Sinalizacao } from '../dominio/tipos.js';
import { distanciaHamming, LIMIAR_HAMMING_PADRAO } from './phash.js';
import { dentroDoTerritorio, distanciaMetros } from './geohash.js';

export interface ConfigDeteccao {
  /** Abaixo disto, o material não é classificado sozinho: vai para revisão. */
  confiancaMinima: number;
  /** Distância de Hamming até a qual duas fotos são consideradas a mesma cena. */
  limiarHamming: number;
  /** Janela de tempo, em minutos, para procurar pilha recontada. */
  janelaPilhaMin: number;
  /** Distância, em metros, dentro da qual duas coletas podem ser a mesma pilha. */
  raioPilhaMetros: number;
  /** Diferença relativa de peso abaixo da qual dois registros são "o mesmo peso". */
  toleranciaPesoRelativa: number;
  /** Intervalo mínimo plausível entre duas coletas do mesmo coletor, em minutos. */
  intervaloMinimoMin: number;
  /** Ritmo máximo plausível de coleta, em kg por minuto. */
  kgPorMinutoMax: number;
  /** Velocidade máxima plausível de deslocamento entre coletas, em km/h. */
  velocidadeMaximaKmh: number;
  /** Faixa de kg por quadro cheio de foto, por material. */
  faixaKgPorQuadro: Record<ClasseMaterial, [number, number]>;
}

/**
 * Padrões do piloto. Todos são ponto de partida, e TODOS precisam de calibração
 * com as fotos e as pesagens reais de Boipeba.
 *
 * As faixas de kg por quadro saem de densidade aparente de fardo (PET solto é
 * leve e volumoso, vidro é o oposto) cruzada com o enquadramento típico de uma
 * foto de pilha a dois metros. São largas de propósito: a checagem existe para
 * pegar a incoerência grosseira (meia sacola na foto, 40 kg na balança), não para
 * auditar a balança.
 */
export const CONFIG_PADRAO: ConfigDeteccao = {
  confiancaMinima: 0.7,
  limiarHamming: LIMIAR_HAMMING_PADRAO,
  janelaPilhaMin: 45,
  raioPilhaMetros: 200,
  toleranciaPesoRelativa: 0.1,
  intervaloMinimoMin: 3,
  kgPorMinutoMax: 8,
  velocidadeMaximaKmh: 30,
  faixaKgPorQuadro: {
    PET: [0.3, 30],
    aluminio: [0.2, 25],
    vidro: [1.5, 90],
    papelao: [0.5, 45],
    outros: [0.1, 80],
  },
};

const minutosEntre = (a: string, b: string): number =>
  Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60000;

const arredondar = (n: number, casas = 1): number =>
  Number(n.toFixed(casas));

/* ------------------------------------------------------- foto reaproveitada --- */

/**
 * A foto já apareceu em outro registro?
 *
 * Compara contra todos os registros recentes, e não só contra os do mesmo
 * coletor: reaproveitar a foto de outra pessoa é exatamente o caso que a
 * checagem por coletor deixaria passar.
 */
export function detectarFotoReaproveitada(
  candidato: ConteudoRegistro,
  anteriores: RegistroEvidencia[],
  cfg: ConfigDeteccao = CONFIG_PADRAO,
): Sinalizacao | null {
  let maisParecido: { registro: RegistroEvidencia; distancia: number } | null = null;

  for (const anterior of anteriores) {
    if (anterior.conteudo.id === candidato.id) continue;
    const distancia = distanciaHamming(candidato.pHash, anterior.conteudo.pHash);
    if (!maisParecido || distancia < maisParecido.distancia) {
      maisParecido = { registro: anterior, distancia };
    }
  }
  if (!maisParecido || maisParecido.distancia > cfg.limiarHamming) return null;

  const { registro, distancia } = maisParecido;
  const quando = new Date(registro.conteudo.timestampDispositivo).toLocaleString('pt-BR');
  const igual = distancia === 0;

  return {
    codigo: 'foto_reaproveitada',
    gravidade: distancia <= cfg.limiarHamming / 2 ? 'alta' : 'atencao',
    motivo: igual
      ? `A foto é idêntica à de um registro de ${quando}. Pode ser a mesma foto enviada duas vezes.`
      : `A foto é quase igual à de um registro de ${quando} (${distancia} bits de diferença em 64). `
        + 'Pode ser a mesma cena fotografada de novo, ou uma foto de tela.',
    detalhes: {
      distanciaHamming: distancia,
      limiar: cfg.limiarHamming,
      registroParecido: registro.conteudo.id,
      pesoDoOutroKg: registro.conteudo.pesoKg,
    },
    registrosRelacionados: [registro.conteudo.id],
  };
}

/* ----------------------------------------------------------- pilha recontada --- */

/**
 * A mesma pilha foi pesada duas vezes?
 *
 * Diferente da foto reaproveitada: aqui as fotos são DIFERENTES (outro ângulo,
 * outra hora do dia), mas o que descreve a coleta é o mesmo. É a fraude mais
 * difícil de ver a olho nu, e a mais fácil de cometer sem má intenção: dois
 * coletores registrando a mesma entrega do mesmo ponto parceiro.
 */
export function detectarPilhaRecontada(
  candidato: ConteudoRegistro,
  anteriores: RegistroEvidencia[],
  cfg: ConfigDeteccao = CONFIG_PADRAO,
): Sinalizacao | null {
  for (const anterior of anteriores) {
    const outro = anterior.conteudo;
    if (outro.id === candidato.id) continue;
    if (outro.classificacao.classeFinal !== candidato.classificacao.classeFinal) continue;

    const minutos = minutosEntre(candidato.timestampDispositivo, outro.timestampDispositivo);
    if (minutos > cfg.janelaPilhaMin) continue;

    const metros = distanciaMetros(candidato.geohash, outro.geohash);
    if (metros > cfg.raioPilhaMetros) continue;

    const maior = Math.max(candidato.pesoKg, outro.pesoKg);
    const diferenca = Math.abs(candidato.pesoKg - outro.pesoKg) / maior;
    if (diferenca > cfg.toleranciaPesoRelativa) continue;

    const mesmoColetor = outro.coletorPseudonimo === candidato.coletorPseudonimo;
    return {
      codigo: 'pilha_recontada',
      gravidade: mesmoColetor ? 'alta' : 'atencao',
      motivo:
        `Há outro registro de ${outro.pesoKg} kg do mesmo material, feito há ${arredondar(minutos)} `
        + `minutos a cerca de ${Math.round(metros)} metros daqui`
        + (mesmoColetor ? ', pelo mesmo coletor.' : ', por outro coletor.')
        + ' Pode ser a mesma pilha contada duas vezes.',
      detalhes: {
        minutosDeDiferenca: arredondar(minutos),
        metrosDeDistancia: Math.round(metros),
        pesoDoOutroKg: outro.pesoKg,
        diferencaDePeso: `${arredondar(diferenca * 100)}%`,
        mesmoColetor: mesmoColetor ? 'sim' : 'não',
      },
      registrosRelacionados: [outro.id],
    };
  }
  return null;
}

/* ------------------------------------------------------ sequência improvável --- */

/**
 * O que foi registrado cabe no tempo que passou desde a coleta anterior?
 *
 * Três perguntas, uma sinalização: deu tempo de pesar e anotar? o ritmo de kg
 * por minuto é humano? e dava para estar nos dois lugares?
 *
 * Só compara com registros DO MESMO COLETOR: dois coletores trabalhando em
 * pontos diferentes ao mesmo tempo é o funcionamento normal, não anomalia.
 */
export function detectarSequenciaImprovavel(
  candidato: ConteudoRegistro,
  anteriores: RegistroEvidencia[],
  cfg: ConfigDeteccao = CONFIG_PADRAO,
): Sinalizacao | null {
  const doColetor = anteriores
    .filter(r => r.conteudo.coletorPseudonimo === candidato.coletorPseudonimo)
    .filter(r => r.conteudo.id !== candidato.id)
    .filter(r => new Date(r.conteudo.timestampDispositivo) <= new Date(candidato.timestampDispositivo))
    .sort((a, b) =>
      new Date(b.conteudo.timestampDispositivo).getTime()
      - new Date(a.conteudo.timestampDispositivo).getTime());

  const anterior = doColetor[0];
  if (!anterior) return null;

  const minutos = minutosEntre(candidato.timestampDispositivo, anterior.conteudo.timestampDispositivo);
  const metros = distanciaMetros(candidato.geohash, anterior.conteudo.geohash);
  const kgPorMinuto = minutos > 0 ? candidato.pesoKg / minutos : Infinity;
  const kmh = minutos > 0 ? (metros / 1000) / (minutos / 60) : Infinity;

  const detalhes = {
    minutosDesdeAColetaAnterior: arredondar(minutos),
    pesoKg: candidato.pesoKg,
    kgPorMinuto: Number.isFinite(kgPorMinuto) ? arredondar(kgPorMinuto, 2) : 'instantâneo',
    metrosPercorridos: Math.round(metros),
    kmPorHora: Number.isFinite(kmh) ? arredondar(kmh) : 'instantâneo',
    registroAnterior: anterior.conteudo.id,
  };
  const relacionados = [anterior.conteudo.id];

  if (minutos < cfg.intervaloMinimoMin) {
    return {
      codigo: 'sequencia_improvavel',
      gravidade: 'alta',
      motivo:
        `Este registro veio ${arredondar(minutos)} minutos depois do anterior do mesmo coletor. `
        + 'É pouco tempo para juntar, pesar e anotar outra coleta.',
      detalhes, registrosRelacionados: relacionados,
    };
  }
  if (kgPorMinuto > cfg.kgPorMinutoMax) {
    return {
      codigo: 'sequencia_improvavel',
      gravidade: 'atencao',
      motivo:
        `São ${candidato.pesoKg} kg em ${arredondar(minutos)} minutos desde a coleta anterior `
        + `(${arredondar(kgPorMinuto, 2)} kg por minuto). O ritmo está acima do que costuma ser possível.`,
      detalhes, registrosRelacionados: relacionados,
    };
  }
  if (kmh > cfg.velocidadeMaximaKmh) {
    return {
      codigo: 'sequencia_improvavel',
      gravidade: 'atencao',
      motivo:
        `A coleta anterior foi a ${Math.round(metros)} metros daqui, há ${arredondar(minutos)} minutos `
        + `(${arredondar(kmh)} km/h). É rápido demais para o trajeto na ilha.`,
      detalhes, registrosRelacionados: relacionados,
    };
  }
  return null;
}

/* ------------------------------------------------ coerência de peso e volume --- */

/**
 * O peso da balança conversa com o que aparece na foto?
 *
 * Isto NÃO estima peso por foto, e a distinção é o ponto: não existe número de
 * peso saindo daqui, existe uma pergunta sobre coerência. A balança continua
 * sendo a fonte, e quando a resposta é "não bate", quem decide é uma pessoa.
 */
export function detectarPesoIncoerente(
  candidato: ConteudoRegistro,
  cfg: ConfigDeteccao = CONFIG_PADRAO,
): Sinalizacao | null {
  const ocupacao = candidato.ocupacaoQuadro;
  if (ocupacao === null || ocupacao < 0.02) return null; // foto sem material visível não diz nada

  const faixa = cfg.faixaKgPorQuadro[candidato.classificacao.classeFinal];
  const kgPorQuadro = candidato.pesoKg / ocupacao;
  if (kgPorQuadro >= faixa[0] && kgPorQuadro <= faixa[1]) return null;

  const pesado = kgPorQuadro > faixa[1];
  return {
    codigo: 'peso_incoerente',
    gravidade: 'atencao',
    motivo: pesado
      ? `A foto mostra pouco material para ${candidato.pesoKg} kg de ${candidato.classificacao.classeFinal}. `
        + 'Vale conferir a balança e o enquadramento da foto.'
      : `A foto mostra bastante material para apenas ${candidato.pesoKg} kg de `
        + `${candidato.classificacao.classeFinal}. Vale conferir a balança e o enquadramento da foto.`,
    detalhes: {
      ocupacaoDaFoto: `${Math.round(ocupacao * 100)}%`,
      kgPorQuadroCheio: arredondar(kgPorQuadro),
      faixaEsperada: `${faixa[0]} a ${faixa[1]} kg`,
    },
  };
}

/* ------------------------------------------------------------ outras checagens --- */

export function detectarConfiancaBaixa(
  candidato: ConteudoRegistro,
  cfg: ConfigDeteccao = CONFIG_PADRAO,
): Sinalizacao | null {
  const { confianca, corrigidoPorHumano, classeSugerida } = candidato.classificacao;
  // Correção humana resolve a dúvida do modelo: quem estava lá olhou e disse o que era.
  if (corrigidoPorHumano || confianca >= cfg.confiancaMinima) return null;

  return {
    codigo: 'confianca_baixa',
    gravidade: 'atencao',
    motivo:
      `O aplicativo não teve certeza do material (${Math.round(confianca * 100)}% de confiança em `
      + `${classeSugerida}). O tipo precisa ser conferido por uma pessoa.`,
    detalhes: {
      confianca: arredondar(confianca, 2),
      minimoExigido: cfg.confiancaMinima,
      classeSugerida,
    },
  };
}

export function detectarForaDoTerritorio(candidato: ConteudoRegistro): Sinalizacao | null {
  if (dentroDoTerritorio(candidato.geohash)) return null;
  return {
    codigo: 'fora_do_territorio',
    gravidade: 'atencao',
    motivo:
      'A localização registrada fica fora da área de operação do projeto. '
      + 'Costuma ser GPS impreciso dentro de construção, mas precisa de conferência.',
    detalhes: { geohash: candidato.geohash },
  };
}

/* --------------------------------------------------------------- orquestração --- */

/**
 * Roda todas as checagens sobre um registro candidato.
 *
 * `anteriores` são os registros recentes que o aparelho tem em mãos. Offline,
 * isso é o que já foi coletado localmente, e está certo que seja: a checagem
 * completa contra a base inteira roda de novo no servidor quando a fila sobe.
 * Melhor sinalizar pouco em campo do que travar o registro esperando rede.
 */
export function analisar(
  candidato: ConteudoRegistro,
  anteriores: RegistroEvidencia[],
  cfg: ConfigDeteccao = CONFIG_PADRAO,
): Sinalizacao[] {
  return [
    detectarConfiancaBaixa(candidato, cfg),
    detectarFotoReaproveitada(candidato, anteriores, cfg),
    detectarPilhaRecontada(candidato, anteriores, cfg),
    detectarSequenciaImprovavel(candidato, anteriores, cfg),
    detectarPesoIncoerente(candidato, cfg),
    detectarForaDoTerritorio(candidato),
  ].filter((s): s is Sinalizacao => s !== null);
}
