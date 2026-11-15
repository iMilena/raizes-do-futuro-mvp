import { useEffect, useRef, useState } from 'react';
import { IDIOMAS } from '../lib/idioma.js';
import { useIdioma } from '../lib/i18n.jsx';

/* ---------------------------------------------------------------------------
   PT · EN · ES. O mesmo seletor em todas as páginas.

   `variante`:
     · "barra" (padrão): três botões lado a lado, para barras com espaço
       (painel, mapa, rastreio, menu do celular);
     · "compacto": um botão só, com globo e o idioma atual, que abre a lista;
       para a barra do site, onde cada pixel já tem dono;
     · "flutuante": três botões fixos no canto da tela, para as páginas sem
       barra própria (contato, entrada, app da família).

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
.sel-idioma button:focus-visible,.sel-idioma-c button:focus-visible{outline:3px solid #f3b267;outline-offset:2px}
.sel-idioma.sel-idioma--flutuante{position:fixed;z-index:2147483000;left:12px;bottom:12px;box-shadow:0 6px 24px rgba(0,0,0,.35)}
.sel-idioma.sel-idioma--claro{background:#fff;border-color:rgba(0,0,0,.14)}
.sel-idioma.sel-idioma--claro button{color:#2b4a3c}
.sel-idioma.sel-idioma--claro button:hover{background:#eef5f0;color:#10241d}
.sel-idioma.sel-idioma--claro button[aria-pressed="true"]{background:#2e5a3e;color:#fff}

.sel-idioma-c{position:relative;flex:0 0 auto;font:700 13px/1 Manrope,system-ui,sans-serif}
.sel-idioma-c > button{display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 12px;border-radius:999px;
  border:1px solid rgba(207,237,217,.28);background:transparent;color:#cfedd9;font:inherit;letter-spacing:.06em;cursor:pointer;white-space:nowrap}
.sel-idioma-c > button:hover,.sel-idioma-c > button[aria-expanded="true"]{border-color:#cfedd9;color:#fff}
.sel-idioma-c svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.sel-idioma-c .seta{width:10px;height:10px;transition:transform .2s}
.sel-idioma-c > button[aria-expanded="true"] .seta{transform:rotate(180deg)}
.sel-idioma-c ul{position:absolute;right:0;top:calc(100% + 8px);min-width:160px;margin:0;padding:6px;list-style:none;border-radius:14px;
  background:rgba(6,23,19,.97);border:1px solid rgba(207,237,217,.2);box-shadow:0 14px 40px rgba(0,0,0,.45);z-index:200}
.sel-idioma-c li button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;min-height:40px;padding:0 12px;border:0;border-radius:10px;
  background:transparent;color:#cfedd9;font:600 14px/1 Manrope,system-ui,sans-serif;text-align:left;cursor:pointer}
.sel-idioma-c li button:hover,.sel-idioma-c li button:focus-visible{background:rgba(127,217,154,.14);color:#fff}
.sel-idioma-c li button[aria-checked="true"]{color:#7fd99a}
.sel-idioma-c li small{font-size:11px;letter-spacing:.08em;opacity:.7}

@media (pointer:coarse){.sel-idioma button{min-height:44px;min-width:44px}.sel-idioma-c > button{height:44px}}
@media (max-width:1060px){.sel-idioma.so-largo,.sel-idioma-c.so-largo{display:none}}
@media (max-width:700px){.sel-idioma.acima-700{display:none}}
@media (min-width:701px){.sel-idioma.abaixo-700{display:none}}
.sel-idioma.no-menu{align-self:flex-start;margin:6px 0}
.sel-idioma.sel-idioma--flutuante.no-topo{top:100px;bottom:auto;left:auto;right:12px}
@media print{.sel-idioma,.sel-idioma-c{display:none}}
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

function Compacto({ className }) {
  const { idioma, trocar } = useIdioma();
  const [aberto, setAberto] = useState(false);
  const raiz = useRef(null);
  const atual = IDIOMAS.find((l) => l.id === idioma) ?? IDIOMAS[0];

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (!raiz.current?.contains(e.target)) setAberto(false); };
    const tecla = (e) => { if (e.key === 'Escape') { setAberto(false); raiz.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', tecla);
    raiz.current?.querySelector('li button[aria-checked="true"]')?.focus();
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', tecla); };
  }, [aberto]);

  return (
    <div ref={raiz} className={`sel-idioma-c${className ? ` ${className}` : ''}`} translate="no">
      <button type="button" aria-haspopup="true" aria-expanded={aberto} aria-label={`Idioma · Language: ${atual.nome}`} onClick={() => setAberto((a) => !a)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.8 3.9 5.8 3.9 9s-1.3 6.2-3.9 9c-2.6-2.8-3.9-5.8-3.9-9S9.4 5.8 12 3z" /></svg>
        {atual.rotulo}
        <svg className="seta" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5l3 3 3-3" /></svg>
      </button>
      {aberto && (
        <ul role="menu" aria-label="Idioma · Language · Idioma">
          {IDIOMAS.map((l) => (
            <li key={l.id} role="none">
              <button type="button" role="menuitemradio" aria-checked={idioma === l.id} lang={l.html}
                onClick={() => { trocar(l.id); setAberto(false); }}>
                {l.nome}<small>{l.rotulo}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SeletorIdioma({ variante = 'barra', tom = 'escuro', className = '' }) {
  injetarCss();
  const { idioma, trocar } = useIdioma();
  if (variante === 'compacto') return <Compacto className={className} />;
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
