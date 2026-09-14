/* ---------------------------------------------------------------------------
   O pseudônimo do coletor.

   O registro precisa saber que duas coletas são da mesma pessoa (para pagar a
   renda certa, e para as detecções de sequência funcionarem). E não pode saber
   quem é a pessoa.

   HMAC-SHA256 com sal do projeto, e não SHA-256 puro: com hash puro, quem tiver
   a base e a lista de 30 famílias testa os 30 nomes em um segundo e reidentifica
   todo mundo. O conjunto de entradas possíveis é pequeno demais para hash sem
   segredo servir de pseudonimização. Com HMAC, sem o sal não há o que testar.

   Onde o sal mora: fora do aparelho e fora do repositório, numa variável de
   ambiente de compilação. O app de campo nem precisa dele se o pseudônimo vier
   pronto do cadastro; a função existe aqui porque o piloto ainda gera no
   aparelho, e é melhor ter isso explícito e comentado do que escondido.

   Isso é pseudonimização, não anonimização, e a diferença importa para a LGPD:
   quem tem o sal e a lista de coletores consegue reverter. Por isso o pseudônimo
   continua sendo dado pessoal na base da operação, e por isso ele NÃO vai para a
   cadeia, onde ninguém poderia mais apagá-lo.
--------------------------------------------------------------------------- */

/**
 * Sal do projeto.
 *
 * Em produção vem de `VITE_SAL_PSEUDONIMO`. O valor de demonstração existe para
 * o app rodar em máquina nova sem configuração, e por ser público não protege
 * nada: `salConfigurado()` diz se o que está em uso é o de verdade, e a tela de
 * revisão mostra o aviso quando não é.
 */
const SAL_DEMONSTRACAO = 'raizes-do-futuro-demonstracao-sem-valor-de-segredo';

function salDoAmbiente(): string {
  const ambiente = (import.meta as { env?: Record<string, string | undefined> }).env;
  return ambiente?.['VITE_SAL_PSEUDONIMO'] ?? SAL_DEMONSTRACAO;
}

export function salConfigurado(): boolean {
  return salDoAmbiente() !== SAL_DEMONSTRACAO;
}

/**
 * Pseudônimo estável de um coletor: HMAC-SHA256 do id, em hexadecimal.
 *
 * O id de entrada é o do cadastro (`BOI-001`), nunca o nome: mesmo sob HMAC,
 * alimentar a função com nome de pessoa faria o nome passar pela memória do
 * aparelho sem necessidade nenhuma.
 */
export async function pseudonimoDe(idColetor: string, sal = salDoAmbiente()): Promise<string> {
  if (!idColetor || idColetor.trim().length === 0) {
    throw new Error('id do coletor vazio: sem ele a renda não chega a ninguém');
  }
  const chave = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(sal),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const assinatura = await crypto.subtle.sign(
    'HMAC', chave, new TextEncoder().encode(idColetor.trim()),
  );
  return [...new Uint8Array(assinatura)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Confere se um pseudônimo corresponde a um id conhecido.
 *
 * É assim que a coordenação liga o registro à família na hora de pagar: ela tem
 * a lista de ids e o sal, então percorre os 30 e acha. O caminho contrário (do
 * pseudônimo para a pessoa, sem a lista) continua fechado.
 */
export async function pseudonimoCorresponde(
  pseudonimo: string, idColetor: string, sal?: string,
): Promise<boolean> {
  return (await pseudonimoDe(idColetor, sal)) === pseudonimo;
}
