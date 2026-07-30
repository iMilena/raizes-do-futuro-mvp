/* ---------------------------------------------------------------------------
   Captura de telas — para OLHAR o resultado, não só afirmar que passou.

   Suíte verde diz que a estrutura está de pé; não diz se ficou bonito, se algo
   vazou para fora da caixa ou se um texto sumiu no fundo. Este script grava PNG
   das telas principais em `capturas/`, em largura de notebook e de celular.

   Uso: node testes/telas.mjs   (com o dev server no ar, ou via npm test -- telas)
--------------------------------------------------------------------------- */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegador, espera } from './ajuda/cdp.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = join(RAIZ, 'capturas');
const ALVO = process.env.ALVO ?? 'http://localhost:5173';

/* O hash deixou de poder ser vazio: a raiz virou a landing, e as quatro telas do
   painel passaram a ser capturadas em cima da página de apresentação — a primeira
   captura chegava a estourar o tempo do captureScreenshot, porque a landing é
   muito alta e carrega ~2,9 MB de imagens. */
const TELAS = [
  ['painel-dashboard', '#/painel', 'Dashboard'],
  ['painel-cofre', '#/painel', 'Cofre Multisig'],
  ['painel-mercado', '#/painel', 'Mercado'],
  ['painel-validacao', '#/painel', 'Instituto Vivá'],
  ['app-familia', '#/familia', null],
];

mkdirSync(SAIDA, { recursive: true });
const nav = await abrirNavegador({ porta: 9360 });
const erros = [];

try {
  for (const [larg, alt, sufixo] of [[1440, 980, ''], [412, 900, '-celular']]) {
    await nav.cdp('Emulation.setDeviceMetricsOverride', {
      width: larg, height: alt, deviceScaleFactor: 2, mobile: larg < 700,
    });
    for (const [nome, hash, aba] of TELAS) {
      await nav.cdp('Page.navigate', { url: ALVO + '/' + hash });
      await espera(1100);
      await nav.ev(`localStorage.setItem('raizes-tour-v1','visto'); return 1;`);
      await nav.cdp('Page.reload', {});
      await espera(1600);
      if (aba) {
        await nav.ev(`
          const b = [...document.querySelectorAll('nav.tabs button')].find(x => x.innerText.includes(${JSON.stringify(aba)}));
          if (b) b.click();
          return !!b;
        `);
        await espera(800);
      }
      /* só o viewport: `captureBeyondViewport` numa página com barra lateral
         fixa de 100vh trava o Edge (a captura esperou 20 s e não voltou). E o
         que interessa aqui é o que a pessoa vê ao abrir. */
      const { data } = await nav.cdp('Page.captureScreenshot', { format: 'png' });
      const arq = join(SAIDA, `${nome}${sufixo}.png`);
      writeFileSync(arq, Buffer.from(data, 'base64'));
      console.log('  📷 ' + arq.replace(RAIZ + '\\', '').replace(RAIZ + '/', ''));
    }
  }

  /* Overflow horizontal é o defeito que screenshot esconde e usuário sente.
     Agora em DUAS rotas: a raiz virou a landing, e checar só ela deixaria o
     painel sem cobertura — a troca de rota mudaria em silêncio o que este teste
     verifica. A landing é a mais nova e a menos testada das duas. */
  await nav.cdp('Emulation.setDeviceMetricsOverride', { width: 412, height: 900, deviceScaleFactor: 1, mobile: true });
  for (const [rota, nome] of [['', 'landing (raiz)'], ['/#/painel', 'painel']]) {
    await nav.cdp('Page.navigate', { url: ALVO + rota });
    await espera(1800);
    const vaza = await nav.ev('return document.documentElement.scrollWidth - window.innerWidth');
    console.log(vaza > 2
      ? `  ✗ ${nome}: vaza ${vaza}px na horizontal em 412px`
      : `  ✓ ${nome}: sem vazamento horizontal em 412px`);
    if (vaza > 2) erros.push('overflow em ' + nome);
  }
} finally {
  await nav.fechar();
}

process.exit(erros.length ? 1 : 0);
