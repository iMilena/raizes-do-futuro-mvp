import { Icon } from './Icones';

/* ---------------------------------------------------------------------------
   O cabeçalho que abre as nove telas, sempre na mesma ordem:

     onde estou   chip "Etapa X de 9 · Área"
     o que é isto h1, em Fraunces
     para que serve  uma frase de propósito

   Resumo antes do detalhe. Sem isso, cada tela começava direto num gráfico ou
   numa tabela, e quem chegava pelo meio não sabia em que ponto do ciclo estava.
--------------------------------------------------------------------------- */
export function TelaCabecalho({ etapa, total, area, titulo, children }) {
  return (
    <header className="pn-shead">
      <span className="pn-stepchip">
        Etapa {etapa} de {total} · {area}
      </span>
      <h1>{titulo}</h1>
      {children && <p className="pn-purpose">{children}</p>}
    </header>
  );
}

/* ---------------------------------------------------------------------------
   Os dois cartões do rodapé. A jornada é uma sequência, então sair de uma tela
   pela porta certa vale mais do que voltar ao menu e procurar. Nas pontas o
   botão fica desabilitado em vez de sumir, para a dupla não dançar de lugar.
--------------------------------------------------------------------------- */
export function NavEtapa({ anterior, proxima, aoIr }) {
  return (
    <nav className="pn-stepnav" aria-label="Navegação entre etapas">
      <button
        type="button"
        className="pn-snav prev"
        disabled={!anterior}
        onClick={() => anterior && aoIr(anterior.id)}
      >
        <span className="d">
          <Icon name="left" className="sm" />
          Etapa anterior
        </span>
        <span className="t">{anterior ? anterior.titulo : 'Início do ciclo'}</span>
      </button>
      <button
        type="button"
        className="pn-snav next"
        disabled={!proxima}
        onClick={() => proxima && aoIr(proxima.id)}
      >
        <span className="d">
          Próxima etapa
          <Icon name="right" className="sm" />
        </span>
        <span className="t">{proxima ? proxima.titulo : 'Fim do ciclo'}</span>
      </button>
    </nav>
  );
}
