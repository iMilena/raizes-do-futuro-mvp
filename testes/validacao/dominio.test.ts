/* ---------------------------------------------------------------------------
   Domínio: serialização canônica, keccak256, esquema e fronteira do dado pessoal.
--------------------------------------------------------------------------- */
import { describe, expect, it } from 'vitest';
import { jsonCanonico, ErroCanonico } from '../../src/validacao/dominio/json-canonico.js';
import { keccak256, keccak256Canonico, hexParaBytes, bytesParaHex } from '../../src/validacao/dominio/keccak.js';
import {
  CAMPOS_CONTEUDO, CAMPOS_PERMITIDOS_ONCHAIN, exigirPayloadSemDadoPessoal,
  validarConteudo, validarRegistro, varrerDadoPessoal,
} from '../../src/validacao/dominio/esquema-evidencia.js';
import {
  comSinalizacoes, hashConfere, montarRegistro, precisaRevisao, ErroRegistroInvalido,
} from '../../src/validacao/dominio/registro.js';
import esquemaJson from '../../src/validacao/dominio/esquema-evidencia.json' with { type: 'json' };
import { conteudoDeTeste } from './fixtures.js';

describe('json canônico', () => {
  it('produz os mesmos bytes independentemente da ordem em que o objeto foi montado', () => {
    const a = { zebra: 1, alfa: { y: [1, 2], x: 'oi' } };
    const b = { alfa: { x: 'oi', y: [1, 2] }, zebra: 1 };
    expect(jsonCanonico(a)).toBe(jsonCanonico(b));
    expect(jsonCanonico(a)).toBe('{"alfa":{"x":"oi","y":[1,2]},"zebra":1}');
  });

  it('não engole undefined em silêncio', () => {
    expect(() => jsonCanonico({ a: undefined })).toThrow(ErroCanonico);
  });

  it('recusa número não finito', () => {
    expect(() => jsonCanonico({ a: NaN })).toThrow(ErroCanonico);
    expect(() => jsonCanonico({ a: Infinity })).toThrow(ErroCanonico);
  });

  it('trata -0 e 0 como o mesmo número', () => {
    expect(jsonCanonico({ a: -0 })).toBe(jsonCanonico({ a: 0 }));
  });
});

