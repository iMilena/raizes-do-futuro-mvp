/* ---------------------------------------------------------------------------
   A equipe, num lugar só: o site em português e a página de investidores em
   inglês mostram as mesmas pessoas, cada uma no seu idioma.

   Nomes e papéis vêm da apresentação à banca (slide 1).

   PENDENTE com a equipe, e a página se ajusta sozinha enquanto isso:
     · `foto`: ponha a imagem em public/equipe/ e escreva o caminho aqui
       (ex.: '/equipe/milena.webp'), quadrada, 240 px basta. Sem foto, aparecem
       as iniciais.
     · `historico`: uma ou duas frases por idioma (formação, experiência,
       ligação com Boipeba). Vazio, aparecem só nome e papel.
     · o reconhecimento da CNN: confirmar o texto abaixo.
--------------------------------------------------------------------------- */

export const PESSOAS = [
  {
    nome: 'Milena Lopes Calasans',
    foto: null,
    papel: { pt: 'Desenvolvimento Web3', en: 'Web3 developer' },
    historico: { pt: '', en: '' },
  },
  {
    nome: 'Amanda Carolina Folly',
    foto: null,
    papel: { pt: 'Design e pitch', en: 'Design and pitch' },
    historico: { pt: '', en: '' },
  },
  {
    nome: 'Thalyta Silva dos Santos',
    foto: null,
    papel: { pt: 'Pesquisa de campo', en: 'Field research' },
    historico: { pt: '', en: '' },
  },
  {
    nome: 'Maria Clara de O. Bastos',
    foto: null,
    papel: { pt: 'Desenvolvimento Web2/Web3', en: 'Web2/Web3 developer' },
    historico: { pt: '', en: '' },
  },
];

export const RECONHECIMENTO = [
  {
    destaque: { pt: 'Vencedor', en: 'Winner' },
    texto: {
      pt: 'Youth Challenge Blockchain, do UNICEF Brasil: soluções de tecnologia para a proteção de crianças e adolescentes.',
      en: 'Youth Challenge Blockchain, UNICEF Brazil: technology solutions for the protection of children and adolescents.',
    },
  },
  {
    destaque: { pt: 'CNN', en: 'CNN' },
    texto: {
      pt: 'A CNN procurou a equipe para contar a história do projeto.',
      en: 'CNN reached out to the team to cover the project.',
    },
  },
];

/** Iniciais para quando ainda não há foto: primeiro e último nome. */
export function iniciais(nome) {
  const partes = nome.split(' ').filter((p) => /^[A-ZÀ-Ý]/.test(p));
  return partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : (partes[0]?.[0] ?? '');
}
