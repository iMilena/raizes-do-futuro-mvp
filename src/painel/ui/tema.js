import { useCallback, useEffect, useState } from 'react';

/* ---------------------------------------------------------------------------
   O tema do painel: claro, escuro, ou o que o sistema disser.

   São três estados, não dois. Quem nunca escolheu não tem preferência a ser
   respeitada além da do sistema, e por isso o documento fica SEM `data-theme`
   nesse caso: estampar "light" em quem não pediu nada congelaria a pessoa no
   claro quando o celular dela virar para o escuro à noite.

   `localStorage` vai sempre dentro de try/catch: em aba anônima, com dados de
   site bloqueados, o simples acesso lança, e um seletor de tema não pode
   derrubar o painel inteiro.
--------------------------------------------------------------------------- */

const CHAVE = 'rf-tema';
const CONSULTA = '(prefers-color-scheme: dark)';

function lerEscolha() {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function estampar(escolha) {
  const raiz = document.documentElement;
  if (escolha) raiz.setAttribute('data-theme', escolha);
  else raiz.removeAttribute('data-theme');
}

/* Aplica a escolha salva no momento em que o módulo carrega, antes de o React
   renderizar qualquer coisa. Se esperasse o efeito do primeiro render, quem
   escolheu escuro veria um lampejo de tela branca a cada visita. O painel
   inteiro é carregado sob demanda, então isto roda junto com o pedaço dele. */
if (typeof document !== 'undefined') estampar(lerEscolha());

/**
 * Devolve `{ escolha, efetivo, escolher }`.
 *
 * `escolha` é o que a pessoa pediu (ou `null`, que quer dizer "siga o
 * sistema"); `efetivo` é o tema que está de fato na tela, e é ele que os dois
 * botões usam para dizer qual está pressionado.
 */
export function useTema() {
  const [escolha, setEscolha] = useState(lerEscolha);
  const [sistemaEscuro, setSistemaEscuro] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(CONSULTA).matches
  );

  /* Enquanto não há escolha, o estado dos botões acompanha o sistema: quem
     muda a aparência do aparelho com o painel aberto vê o par de botões
     refletir isso na hora. */
  useEffect(() => {
    const mq = window.matchMedia(CONSULTA);
    const aoMudar = e => setSistemaEscuro(e.matches);
    mq.addEventListener('change', aoMudar);
    return () => mq.removeEventListener('change', aoMudar);
  }, []);

  const escolher = useCallback(valor => {
    setEscolha(valor);
    estampar(valor);
    try {
      if (valor) localStorage.setItem(CHAVE, valor);
      else localStorage.removeItem(CHAVE);
    } catch {
      /* Sem persistência o tema ainda vale para esta sessão, que é melhor do
         que recusar a troca. */
    }
  }, []);

  return {
    escolha,
    efetivo: escolha ?? (sistemaEscuro ? 'dark' : 'light'),
    escolher,
  };
}
