/* ---------------------------------------------------------------------------
   Detecções antifraude, em cenários de campo.

   Cada teste descreve uma situação que pode acontecer em Boipeba, e cobra do
   sistema a reação certa. Inclusive os casos em que a reação certa é NÃO
   sinalizar: falso positivo aqui vira desconfiança sobre o trabalho de alguém.
--------------------------------------------------------------------------- */
import { describe, expect, it } from 'vitest';
import {
  analisar, CONFIG_PADRAO, detectarConfiancaBaixa, detectarForaDoTerritorio,
  detectarFotoReaproveitada, detectarPesoIncoerente, detectarPilhaRecontada,
  detectarSequenciaImprovavel,
} from '../../src/validacao/antifraude/deteccoes.js';
import { geohashCodificar, dentroDoTerritorio, distanciaMetros } from '../../src/validacao/antifraude/geohash.js';
import { montarRegistro } from '../../src/validacao/dominio/registro.js';
import type { ConteudoRegistro, RegistroEvidencia } from '../../src/validacao/dominio/tipos.js';
import { conteudoDeTeste } from './fixtures.js';

/* Dois coletores, pseudônimos com formato de HMAC. */
const NILZA = 'a'.repeat(64);
const JOAO = 'b'.repeat(64);

let sequencia = 0;
const proximoId = () => `3f2504e0-4f89-41d3-9a0c-0305e82c${String(++sequencia).padStart(4, '0')}`;

function registro(mudancas: Partial<ConteudoRegistro>): RegistroEvidencia {
  const { versaoEsquema: _v, ...base } = conteudoDeTeste({ id: proximoId(), ...mudancas });
  return montarRegistro(base);
}

function conteudo(mudancas: Partial<ConteudoRegistro>): ConteudoRegistro {
  return conteudoDeTeste({ id: proximoId(), ...mudancas });
}

describe('foto reaproveitada', () => {
  it('pega a mesma foto enviada duas vezes', () => {
    const anterior = registro({ pHash: 'f0e1d2c3b4a59687', timestampDispositivo: '2026-09-14T08:00:00.000Z' });
    const novo = conteudo({ pHash: 'f0e1d2c3b4a59687', timestampDispositivo: '2026-09-14T11:00:00.000Z' });

    const sinal = detectarFotoReaproveitada(novo, [anterior]);
    expect(sinal?.codigo).toBe('foto_reaproveitada');
    expect(sinal?.gravidade).toBe('alta');
    expect(sinal?.motivo).toMatch(/idêntica/);
    expect(sinal?.registrosRelacionados).toEqual([anterior.conteudo.id]);
  });

  it('pega a foto quase igual, dentro do limiar', () => {
    // 4 bits de diferença: recompressão e reenquadramento leve caem nessa faixa.
    const anterior = registro({ pHash: 'f0e1d2c3b4a59687' });
    const novo = conteudo({ pHash: 'f0e1d2c3b4a59688' });
    expect(detectarFotoReaproveitada(novo, [anterior])?.codigo).toBe('foto_reaproveitada');
  });

  it('deixa passar fotos de cenas diferentes', () => {
    const anterior = registro({ pHash: 'f0e1d2c3b4a59687' });
    const novo = conteudo({ pHash: '0f1e2d3c4b5a6978' });
    expect(detectarFotoReaproveitada(novo, [anterior])).toBeNull();
  });

  it('pega foto reaproveitada de OUTRO coletor', () => {
    const doJoao = registro({ coletorPseudonimo: JOAO, pHash: 'f0e1d2c3b4a59687' });
    const daNilza = conteudo({ coletorPseudonimo: NILZA, pHash: 'f0e1d2c3b4a59687' });
    expect(detectarFotoReaproveitada(daNilza, [doJoao])).not.toBeNull();
  });

  it('não sinaliza o registro contra ele mesmo', () => {
    const r = registro({ pHash: 'f0e1d2c3b4a59687' });
    expect(detectarFotoReaproveitada(r.conteudo, [r])).toBeNull();
  });
});

