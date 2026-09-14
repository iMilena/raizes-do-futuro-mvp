/* ---------------------------------------------------------------------------
   Tela do material: o app sugere, a pessoa decide.

   O desenho desta tela é a tese do módulo em forma de interface. O modelo não
   escolhe o material: ele adianta um palpite, mostra o quanto confia nele, e
   quem estava lá confirma ou corrige com um toque.

   Duas consequências práticas:

   · quando o modelo tem pouca certeza, a interface muda de tom (o aviso fica
     laranja e o texto diz "não tenho certeza") em vez de continuar exibindo uma
     sugestão com cara de resposta certa
   · a correção é registrada, e vira dado de retreino. O catador que corrige o
     app está ensinando o modelo do próximo mês, e essa é a única fonte de dado
     de Boipeba que vai existir
--------------------------------------------------------------------------- */
import React from 'react';
import type { ClasseMaterial } from '../../dominio/tipos.js';
import { MATERIAIS, ROTULOS_MATERIAL, ICONES_MATERIAL } from '../material.js';

interface Props {
  /** Sugestão do modelo, ou null quando ele não está disponível. */
  sugestao: { classe: ClasseMaterial; confianca: number; confiavel: boolean } | null;
  motivoSemModelo: string | null;
  escolhido: ClasseMaterial | null;
  aoEscolher: (classe: ClasseMaterial) => void;
  aoConfirmar: () => void;
  aoVoltar: () => void;
}

export default function TelaMaterial({
  sugestao, motivoSemModelo, escolhido, aoEscolher, aoConfirmar, aoVoltar,
}: Props) {
  const corrigiu = sugestao !== null && escolhido !== null && escolhido !== sugestao.classe;

  return (
    <>
      <div className="campo-corpo">
        <button className="botao-voltar" onClick={aoVoltar}>← Voltar</button>
        <h2 className="campo-pergunta">Qual o material?</h2>

        {sugestao && (
          <div className={'sugestao' + (sugestao.confiavel ? '' : ' duvida')}>
            <span className="icone" style={{ fontSize: '2rem' }}>
              {ICONES_MATERIAL[sugestao.classe]}
            </span>
            <span>
              {sugestao.confiavel
                ? <>Parece <b>{ROTULOS_MATERIAL[sugestao.classe]}</b></>
                : <>Não tenho certeza. Pode ser <b>{ROTULOS_MATERIAL[sugestao.classe]}</b></>}
            </span>
            <span className="confianca">{Math.round(sugestao.confianca * 100)}%</span>
          </div>
        )}

        {!sugestao && (
          <p className="campo-dica">
            {motivoSemModelo
              ? 'O reconhecimento automático não está disponível agora. Escolha o material na mão.'
              : 'Olhando a foto…'}
          </p>
        )}

        <div className="material-lista">
          {MATERIAIS.map(({ classe, rotulo, icone }) => (
            <button
              key={classe}
              className="material-item"
              aria-pressed={escolhido === classe}
              onClick={() => aoEscolher(classe)}
            >
              <span className="icone">{icone}</span>
              {rotulo}
            </button>
          ))}
        </div>

        {corrigiu && (
          <p className="campo-dica">
            Obrigado por corrigir. Isso ensina o aplicativo a acertar da próxima vez.
          </p>
        )}
      </div>

      <div className="campo-rodape">
        <button className="botao botao-principal" disabled={!escolhido} onClick={aoConfirmar}>
          {escolhido ? `Continuar com ${ROTULOS_MATERIAL[escolhido]}` : 'Escolha o material'}
        </button>
      </div>
    </>
  );
}
