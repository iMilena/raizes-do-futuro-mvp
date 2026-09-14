/* ---------------------------------------------------------------------------
   Tela inicial e tela da fila.

   A inicial tem UM botão grande. Não tem menu, não tem aba, não tem histórico
   na primeira dobra. Quem abre este app está com material na mão e quer
   registrar; qualquer outra coisa é obstáculo.

   O contador de pendentes aparece embaixo porque responde à única outra
   pergunta que o catador faz ao app: "o que eu registrei já foi?".
--------------------------------------------------------------------------- */
import React from 'react';
import type { SituacaoFila } from '../../dominio/tipos.js';
import { ROTULOS_MATERIAL } from '../material.js';
import type { RegistroGuardado } from '../../armazenamento/bd.js';

interface PropsInicio {
  contagem: Record<SituacaoFila, number>;
  online: boolean;
  sincronizando: boolean;
  aoRegistrar: () => void;
  aoSincronizar: () => void;
  aoVerFila: () => void;
}

export function TelaInicio({
  contagem, online, sincronizando, aoRegistrar, aoSincronizar, aoVerFila,
}: PropsInicio) {
  const pendentes = contagem.pendente + contagem.enviando;

  return (
    <>
      <div className="campo-corpo">
        <h2 className="campo-pergunta">Registrar coleta</h2>
        <p className="campo-dica">
          Funciona sem internet. O aplicativo guarda e envia sozinho depois.
        </p>

        <div className="fila-resumo">
          <div className="fila-caixa">
            <span className="numero">{pendentes}</span>
            <span className="rotulo">a enviar</span>
          </div>
          <div className="fila-caixa">
            <span className="numero">{contagem.enviado}</span>
            <span className="rotulo">enviadas</span>
          </div>
          <div className="fila-caixa">
            <span className="numero">{contagem.falhou}</span>
            <span className="rotulo">a conferir</span>
          </div>
        </div>

        <button className="botao-voltar" onClick={aoVerFila}>Ver minhas coletas →</button>
      </div>

      <div className="campo-rodape">
        <button className="botao botao-principal botao-gigante" onClick={aoRegistrar}>
          <span style={{ fontSize: '2.4rem' }} aria-hidden="true">📷</span>
          Nova coleta
        </button>
        {pendentes > 0 && (
          <button
            className="botao botao-secundario"
            disabled={!online || sincronizando}
            onClick={aoSincronizar}
          >
            {sincronizando ? 'Enviando…' : online ? `Enviar ${pendentes} agora` : 'Sem internet agora'}
          </button>
        )}
      </div>
    </>
  );
}

interface PropsFila {
  registros: RegistroGuardado[];
  situacoes: Map<string, SituacaoFila>;
  aoVoltar: () => void;
}

const TEXTO_SITUACAO: Record<SituacaoFila, string> = {
  pendente: 'a enviar',
  enviando: 'enviando',
  enviado: 'enviada ✓',
  falhou: 'a conferir',
};

export function TelaFila({ registros, situacoes, aoVoltar }: PropsFila) {
  return (
    <>
      <div className="campo-corpo">
        <button className="botao-voltar" onClick={aoVoltar}>← Voltar</button>
        <h2 className="campo-pergunta">Minhas coletas</h2>

        {registros.length === 0 && <p className="campo-dica">Nenhuma coleta registrada ainda.</p>}

        <div className="resumo">
          {registros.map(({ id, registro, timestamp }) => (
            <div className="resumo-linha" key={id}>
              <span>
                {new Date(timestamp).toLocaleString('pt-BR', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
                {' · '}
                {ROTULOS_MATERIAL[registro.conteudo.classificacao.classeFinal]}
                {registro.sinalizacoes.length > 0 && ' ⚠'}
              </span>
              <b>{registro.conteudo.pesoKg} kg</b>
              <span className="campo-dica">{TEXTO_SITUACAO[situacoes.get(id) ?? 'pendente']}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="campo-rodape">
        <button className="botao botao-principal" onClick={aoVoltar}>Voltar</button>
      </div>
    </>
  );
}
