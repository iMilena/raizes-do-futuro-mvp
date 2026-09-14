/* Entrada do PWA de campo.

   Separado do main.jsx do painel de propósito: o catador instala este app, com
   ícone próprio, e não leva junto o painel da operação, o cofre multisig e o
   mercado. São dois públicos, dois aparelhos e dois momentos. */
import React from 'react';
import ReactDOM from 'react-dom/client';
import AppCampo from './AppCampo.js';
import '@fontsource-variable/manrope';
import './estilos/campo.css';

ReactDOM.createRoot(document.getElementById('raiz')!).render(
  <React.StrictMode>
    <AppCampo />
  </React.StrictMode>,
);

/* Service worker: é ele que faz o app abrir sem internet no dia seguinte.
   Fora de localhost para o desenvolvimento não servir versão velha em cache. */
if ('serviceWorker' in navigator && !location.hostname.includes('localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
