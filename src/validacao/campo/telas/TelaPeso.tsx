/* ---------------------------------------------------------------------------
   Tela do peso, com teclado próprio.

   Teclado próprio e não `<input type="number">`: o teclado numérico do sistema
   abre teclas pequenas, cobre metade da tela, e em alguns aparelhos nem aparece
   quando o campo perde foco por causa de dedo molhado. Aqui as teclas têm 72 px
   e ficam onde o polegar alcança.

   Uma casa decimal só. A balança do projeto mostra gramas, mas a coleta é pesada
   em quilos e o registro precisa ser rápido: 12,5 kg é preciso o bastante, e
   12,547 kg seria três toques a mais para um dígito que ninguém confere.
--------------------------------------------------------------------------- */
import React from 'react';
import type { ClasseMaterial } from '../../dominio/tipos.js';
import { ROTULOS_MATERIAL } from '../material.js';

export const PESO_MAXIMO_KG = 2000;

/** Aplica uma tecla ao texto do peso, devolvendo o texto novo. */
export function aplicarTecla(atual: string, tecla: string): string {
  if (tecla === 'apagar') return atual.slice(0, -1);
  if (tecla === ',') {
    if (atual.includes(',')) return atual;
    return atual.length === 0 ? '0,' : atual + ',';
  }

  const proposto = atual + tecla;
  const [inteiro, decimal] = proposto.split(',');
  if (decimal !== undefined && decimal.length > 1) return atual;   // uma casa decimal
  if ((inteiro ?? '').length > 4) return atual;                    // até 9999 kg
  if (proposto === '0') return '0';
  if (proposto.startsWith('0') && !proposto.startsWith('0,')) return atual;

  return proposto;
}

export function textoParaPeso(texto: string): number {
  return Number(texto.replace(',', '.'));
}

export function pesoValido(texto: string): boolean {
  const valor = textoParaPeso(texto);
  return Number.isFinite(valor) && valor > 0 && valor <= PESO_MAXIMO_KG;
}

interface Props {
  material: ClasseMaterial;
  valor: string;
  aoDigitar: (novo: string) => void;
  aoConfirmar: () => void;
  aoVoltar: () => void;
}

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'apagar'];

export default function TelaPeso({ material, valor, aoDigitar, aoConfirmar, aoVoltar }: Props) {
  const valido = pesoValido(valor);

  return (
    <>
      <div className="campo-corpo">
        <button className="botao-voltar" onClick={aoVoltar}>← Voltar</button>
        <h2 className="campo-pergunta">Quanto pesou?</h2>
        <p className="campo-dica">{ROTULOS_MATERIAL[material]} · use o valor da balança</p>

        <div className="peso-visor" aria-live="polite">
          <span>{valor || '0'}</span>
          <span className="unidade">kg</span>
        </div>

        <div className="teclado">
          {TECLAS.map(tecla => (
            <button
              key={tecla}
              className={'tecla' + (tecla === 'apagar' ? ' apagar' : '')}
              onClick={() => aoDigitar(aplicarTecla(valor, tecla))}
              aria-label={tecla === 'apagar' ? 'apagar último número' : tecla}
            >
              {tecla === 'apagar' ? '⌫' : tecla}
            </button>
          ))}
        </div>
      </div>

      <div className="campo-rodape">
        <button className="botao botao-principal" disabled={!valido} onClick={aoConfirmar}>
          {valido ? `Guardar ${valor} kg` : 'Digite o peso'}
        </button>
      </div>
    </>
  );
}
