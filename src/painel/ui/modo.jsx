import { createContext, useCallback, useContext, useState } from 'react';

/* ---------------------------------------------------------------------------
   Os dois modos do painel.

     Apresentação  para investidores e júri: cada número mostra de onde vem.
     Operação      para a equipe: aparecem a fila do dia, os contadores de
                   pendência no menu e os botões de ação.

   É o MESMO painel nos dois modos; o modo só decide o que fica visível. As
   telas marcam o que é de um modo só com as classes `mode-op` e `mode-pr`, e a
   regra de mostrar ou esconder mora em shell.css, a partir da classe que o
   shell põe na raiz (`modo-op` ou `modo-pr`).
--------------------------------------------------------------------------- */

const CHAVE = 'rf-modo-painel';
const ModoCtx = createContext({ modo: 'pr', setModo: () => {} });

function lerModo() {
  try {
    return localStorage.getItem(CHAVE) === 'op' ? 'op' : 'pr';
  } catch {
    return 'pr';
  }
}

export function ModoProvider({ children }) {
  const [modo, setModoEstado] = useState(lerModo);
  const setModo = useCallback((m) => {
    setModoEstado(m);
    try {
      localStorage.setItem(CHAVE, m);
    } catch {
      /* sem persistência, o modo ainda vale para esta sessão */
    }
  }, []);
  return <ModoCtx.Provider value={{ modo, setModo }}>{children}</ModoCtx.Provider>;
}

export const useModo = () => useContext(ModoCtx);

/** O seletor Apresentação / Operação do topo. */
export function SeletorModo() {
  const { modo, setModo } = useModo();
  return (
    <div className="pn-seg" role="group" aria-label="Modo de visualização">
      <button
        type="button"
        aria-pressed={modo === 'pr'}
        title="Para investidores e júri: explica cada número"
        onClick={() => setModo('pr')}
      >
        Apresentação
      </button>
      <button
        type="button"
        aria-pressed={modo === 'op'}
        title="Para a equipe: mostra tarefas e ações"
        onClick={() => setModo('op')}
      >
        Operação
      </button>
    </div>
  );
}