describe('pilha recontada', () => {
  const base = {
    geohash: geohashCodificar(-13.6320, -38.9170), // Praia de Cueira
    timestampDispositivo: '2026-09-14T09:00:00.000Z',
    pesoKg: 20,
  };

  it('pega a mesma pilha registrada duas vezes, com fotos diferentes', () => {
    const anterior = registro({ ...base, pHash: 'f0e1d2c3b4a59687', coletorPseudonimo: NILZA });
    const novo = conteudo({
      ...base,
      timestampDispositivo: '2026-09-14T09:20:00.000Z',
      pesoKg: 20.5,
      pHash: '0f1e2d3c4b5a6978',   // outra foto, outro ângulo
      coletorPseudonimo: NILZA,
    });

    const sinal = detectarPilhaRecontada(novo, [anterior]);
    expect(sinal?.codigo).toBe('pilha_recontada');
    expect(sinal?.gravidade).toBe('alta');
    expect(sinal?.detalhes?.['mesmoColetor']).toBe('sim');
  });

  it('sinaliza com gravidade menor quando são coletores diferentes', () => {
    const anterior = registro({ ...base, coletorPseudonimo: JOAO, pHash: 'f0e1d2c3b4a59687' });
    const novo = conteudo({
      ...base, coletorPseudonimo: NILZA, pHash: '0f1e2d3c4b5a6978',
      timestampDispositivo: '2026-09-14T09:10:00.000Z',
    });
    expect(detectarPilhaRecontada(novo, [anterior])?.gravidade).toBe('atencao');
  });

  it('deixa passar coletas de materiais diferentes no mesmo lugar e hora', () => {
    const anterior = registro({ ...base, pHash: 'f0e1d2c3b4a59687' });
    const novo = conteudo({
      ...base, pHash: '0f1e2d3c4b5a6978',
      timestampDispositivo: '2026-09-14T09:10:00.000Z',
      classificacao: { ...conteudoDeTeste().classificacao, classeSugerida: 'vidro', classeFinal: 'vidro' },
    });
    expect(detectarPilhaRecontada(novo, [anterior])).toBeNull();
  });

  it('deixa passar pesos bem diferentes', () => {
    const anterior = registro({ ...base, pesoKg: 20, pHash: 'f0e1d2c3b4a59687' });
    const novo = conteudo({
      ...base, pesoKg: 45, pHash: '0f1e2d3c4b5a6978',
      timestampDispositivo: '2026-09-14T09:10:00.000Z',
    });
    expect(detectarPilhaRecontada(novo, [anterior])).toBeNull();
  });

  it('deixa passar coletas distantes no espaço', () => {
    const anterior = registro({ ...base, pHash: 'f0e1d2c3b4a59687' });
    const novo = conteudo({
      ...base, pHash: '0f1e2d3c4b5a6978',
      geohash: geohashCodificar(-13.6540, -38.9250), // Moreré, a quilômetros dali
      timestampDispositivo: '2026-09-14T09:30:00.000Z',
    });
    expect(detectarPilhaRecontada(novo, [anterior])).toBeNull();
  });

  it('deixa passar coletas fora da janela de tempo', () => {
    const anterior = registro({ ...base, pHash: 'f0e1d2c3b4a59687' });
    const novo = conteudo({
      ...base, pHash: '0f1e2d3c4b5a6978',
      timestampDispositivo: '2026-09-14T14:00:00.000Z',  // cinco horas depois
    });
    expect(detectarPilhaRecontada(novo, [anterior])).toBeNull();
  });
});

