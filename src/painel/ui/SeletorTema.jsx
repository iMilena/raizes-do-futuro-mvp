import { Icon } from './Icones';
import { useTema } from './tema';
import './seletor-tema.css';

/* ---------------------------------------------------------------------------
   Os dois botões de tema, ao lado do PT/EN.

   São botões de alternância de verdade, com `aria-pressed`, e não um interruptor
   de dois estados: o painel tem TRÊS estados (claro, escuro, e "siga o
   sistema"), e um interruptor só sabe contar até dois. Com dois botões, ninguém
   fica preso, e o par mostra qual tema está valendo mesmo quando quem decidiu
   foi o sistema operacional.

   Cada botão só tem ícone, então cada um leva o próprio `aria-label`. O ícone
   fica fora da árvore de acessibilidade, porque o nome já está no botão.
--------------------------------------------------------------------------- */
export function SeletorTema() {
  const { efetivo, escolher } = useTema();

  return (
    <div className="seletor-tema" role="group" aria-label="Tema">
      <button
        type="button"
        aria-pressed={efetivo === 'light'}
        aria-label="Tema claro"
        title="Tema claro"
        onClick={() => escolher('light')}
      >
        <Icon name="sun" className="sm" />
      </button>
      <button
        type="button"
        aria-pressed={efetivo === 'dark'}
        aria-label="Tema escuro"
        title="Tema escuro"
        onClick={() => escolher('dark')}
      >
        <Icon name="moon" className="sm" />
      </button>
    </div>
  );
}

export default SeletorTema;
