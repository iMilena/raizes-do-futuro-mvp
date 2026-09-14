import { useState } from 'react';
import { Revelar } from './Revelar';
import { Chave } from '../icons/Icons';
import { cofre } from '../data/content';

/** Estado inicial de um grupo de botões de alternância, a partir dos dados. */
const ligados = (itens, chaveInicial) =>
  Object.fromEntries(itens.map((i) => [i.id, chaveInicial ? Boolean(i[chaveInicial]) : true]));

/**
 * Traduz o estado dos botões na frase que o contrato diria.
 *
 * A ordem das perguntas é a ordem em que o contrato falha: sem duas assinaturas
 * nada acontece, e só depois disso é que a comprovação dos compromissos importa.
 * Inverter isso faria a tela dizer "reservado" quando na verdade nem havia quem
 * assinasse.
 */
function leitura(assinaturas, comprovados) {
  const total = cofre.signatarios.length;
  const exigidos = cofre.compromissos.length;

  if (assinaturas < 2) {
    return {
      estado: 'retido',
      titulo: 'Aguardando assinaturas',
      corpo: `${assinaturas} de ${total} assinaturas. O contrato exige 2 para liberar qualquer valor.`,
    };
  }
  if (comprovados < exigidos) {
    const faltam = exigidos - comprovados;
    return {
      estado: 'retido',
      titulo: 'Reservado, não perdido',
      corpo: `Falta comprovar ${faltam} ${faltam === 1 ? 'compromisso' : 'compromissos'}. O valor fica guardado para o próximo mês.`,
    };
  }
  return {
    estado: 'liberado',
    titulo: 'Liberado por criança/mês',
    corpo: `${assinaturas} de ${total} assinaturas reunidas e compromissos comprovados.`,
  };
}

/**
 * O cofre 2-de-3, para mexer.
 *
 * Ler que "a liberação exige duas de três assinaturas" convence pouco; desligar
 * uma assinatura e ver o valor parar convence na hora. Os dois grupos são
 * botões de alternância de verdade (`aria-pressed`), então funcionam no teclado
 * e são anunciados como o que são.
 */
export function Cofre() {
  const [compromissos, setCompromissos] = useState(() => ligados(cofre.compromissos));
  const [assinaturas, setAssinaturas] = useState(() => ligados(cofre.signatarios, 'inicial'));

  const nAssinaturas = Object.values(assinaturas).filter(Boolean).length;
  const nComprovados = Object.values(compromissos).filter(Boolean).length;
  const { estado, titulo, corpo } = leitura(nAssinaturas, nComprovados);

  const alternar = (definir) => (id) => definir((atual) => ({ ...atual, [id]: !atual[id] }));

  return (
    <Revelar className="rf-cofre" atraso={120}>
      <div>
        <span className="rf-eyebrow rf-cofre-eyebrow">{cofre.eyebrow}</span>
        <h3>{cofre.titulo}</h3>
        <p>
          Um Smart Contract libera <b>R$ {cofre.bonus} por criança/mês</b> quando vacinação,
          matrícula e frequência escolar são comprovadas. A liberação exige{' '}
          <b>2 de {cofre.signatarios.length} assinaturas</b>. Desligue um compromisso ou tire uma
          assinatura e veja o que acontece.
        </p>

        <div className="rf-compromissos" role="group" aria-label="Compromissos comprovados">
          {cofre.compromissos.map((c) => (
            <button
              type="button"
              key={c.id}
              className="rf-alternar"
              aria-pressed={compromissos[c.id]}
              onClick={() => alternar(setCompromissos)(c.id)}
            >
              <i aria-hidden="true" />
              {c.rotulo}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="rf-signatarios" role="group" aria-label="Assinaturas do cofre multisig">
          {cofre.signatarios.map((s) => (
            <button
              type="button"
              key={s.id}
              className="rf-signatario"
              aria-pressed={assinaturas[s.id]}
              onClick={() => alternar(setAssinaturas)(s.id)}
            >
              <span className="rf-signatario-chave" aria-hidden="true">
                <Chave />
              </span>
              <span className="rf-signatario-quem">
                <span className="rf-signatario-nome">{s.nome}</span>
                <span className="rf-signatario-papel">{s.papel}</span>
              </span>
              <span className="rf-signatario-estado">
                {assinaturas[s.id] ? 'Assinado' : 'Pendente'}
              </span>
            </button>
          ))}
        </div>

        <div className={`rf-leitura is-${estado}`} aria-live="polite">
          <div className="rf-leitura-valor rf-mono">R$ {cofre.bonus}</div>
          <div className="rf-leitura-txt">
            <b>{titulo}</b>
            <span>{corpo}</span>
          </div>
        </div>
      </div>
    </Revelar>
  );
}

export default Cofre;
