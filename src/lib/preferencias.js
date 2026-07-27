/* ---------------------------------------------------------------------------
   Preferências de acessibilidade do app da família.

   Ficam no aparelho, não na nuvem: são escolha de quem está com o celular na
   mão, e não têm por que atravessar a rede — nem interessam à operação.
--------------------------------------------------------------------------- */

const CHAVE_LETRA = 'raizes-letra-v1';

const armazem = () => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

export function letraGrande() {
  try { return armazem()?.getItem(CHAVE_LETRA) === 'g'; } catch { return false; }
}

export function salvarLetra(grande) {
  try {
    if (grande) armazem()?.setItem(CHAVE_LETRA, 'g');
    else armazem()?.removeItem(CHAVE_LETRA);
  } catch { /* modo privado: vale só nesta sessão */ }
}
