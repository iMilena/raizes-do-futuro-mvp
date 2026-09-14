/* Como cada material aparece na tela do catador.

   Ícone antes de palavra: quem usa o app pode ter pouca familiaridade com
   leitura em tela pequena, e o desenho da garrafa é reconhecido mais rápido que
   a palavra "PET" debaixo de sol forte. A palavra continua ali, porque ícone
   sozinho é adivinhação.

   Os rótulos repetem os de `modelo/raizes_modelo/classes.py`. Repetem de
   propósito: o app não pode depender de um arquivo Python em tempo de execução,
   e há teste conferindo que os dois não divergiram. */
import { CLASSES_MATERIAL } from '../dominio/tipos.js';
import type { ClasseMaterial } from '../dominio/tipos.js';

export const ROTULOS_MATERIAL: Record<ClasseMaterial, string> = {
  PET: 'Plástico PET',
  aluminio: 'Alumínio',
  vidro: 'Vidro',
  papelao: 'Papelão',
  outros: 'Outros',
};

export const ICONES_MATERIAL: Record<ClasseMaterial, string> = {
  PET: '🧴',
  aluminio: '🥫',
  vidro: '🍾',
  papelao: '📦',
  outros: '🗑️',
};

export const MATERIAIS = CLASSES_MATERIAL.map(classe => ({
  classe,
  rotulo: ROTULOS_MATERIAL[classe],
  icone: ICONES_MATERIAL[classe],
}));