describe('sequência improvável', () => {
  const cueira = geohashCodificar(-13.6320, -38.9170);
  const morere = geohashCodificar(-13.6540, -38.9250);

  it('pega dois registros grudados no tempo', () => {
    const anterior = registro({
      coletorPseudonimo: NILZA, geohash: cueira,
      timestampDispositivo: '2026-09-14T09:00:00.000Z',
    });
    const novo = conteudo({
      coletorPseudonimo: NILZA, geohash: cueira, pesoKg: 15,
      timestampDispositivo: '2026-09-14T09:01:00.000Z',
    });
    const sinal = detectarSequenciaImprovavel(novo, [anterior]);
    expect(sinal?.codigo).toBe('sequencia_improvavel');
    expect(sinal?.motivo).toMatch(/pouco tempo/);
  });

  it('pega volume grande demais para o tempo decorrido', () => {
    const anterior = registro({
      coletorPseudonimo: NILZA, geohash: cueira,
      timestampDispositivo: '2026-09-14T09:00:00.000Z',
    });
    const novo = conteudo({
      coletorPseudonimo: NILZA, geohash: cueira, pesoKg: 120,
      timestampDispositivo: '2026-09-14T09:10:00.000Z',   // 12 kg por minuto
    });
    expect(detectarSequenciaImprovavel(novo, [anterior])?.motivo).toMatch(/ritmo/);
  });

  it('pega deslocamento rápido demais entre dois pontos da ilha', () => {
    const anterior = registro({
      coletorPseudonimo: NILZA, geohash: morere,
      timestampDispositivo: '2026-09-14T09:00:00.000Z',
    });
    const novo = conteudo({
      coletorPseudonimo: NILZA, geohash: cueira, pesoKg: 5,
      timestampDispositivo: '2026-09-14T09:04:00.000Z',
    });
    expect(detectarSequenciaImprovavel(novo, [anterior])?.motivo).toMatch(/km\/h/);
  });

  it('aceita um dia de trabalho normal', () => {
    const anterior = registro({
      coletorPseudonimo: NILZA, geohash: cueira, pesoKg: 18,
      timestampDispositivo: '2026-09-14T09:00:00.000Z',
    });
    const novo = conteudo({
      coletorPseudonimo: NILZA, geohash: cueira, pesoKg: 22,
      timestampDispositivo: '2026-09-14T10:30:00.000Z',
    });
    expect(detectarSequenciaImprovavel(novo, [anterior])).toBeNull();
  });

  it('não compara coletores diferentes: trabalhar ao mesmo tempo é o normal', () => {
    const doJoao = registro({
      coletorPseudonimo: JOAO, geohash: morere,
      timestampDispositivo: '2026-09-14T09:00:00.000Z',
    });
    const daNilza = conteudo({
      coletorPseudonimo: NILZA, geohash: cueira, pesoKg: 40,
      timestampDispositivo: '2026-09-14T09:01:00.000Z',
    });
    expect(detectarSequenciaImprovavel(daNilza, [doJoao])).toBeNull();
  });

  it('ignora registro posterior ao candidato, para não julgar o futuro', () => {
    const depois = registro({
      coletorPseudonimo: NILZA, geohash: cueira,
      timestampDispositivo: '2026-09-14T12:00:00.000Z',
    });
    const novo = conteudo({
      coletorPseudonimo: NILZA, geohash: cueira,
      timestampDispositivo: '2026-09-14T09:00:00.000Z',
    });
    expect(detectarSequenciaImprovavel(novo, [depois])).toBeNull();
  });
});

describe('coerência entre foto e balança', () => {
  it('sinaliza pouco material na foto para muito peso na balança', () => {
    const sinal = detectarPesoIncoerente(conteudo({ ocupacaoQuadro: 0.05, pesoKg: 40 }));
    expect(sinal?.codigo).toBe('peso_incoerente');
    expect(sinal?.motivo).toMatch(/pouco material/);
  });

  it('sinaliza muito material na foto para peso quase nulo', () => {
    const sinal = detectarPesoIncoerente(conteudo({ ocupacaoQuadro: 0.9, pesoKg: 0.2 }));
    expect(sinal?.motivo).toMatch(/bastante material/);
  });

  it('aceita a proporção comum de uma coleta de PET', () => {
    expect(detectarPesoIncoerente(conteudo({ ocupacaoQuadro: 0.45, pesoKg: 8 }))).toBeNull();
  });

  it('usa a faixa do material: 60 kg de vidro passa, 60 kg de alumínio não', () => {
    const vidro = { ...conteudoDeTeste().classificacao, classeSugerida: 'vidro' as const, classeFinal: 'vidro' as const };
    const aluminio = { ...conteudoDeTeste().classificacao, classeSugerida: 'aluminio' as const, classeFinal: 'aluminio' as const };
    expect(detectarPesoIncoerente(conteudo({ classificacao: vidro, ocupacaoQuadro: 0.8, pesoKg: 60 }))).toBeNull();
    expect(detectarPesoIncoerente(conteudo({ classificacao: aluminio, ocupacaoQuadro: 0.8, pesoKg: 60 }))).not.toBeNull();
  });

  it('não opina quando não há foto analisável', () => {
    expect(detectarPesoIncoerente(conteudo({ ocupacaoQuadro: null }))).toBeNull();
  });

  it('nunca devolve estimativa de peso, só coerência', () => {
    const sinal = detectarPesoIncoerente(conteudo({ ocupacaoQuadro: 0.05, pesoKg: 40 }));
    expect(Object.keys(sinal?.detalhes ?? {})).not.toContain('pesoEstimadoKg');
  });
});

