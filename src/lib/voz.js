/* ---------------------------------------------------------------------------
   Voz da Tuca — leitura em voz alta na tela da família (Web Speech, nativo).

   POR QUE ISTO EXISTE
   Não é enfeite: em Boipeba há adultos com pouca leitura fluente, e a tela da
   família fala de dinheiro e de condição de saúde de criança. Quem não lê bem
   depende de outra pessoa para entender o próprio saldo — o que é exatamente a
   dependência que o projeto quer remover.

   TRÊS REGRAS QUE NÃO SE NEGOCIAM
   1. NUNCA fala sozinha na primeira visita. Som que começa sem pedir é hostil:
      assusta, atrapalha quem está num ônibus e gasta bateria. A pessoa liga.
   2. A escolha é lembrada (localStorage), por família nenhuma — é do aparelho.
   3. Sem voz pt-BR instalada, o botão não aparece. Um botão que promete áudio e
      solta voz em inglês robótico é pior que nenhum botão.

   Zero dependência: `speechSynthesis` é do navegador.
--------------------------------------------------------------------------- */

const CHAVE = 'raizes-voz-v1';

const sintese = () => (typeof globalThis !== 'undefined' ? globalThis.speechSynthesis : null);

/**
 * Vozes pt-BR disponíveis.
 *
 * `getVoices()` costuma vir VAZIO na primeira chamada — o Chrome/Edge carrega a
 * lista de forma assíncrona e avisa por `voiceschanged`. Quem consulta uma vez
 * no boot conclui "não tem voz" e esconde o botão para sempre. Por isso o
 * módulo reconsulta e avisa quem estiver ouvindo.
 */
export function vozesPtBr() {
  const s = sintese();
  if (!s?.getVoices) return [];
  return s.getVoices().filter(v => /^pt(-|_)?BR/i.test(v.lang) || /^pt/i.test(v.lang));
}

let ouvintes = [];
export function aoMudarVozes(fn) {
  const s = sintese();
  if (!s) return () => {};
  ouvintes.push(fn);
  const aviso = () => fn(vozesPtBr());
  s.addEventListener?.('voiceschanged', aviso);
  return () => {
    ouvintes = ouvintes.filter(f => f !== fn);
    s.removeEventListener?.('voiceschanged', aviso);
  };
}

export const vozDisponivel = () => vozesPtBr().length > 0;

/* --------------------------------------------------------- preferência ---- */
const armazem = () => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

export function vozLigada() {
  try { return armazem()?.getItem(CHAVE) === 'sim'; } catch { return false; }
}

export function ligarVoz(ligar) {
  try { ligar ? armazem()?.setItem(CHAVE, 'sim') : armazem()?.removeItem(CHAVE); } catch { /* sem storage */ }
  if (!ligar) parar();
}

/* --------------------------------------------------------------- falar ---- */

/** Escolhe a melhor voz pt-BR: prefere a marcada como local (não depende de rede). */
function melhorVoz() {
  const vs = vozesPtBr();
  return vs.find(v => v.localService && /BR/i.test(v.lang))
    || vs.find(v => /BR/i.test(v.lang))
    || vs[0]
    || null;
}

/**
 * Prepara o texto para leitura.
 *
 * Emoji lido em voz alta vira "cara sorrindo com olhos de coração" no meio de
 * uma frase sobre dinheiro. E "R$ 90,00" sai como "erre cifrão noventa vírgula
 * zero zero" — então viramos em palavra antes de falar.
 */
export function paraFala(texto) {
  return String(texto || '')
    // R$ 1.234,56 → "1234 reais e 56 centavos"
    .replace(/R\$\s?([\d.]+),(\d{2})/g, (_, inteiro, centavos) => {
      const reais = inteiro.replace(/\./g, '');
      const c = Number(centavos);
      return c === 0 ? `${reais} reais` : `${reais} reais e ${c} centavos`;
    })
    .replace(/\bkg\b/gi, 'quilos')
    .replace(/\bPix\b/g, 'Pics')
    // remove emoji e símbolos gráficos, que a síntese tenta descrever
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function parar() {
  try { sintese()?.cancel(); } catch { /* nada a cancelar */ }
}

/**
 * Fala um texto. Silencioso quando a voz está desligada — assim quem chama não
 * precisa checar a preferência em toda tela.
 * @returns {boolean} se realmente foi falar
 */
export function falar(texto, { forcar = false } = {}) {
  const s = sintese();
  if (!s || (!vozLigada() && !forcar)) return false;
  const limpo = paraFala(texto);
  if (!limpo) return false;

  /* cancela o anterior: duas falas sobrepostas não se entendem, e a tela da
     família troca de texto rápido (missões, toasts). */
  parar();

  const f = new SpeechSynthesisUtterance(limpo);
  const v = melhorVoz();
  if (v) { f.voice = v; f.lang = v.lang; } else { f.lang = 'pt-BR'; }
  f.rate = 0.95;   // um tico mais devagar que o padrão, para número ficar claro
  f.pitch = 1.05;  // a Tuca é acolhedora, não um leitor de bula
  try { s.speak(f); return true; } catch { return false; }
}
