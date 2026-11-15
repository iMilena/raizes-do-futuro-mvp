/* ---------------------------------------------------------------------------
   Os dicionários de inglês e espanhol (src/lib/traducoes).

   O site inteiro é traduzido na própria página a partir deles; uma chave sem
   par no outro idioma ou um {0} perdido aparece como texto quebrado na tela.
--------------------------------------------------------------------------- */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const ler = (l: string): Record<string, string> =>
  JSON.parse(readFileSync(new URL(`../../src/lib/traducoes/${l}.json`, import.meta.url), 'utf8'));
const en = ler('en');
const es = ler('es');

describe('dicionários de idioma', () => {
  it('inglês e espanhol têm as mesmas chaves', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
    expect(Object.keys(en).length).toBeGreaterThan(2000);
  });

  it('nenhuma tradução vazia', () => {
    for (const d of [en, es]) for (const [k, v] of Object.entries(d)) expect(v, k).toMatch(/\S/);
  });

  it('cada {0}, {1}… da chave aparece na tradução', () => {
    for (const d of [en, es]) {
      for (const [k, v] of Object.entries(d)) {
        for (const m of k.match(/\{\d+\}/g) ?? []) expect(v, k).toContain(m);
      }
    }
  });
});
