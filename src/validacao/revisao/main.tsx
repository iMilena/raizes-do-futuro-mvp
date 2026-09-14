/* Entrada do painel de revisão.

   Terceira entrada do Vite, ao lado do painel da operação e do app de campo.
   Separada porque o público é outro (coordenação, em notebook) e porque assim o
   bundle que o catador baixa em 3G não carrega esta tela junto. */
import React from 'react';
import ReactDOM from 'react-dom/client';
import PainelRevisao from './PainelRevisao.js';
import '@fontsource-variable/manrope';
import './estilos/pagina.css';

ReactDOM.createRoot(document.getElementById('raiz')!).render(
  <React.StrictMode>
    <PainelRevisao />
  </React.StrictMode>,
);
