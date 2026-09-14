import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './estilos/fontes.js'; // Fraunces, Manrope e IBM Plex Mono, servidas daqui

/* Nem o estado da operação nem o CSS do painel entram aqui.
   `StoreProvider`, `estilos/styles.css` e `estilos/estilos-rastreio.css` são de
   quem opera, e foram para `painel/PainelApp.jsx`, que só é buscado nas rotas
   do painel. Enquanto moravam neste arquivo, a landing carregava o aplicativo
   inteiro — folha de estilo e reducer incluídos — para desenhar uma página que
   não usa nada disso. O `body { margin: 0 }` que vinha junto ficou em
   `index.html`, inline, porque vale para todas as rotas. */

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA: instala o service worker (app instalável e offline-first)
if ('serviceWorker' in navigator && !location.hostname.includes('localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