describe('keccak256', () => {
  /* Vetores conhecidos do Keccak-256 original (o mesmo que a EVM usa).
     Se estes dois mudarem, o hash do projeto inteiro mudou. */
  it('bate com os vetores conhecidos', () => {
    expect(keccak256(new Uint8Array(0)))
      .toBe('0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
    expect(keccak256(new TextEncoder().encode('abc')))
      .toBe('0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
  });

  it('hexadecimal e bytes são conversíveis de ida e volta', () => {
    const hex = keccak256(new TextEncoder().encode('Boipeba'));
    expect(bytesParaHex(hexParaBytes(hex))).toBe(hex);
    expect(hexParaBytes(hex)).toHaveLength(32);
  });

  it('recusa hexadecimal malformado', () => {
    expect(() => hexParaBytes('0xzz')).toThrow();
    expect(() => hexParaBytes('0xabc')).toThrow();
  });

  it('hash canônico não depende da ordem das chaves', () => {
    expect(keccak256Canonico({ a: 1, b: 2 })).toBe(keccak256Canonico({ b: 2, a: 1 }));
  });
});

describe('esquema de evidência', () => {
  it('a lista de campos do validador é a mesma do JSON Schema', () => {
    const doSchema = esquemaJson.$defs.conteudo.required;
    expect([...CAMPOS_CONTEUDO].sort()).toEqual([...doSchema].sort());
  });

  it('aceita um conteúdo bem formado', () => {
    expect(validarConteudo(conteudoDeTeste())).toEqual([]);
  });

  it('recusa peso zero ou negativo, porque a balança é a fonte do peso', () => {
    expect(validarConteudo(conteudoDeTeste({ pesoKg: 0 }))).toContain(
      'pesoKg deve ser um número maior que 0 e até 2000',
    );
  });

  it('recusa geohash com precisão diferente de 7', () => {
    expect(validarConteudo(conteudoDeTeste({ geohash: '7js6d' })).length).toBeGreaterThan(0);
    expect(validarConteudo(conteudoDeTeste({ geohash: '7js6dd7x' })).length).toBeGreaterThan(0);
  });

  it('recusa campo desconhecido, para nome de pessoa não entrar de carona no hash', () => {
    const comNome = { ...conteudoDeTeste(), nomeDoColetor: 'Dona Nilza' };
    expect(validarConteudo(comNome)).toContain('campo desconhecido no conteúdo: nomeDoColetor');
  });

  it('acusa correção humana não marcada', () => {
    const conteudo = conteudoDeTeste();
    conteudo.classificacao.classeFinal = 'vidro';
    expect(validarConteudo(conteudo)).toContain(
      'classeFinal difere da sugerida mas corrigidoPorHumano está falso',
    );
  });

  it('valida o registro completo montado pelo construtor', () => {
    const { versaoEsquema: _ignorado, ...semVersao } = conteudoDeTeste();
    expect(validarRegistro(montarRegistro(semVersao))).toEqual([]);
  });
});

describe('fronteira do dado pessoal', () => {
  it('reconhece campos de pessoa pelo nome', () => {
    const achados = varrerDadoPessoal({ agregado: { nomeResponsavel: 'Maria' } });
    expect(achados.map(a => a.caminho)).toContain('$.agregado.nomeResponsavel');
  });

  it('reconhece CPF, e-mail, telefone e coordenada pelo formato', () => {
    const motivos = varrerDadoPessoal({
      obs: 'cadastro 123.456.789-09',
      campo2: 'fulano@exemplo.org',
      campo3: '(75) 99999-1234',
      campo4: '-13.60123, -38.91234',
    }).map(a => a.motivo);
    expect(motivos).toEqual(
      expect.arrayContaining(['parece CPF', 'parece e-mail', 'parece telefone', 'parece coordenada exata']),
    );
  });

  it('deixa passar o agregado legítimo do lote diário', () => {
    expect(() => exigirPayloadSemDadoPessoal({
      versaoEsquema: 'evidencia-coleta-v1',
      dataLote: '2026-09-14',
      merkleRoot: '0x' + '11'.repeat(32),
      quantidadeRegistros: 12,
      pesoTotalKg: 148.5,
      pesoPorMaterial: { PET: 60, aluminio: 12, vidro: 40, papelao: 30, outros: 6.5 },
      quantidadeSinalizados: 2,
    })).not.toThrow();
  });

  it('bloqueia campo fora da lista branca, mesmo parecendo inofensivo', () => {
    expect(() => exigirPayloadSemDadoPessoal({
      merkleRoot: '0x' + '11'.repeat(32),
      observacao: 'coleta tranquila',
    })).toThrow(/fora da lista permitida/);
  });

  it('bloqueia dado pessoal escondido dentro de campo permitido', () => {
    expect(() => exigirPayloadSemDadoPessoal({
      merkleRoot: '0x' + '11'.repeat(32),
      pesoPorMaterial: { PET: 10, coletor: 'Dona Nilza' },
    })).toThrow(/dado pessoal/);
  });

  it('a lista branca não inclui nada individualizável', () => {
    for (const campo of CAMPOS_PERMITIDOS_ONCHAIN) {
      expect(campo).not.toMatch(/foto|geo|nome|coletor|pHash|assinatura/i);
    }
  });
});

describe('registro', () => {
  it('calcula o hash na construção, e ele confere', () => {
    const { versaoEsquema: _v, ...semVersao } = conteudoDeTeste();
    const registro = montarRegistro(semVersao);
    expect(registro.hashConteudo).toMatch(/^0x[0-9a-f]{64}$/);
    expect(hashConfere(registro)).toBe(true);
  });

  it('dois registros com o mesmo conteúdo têm o mesmo hash', () => {
    const { versaoEsquema: _v, ...base } = conteudoDeTeste();
    expect(montarRegistro(base).hashConteudo).toBe(montarRegistro({ ...base }).hashConteudo);
  });

  it('mexer em qualquer campo do conteúdo muda o hash', () => {
    const { versaoEsquema: _v, ...base } = conteudoDeTeste();
    const original = montarRegistro(base).hashConteudo;
    expect(montarRegistro({ ...base, pesoKg: base.pesoKg + 0.1 }).hashConteudo).not.toBe(original);
  });

  it('recusa montar registro inválido em vez de gravar lixo', () => {
    const { versaoEsquema: _v, ...base } = conteudoDeTeste();
    expect(() => montarRegistro({ ...base, pesoKg: -1 })).toThrow(ErroRegistroInvalido);
  });

  it('sinalização posterior não muda o hash do que foi observado em campo', () => {
    const { versaoEsquema: _v, ...base } = conteudoDeTeste();
    const registro = montarRegistro(base);
    const sinalizado = comSinalizacoes(registro, [{
      codigo: 'foto_reaproveitada',
      gravidade: 'alta',
      motivo: 'A foto é quase igual à de outro registro.',
    }]);
    expect(sinalizado.hashConteudo).toBe(registro.hashConteudo);
    expect(hashConfere(sinalizado)).toBe(true);
    expect(precisaRevisao(sinalizado)).toBe(true);
  });

  it('não duplica a mesma sinalização quando a checagem roda de novo', () => {
    const { versaoEsquema: _v, ...base } = conteudoDeTeste();
    const sinal = { codigo: 'pilha_recontada', gravidade: 'atencao', motivo: 'x' } as const;
    const uma = comSinalizacoes(montarRegistro(base), [sinal]);
    expect(comSinalizacoes(uma, [sinal]).sinalizacoes).toHaveLength(1);
  });
});
