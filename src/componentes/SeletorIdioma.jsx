import React from 'react';
import { IDIOMAS } from '../lib/idioma.js';
import { useIdioma } from '../lib/i18n.jsx';

/* ---------------------------------------------------------------------------
   PT · EN · ES. O mesmo seletor em todas as páginas.

   `variante`:
     · "flutuante": fixo no canto da tela, para as páginas sem barra própria
       (mapa, contato, entrada, app da família);
     · "barra": dentro de uma barra (site, painel, rastreio), herda a cor dela.

   Os rótulos e os nomes dos idiomas não são traduzidos (translate="no"): cada
   idioma se apresenta no próprio nome.
--------------------------------------------------------------------------- */
const CSS = `
.sel-idioma{display:inline-flex;align-items:center;height:auto;box-sizing:border-box;flex:0 0 auto;margin:0;gap:2px;padding:3px;border-radius:999px;background:rgba(4,16,13,.72);
  border:1px solid rgba(207,237,217,.28);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font:700 12.5px/1 Manrope,system-ui,sans-serif}
.sel-idioma button{min-width:40px;min-height:36px;padding:0 10px;border:0;border-radius:999px;background:transparent;
  color:#cfedd9;font:inherit;letter-spacing:.06em;cursor:pointer}
.sel-idioma button:hover{background:rgba(127,217,154,.16);color:#fff}
.sel-idioma button[aria-pressed="true"]{background:#7fd99a;color:#04100d}
.sel-idioma button:focus-visible{outline:3px solid #f3b267;outline-offset:2px}
.sel-idioma.sel-idioma--flutuante{position:fixed;z-index:2147483000;left:12px;bottom:12px;box-shadow:0 6px 24px rgba(0,0,0,.35)}
.sel-idioma.sel-idioma--claro{background:#fff;border-color:rgba(0,0,0,.14)}
.sel-idioma.sel-idioma--claro button{color:#2b4a3c}
.sel-idioma.sel-idioma--claro button:hover{background:#eef5f0;color:#10241d}
.sel-idioma.sel-idioma--claro button[aria-pressed="true"]{background:#2e5a3e;color:#fff}
@media (pointer:coarse){.sel-idioma button{min-height:44px;min-width:44px}}
@media (max-width:1060px){.sel-idioma.so-largo{display:none}}
@media (max-width:700px){.sel-idioma.acima-700{display:none}}
@media (min-width:701px){.sel-idioma.abaixo-700{display:none}}
.sel-idioma.no-menu{align-self:flex-start;margin:6px 0}
.sel-idioma.sel-idioma--flutuante.no-topo{top:100px;bottom:auto;left:auto;right:12px}
@media print{.sel-idioma{display:none}}
`;
let cssPosto = false;
function injetarCss() {
  if (cssPosto || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.dataset.origem = 'seletor-idioma';
  s.textContent = CSS;
  document.head.appendChild(s);
  cssPosto = true;
}

export function SeletorIdioma({ variante = 'barra', tom = 'escuro', className = '' }) {
  injetarCss();
  const { idioma, trocar } = useIdioma();
  return (
    <div className={`sel-idioma sel-idioma--${variante}${tom === 'claro' ? ' sel-idioma--claro' : ''}${className ? ` ${className}` : ''}`} role="group" aria-label="Idioma · Language · Idioma" translate="no">
      {IDIOMAS.map((l) => (
        <button key={l.id} type="button" lang={l.html} title={l.nome} aria-pressed={idioma === l.id} onClick={() => trocar(l.id)}>
          {l.rotulo}
        </button>
      ))}
    </div>
  );
}

export default SeletorIdioma;
