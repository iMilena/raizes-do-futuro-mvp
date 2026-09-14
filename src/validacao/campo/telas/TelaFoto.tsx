/* ---------------------------------------------------------------------------
   Tela da foto.

   Usa `<input type="file" capture="environment">` em vez de `getUserMedia` com
   prévia dentro do app. A prévia própria é mais bonita e permite enquadramento
   guiado, mas depende de permissão de câmera concedida à página, de HTTPS, e
   quebra em navegador embutido (o WhatsApp abre links num navegador interno onde
   getUserMedia falha calado). O `capture` abre a câmera nativa, que a pessoa já
   sabe usar, e devolve o arquivo.

   A foto não vai para lugar nenhum: fica no IndexedDB do aparelho. O que viaja é
   o pHash dela, 64 bits que não reconstroem imagem nenhuma.
--------------------------------------------------------------------------- */
import React, { useRef } from 'react';

interface Props {
  previa: string | null;
  analisando: boolean;
  aoEscolherFoto: (arquivo: File) => void;
  aoContinuar: () => void;
  aoCancelar: () => void;
}

export default function TelaFoto({ previa, analisando, aoEscolherFoto, aoContinuar, aoCancelar }: Props) {
  const entrada = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="campo-corpo">
        <button className="botao-voltar" onClick={aoCancelar}>← Cancelar</button>
        <h2 className="campo-pergunta">Fotografe o material</h2>
        <p className="campo-dica">Enquadre a pilha inteira, de perto.</p>

        {previa
          ? <img className="foto-previa" src={previa} alt="foto da coleta" />
          : <div className="foto-vazia" aria-hidden="true">📷</div>}

        <input
          ref={entrada}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={e => {
            const arquivo = e.target.files?.[0];
            if (arquivo) aoEscolherFoto(arquivo);
            // Limpa para a mesma foto poder ser escolhida de novo se a pessoa refizer.
            e.target.value = '';
          }}
        />
      </div>

      <div className="campo-rodape">
        <button className="botao botao-secundario" onClick={() => entrada.current?.click()}>
          {previa ? 'Tirar outra foto' : '📷 Abrir a câmera'}
        </button>
        <button
          className="botao botao-principal"
          disabled={!previa || analisando}
          onClick={aoContinuar}
        >
          {analisando ? 'Olhando a foto…' : 'Continuar'}
        </button>
      </div>
    </>
  );
}
