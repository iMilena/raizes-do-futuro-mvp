/* ---------------------------------------------------------------------------
   Os endereços do projeto, em um lugar só.

   São três coisas que mudam por ambiente e que, espalhadas pelo JSX, viram
   caça ao link quebrado: para onde vai o botão do painel, para onde volta quem
   está no painel e quer o site, e para qual caixa de entrada vão os pedidos de
   contato. Cada um aceita ser sobrescrito por variável de ambiente do Vite
   (`.env`), e cai no padrão de dentro do próprio app quando não há nenhuma.

   O padrão do painel é a rota de hash deste mesmo app (`#/painel`), não uma URL
   de produção: é o painel que existe aqui, e a landing publicada junto com ele
   nunca aponta para o lugar errado. Se um dia o painel morar em outro domínio,
   basta preencher `VITE_URL_PAINEL`.

   O e-mail abaixo foi confirmado pela equipe em 24/09/2026 e é o mesmo da
   página "Falar com a equipe" (src/contato/config.js). É para ele que a porta
   do painel manda os pedidos de acesso.
--------------------------------------------------------------------------- */

const env = import.meta.env ?? {};

/** Painel operacional (a jornada em si). */
export const URL_PAINEL = env.VITE_URL_PAINEL || '#/painel';

/** Porta de entrada do painel: quem ainda não tem acesso passa por aqui. */
export const URL_ENTRADA_PAINEL = env.VITE_URL_ENTRADA_PAINEL || '#/login';

/** Site do projeto — o "voltar" da porta de entrada. */
export const URL_SITE = env.VITE_URL_SITE || '#/';

/** Página "Falar com a equipe". Aceita `?tipo=` para chegar com o assunto escolhido. */
export const URL_CONTATO = '#/contato';

/** Experiência "Explorar a ilha": o mapa de Boipeba com o ciclo animado. */
export const URL_EXPLORAR = '#/explorar';

/** Caixa de entrada dos pedidos de acesso ao painel (porta de entrada). */
export const EMAIL_CONTATO = env.VITE_EMAIL_CONTATO || 'milena.lcalasans@gmail.com';

/**
 * `true` quando o destino é uma rota interna de hash, e não outro site.
 * Link interno não abre em aba nova nem precisa de `rel="noopener"`.
 */
export const ehRotaInterna = (url) => typeof url === 'string' && url.startsWith('#');
