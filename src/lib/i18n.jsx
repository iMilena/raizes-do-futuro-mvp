/* ---------------------------------------------------------------------------
   Idioma no React: português, inglês e espanhol.

   A tradução de fato acontece em ./idioma.js, para o site inteiro: os textos
   que aparecem na tela são trocados pelos dos dicionários
   (./traducoes/en.json e es.json). Este arquivo só dá aos componentes o idioma
   atual e a função `t`, para quem precisa de texto traduzido fora da tela
   (um title montado, um formato de data).

   O dicionário de inglês que vivia aqui (dashboard e rastreio) foi para
   ./traducoes/en.json, junto com o resto do site.
--------------------------------------------------------------------------- */
import React, { useSyncExternalStore } from 'react';
import { definirIdioma, idiomaAtual, ouvirIdioma, traduzir } from './idioma.js';

function useIdiomaGlobal() {
  return useSyncExternalStore(ouvirIdioma, idiomaAtual, () => 'pt');
}

/** Mantido por compatibilidade: o idioma já é global, este provedor só repassa. */
export function IdiomaProvider({ children }) {
  return <>{children}</>;
}

export function useIdioma() {
  const idioma = useIdiomaGlobal();
  return { idioma, t: traduzir, trocar: definirIdioma, en: idioma === 'en', es: idioma === 'es' };
}