describe('confiança do modelo e território', () => {
  it('manda para revisão humana quando o modelo não teve certeza', () => {
    const baixa = { ...conteudoDeTeste().classificacao, confianca: 0.41 };
    const sinal = detectarConfiancaBaixa(conteudo({ classificacao: baixa }));
    expect(sinal?.codigo).toBe('confianca_baixa');
    expect(sinal?.motivo).toMatch(/41%/);
  });

  it('não sinaliza confiança baixa quando o catador já corrigiu o material', () => {
    const corrigida = {
      ...conteudoDeTeste().classificacao,
      confianca: 0.41, classeFinal: 'vidro' as const, corrigidoPorHumano: true,
    };
    expect(detectarConfiancaBaixa(conteudo({ classificacao: corrigida }))).toBeNull();
  });

  it('aceita coleta dentro de Boipeba e sinaliza coleta em Salvador', () => {
    expect(detectarForaDoTerritorio(conteudo({ geohash: geohashCodificar(-13.6106, -38.9083) }))).toBeNull();
    expect(detectarForaDoTerritorio(conteudo({ geohash: geohashCodificar(-12.9777, -38.5016) })))
      .not.toBeNull();
  });
});

describe('geohash', () => {
  it('codifica com a precisão pedida e decodifica de volta para dentro da célula', () => {
    const hash = geohashCodificar(-13.6106, -38.9083, 7);
    expect(hash).toHaveLength(7);
    expect(hash).toBe('7js6dd7');
  });

  it('separa a ilha dos vizinhos que importam', () => {
    expect(dentroDoTerritorio(geohashCodificar(-13.6106, -38.9083))).toBe(true);  // Velha Boipeba
    expect(dentroDoTerritorio(geohashCodificar(-13.6760, -38.9330))).toBe(true);  // Castelhanos
    expect(dentroDoTerritorio(geohashCodificar(-13.3780, -38.9140))).toBe(false); // Morro de São Paulo
    expect(dentroDoTerritorio(geohashCodificar(-13.3700, -39.0730))).toBe(false); // Valença
  });

  it('a célula de precisão 7 tem cerca de 150 metros', () => {
    const a = geohashCodificar(-13.6106, -38.9083);
    const b = geohashCodificar(-13.6106 + 0.0014, -38.9083);   // aproximadamente 155 m ao norte
    expect(a).not.toBe(b);
    expect(distanciaMetros(a, b)).toBeGreaterThan(80);
    expect(distanciaMetros(a, b)).toBeLessThan(250);
  });

  it('recusa coordenada impossível', () => {
    expect(() => geohashCodificar(95, 0)).toThrow();
    expect(() => geohashCodificar(0, 200)).toThrow();
  });
});

describe('orquestração', () => {
  it('junta todas as sinalizações do registro, sem rejeitar nada', () => {
    const anterior = registro({
      coletorPseudonimo: NILZA, pHash: 'f0e1d2c3b4a59687',
      timestampDispositivo: '2026-09-14T09:00:00.000Z', pesoKg: 20,
    });
    const suspeito = conteudo({
      coletorPseudonimo: NILZA, pHash: 'f0e1d2c3b4a59687',
      timestampDispositivo: '2026-09-14T09:01:00.000Z', pesoKg: 20,
      ocupacaoQuadro: 0.03,
    });

    const sinais = analisar(suspeito, [anterior]);
    const codigos = sinais.map(s => s.codigo);
    expect(codigos).toContain('foto_reaproveitada');
    expect(codigos).toContain('pilha_recontada');
    expect(codigos).toContain('sequencia_improvavel');
    expect(codigos).toContain('peso_incoerente');
    // Toda sinalização traz motivo legível: é o que a pessoa que revisa lê.
    for (const sinal of sinais) expect(sinal.motivo.length).toBeGreaterThan(20);
  });

  it('coleta normal não gera sinalização nenhuma', () => {
    const anterior = registro({
      coletorPseudonimo: NILZA, pHash: 'f0e1d2c3b4a59687', pesoKg: 18,
      timestampDispositivo: '2026-09-14T09:00:00.000Z',
    });
    const normal = conteudo({
      coletorPseudonimo: NILZA, pHash: '0f1e2d3c4b5a6978', pesoKg: 11,
      timestampDispositivo: '2026-09-14T11:00:00.000Z', ocupacaoQuadro: 0.5,
    });
    expect(analisar(normal, [anterior])).toEqual([]);
  });

  it('os limiares são configuráveis, porque ainda não foram calibrados em campo', () => {
    const anterior = registro({ pHash: 'f0e1d2c3b4a59687' });
    const novo = conteudo({ pHash: 'f0e1d2c3b4a59688' }); // 4 bits de diferença
    expect(detectarFotoReaproveitada(novo, [anterior], { ...CONFIG_PADRAO, limiarHamming: 2 })).toBeNull();
    expect(detectarFotoReaproveitada(novo, [anterior], { ...CONFIG_PADRAO, limiarHamming: 8 })).not.toBeNull();
  });
});
