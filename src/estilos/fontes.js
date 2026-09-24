/* ---------------------------------------------------------------------------
   As fontes do projeto, servidas pelo próprio domínio.

   Antes vinham de um `@import` do Google Fonts, o que colocava um terceiro no
   caminho crítico da primeira pintura e fazia a página depender de um domínio
   que nem sempre é alcançável. Com @fontsource os arquivos entram no build e
   saem do mesmo lugar que o resto.

   Só os pesos que a página de fato usa. Fraunces e Manrope são variáveis: um
   arquivo cobre toda a faixa de peso, e Fraunces traz junto o eixo óptico
   (`opsz`), que é o que faz os títulos grandes não parecerem a mesma letra
   esticada. O navegador só baixa cada família quando alguma regra a exige.
--------------------------------------------------------------------------- */

import '@fontsource-variable/fraunces';
/* O itálico de verdade, e não o oblíquo que o navegador inventaria: os
   destaques em itálico do site público são desenhados nele. */
import '@fontsource-variable/fraunces/wght-italic.css';
import '@fontsource-variable/manrope';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
/* A mono do site público (landing, contato e explorar). O painel continua na
   IBM Plex Mono até o redesign dele chegar. */
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
