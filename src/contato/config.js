/* ---------------------------------------------------------------------------
   CONFIGURAÇÃO DA PÁGINA "FALAR COM A EQUIPE": preencha com os canais reais.

   Tudo vazio de propósito. A página não inventa contato: cada canal só aparece
   quando o campo dele estiver preenchido.

   O envio do formulário segue esta ordem:
     1. `formEndpoint` preenchido → POST JSON para ele (Formspree, Tally,
        Google Forms, uma função do Supabase…);
     2. senão, `email` preenchido → abre o programa de e-mail com a mensagem
        pronta (`mailto:`);
     3. senão, modo protótipo: os dados só vão para o console.

   Mora aqui, e não em `src/config/contato.js`, porque já existe um
   `src/config.js` na raiz, e uma pasta com o mesmo nome ao lado dele deixaria
   `import '../config'` ambíguo para quem lê.
--------------------------------------------------------------------------- */

export const CONTATO = {
  /** Recebe os envios quando não há `formEndpoint`. Ex.: contato@dominio.org */
  email: '',
  /** Opcional: URL que recebe um POST JSON com as respostas. */
  formEndpoint: '',
  /** Só números, com DDI e DDD. Ex.: 5571999999999 */
  whatsapp: '',
  /** Sem o @. Ex.: raizesdofuturo */
  instagram: '',
  /** Link do kit de imprensa e investidores. */
  kitUrl: '',
};
