/* ---------------------------------------------------------------------------
   Confirmação e resultado.

   Duas responsabilidades, e a segunda é delicada: contar ao catador que o
   registro foi sinalizado para conferência.

   O texto foi escrito com cuidado para não acusar ninguém. O sistema comparou
   fotos e horários, achou uma coincidência, e pediu que uma pessoa olhasse.
   Isso é diferente de "você fez algo errado", e a diferença precisa aparecer na
   tela, porque quem lê está trabalhando e vai ler rápido.

   O registro é guardado de qualquer forma. Sinalização nunca impede a coleta de
   existir: ela chama alguém para conferir.
--------------------------------------------------------------------------- */
import React from 'react';
import type { ClasseMaterial, Sinalizacao } from '../../dominio/tipos.js';
import { ROTULOS_MATERIAL } from '../material.js';

interface PropsConfirmacao {
  material: ClasseMaterial;
  pesoTexto: string;
  pontoColetaId: string;
  salvando: boolean;
  aoSalvar: () => void;
  aoVoltar: () => void;
}

export function TelaConfirmacao({
  material, pesoTexto, pontoColetaId, salvando, aoSalvar, aoVoltar,
}: PropsConfirmacao) {
  return (
    <>
      <div className="campo-corpo">
        <button className="botao-voltar" onClick={aoVoltar}>← Voltar</button>
        <h2 className="campo-pergunta">Confere?</h2>

        <div className="resumo">
          <div className="resumo-linha"><span>Material</span><b>{ROTULOS_MATERIAL[material]}</b></div>
          <div className="resumo-linha"><span>Peso</span><b>{pesoTexto} kg</b></div>
          <div className="resumo-linha"><span>Ponto</span><b>{pontoColetaId}</b></div>
        </div>

        <p className="campo-dica">
          A foto fica guardada só neste celular.
        </p>
      </div>

      <div className="campo-rodape">
        <button className="botao botao-principal" disabled={salvando} onClick={aoSalvar}>
          {salvando ? 'Guardando…' : '✓ Guardar coleta'}
        </button>
      </div>
    </>
  );
}

interface PropsSucesso {
  pesoTexto: string;
  material: ClasseMaterial;
  sinalizacoes: Sinalizacao[];
  aoNovaColeta: () => void;
  aoVerFila: () => void;
}

export function TelaSucesso({
  pesoTexto, material, sinalizacoes, aoNovaColeta, aoVerFila,
}: PropsSucesso) {
  return (
    <>
      <div className="campo-corpo">
        <div className="sucesso">
          <span className="marca" aria-hidden="true">✓</span>
          <h2 className="campo-pergunta">Coleta guardada</h2>
          <p className="campo-dica">
            {pesoTexto} kg de {ROTULOS_MATERIAL[material]}. Vai subir sozinha quando pegar internet.
          </p>
        </div>

        {sinalizacoes.length > 0 && (
          <div className="aviso">
            <b>Esta coleta vai passar por conferência.</b>
            <span>
              {sinalizacoes.length === 1
                ? 'O aplicativo achou uma coincidência com outro registro:'
                : 'O aplicativo achou coincidências com outros registros:'}
            </span>
            <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
              {sinalizacoes.map(s => <li key={s.codigo}>{s.motivo}</li>)}
            </ul>
            <span>A coleta está guardada. A coordenação vai olhar e falar com você.</span>
          </div>
        )}
      </div>

      <div className="campo-rodape">
        <button className="botao botao-principal" onClick={aoNovaColeta}>+ Nova coleta</button>
        <button className="botao botao-secundario" onClick={aoVerFila}>Ver minhas coletas</button>
      </div>
    </>
  );
}
