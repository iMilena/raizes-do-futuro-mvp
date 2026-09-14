/* ---------------------------------------------------------------------------
   O app de campo.

   Uma linha reta: início, foto, material, peso, confere, guardado. Sem menu, sem
   aba, sem tela de configuração. Voltar existe em todo passo, porque errar o
   toque com dedo molhado é regra, não exceção.

   Este componente cuida de estado de tela e de efeitos do navegador (câmera,
   rede, GPS). A evidência em si é montada em `registro-de-campo.ts`, que não
   sabe o que é React e por isso pode ser testado de verdade.
--------------------------------------------------------------------------- */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BancoLocal } from '../armazenamento/bd.js';
import type { RegistroGuardado } from '../armazenamento/bd.js';
import { aplicarRetencao } from '../armazenamento/retencao.js';
import { IdentidadeDispositivo } from '../identidade/chave-dispositivo.js';
import { pseudonimoDe } from '../identidade/pseudonimo.js';
import { classificadorPadrao } from '../ia/classificador.js';
import type { Classificacao } from '../ia/classificador.js';
import { calcularPHash, reduzirParaCinza } from '../antifraude/phash.js';
import { estimarOcupacaoDaImagem } from '../antifraude/ocupacao.js';
import { Sincronizador } from '../sincronizacao/sincronizador.js';
import { TransporteMemoria } from '../sincronizacao/transporte-memoria.js';
import { lerPosicao, registrarColeta } from './registro-de-campo.js';
import type { ClasseMaterial, SituacaoFila, Sinalizacao } from '../dominio/tipos.js';
import TelaFoto from './telas/TelaFoto.js';
import TelaMaterial from './telas/TelaMaterial.js';
import TelaPeso, { pesoValido, textoParaPeso } from './telas/TelaPeso.js';
import { TelaConfirmacao, TelaSucesso } from './telas/TelaFim.js';
import { TelaFila, TelaInicio } from './telas/TelaInicio.js';

type Passo = 'inicio' | 'foto' | 'material' | 'peso' | 'confere' | 'pronto' | 'fila';

const PASSOS_VISIVEIS: Partial<Record<Passo, string>> = {
  foto: '1 de 3', material: '2 de 3', peso: '3 de 3',
};

/**
 * Quem está usando o aparelho.
 *
 * No piloto, um aparelho é de um coletor, e a configuração entra uma vez na
 * instalação. Tela de login em campo seria uma barreira diária para resolver um
 * problema que o piloto não tem.
 */
const COLETOR_PADRAO = import.meta.env['VITE_COLETOR_ID'] ?? 'BOI-001';
const PONTO_PADRAO = import.meta.env['VITE_PONTO_COLETA'] ?? 'ponto-cueira';

export default function AppCampo() {
  const [passo, setPasso] = useState<Passo>('inicio');
  const [banco, setBanco] = useState<BancoLocal | null>(null);
  const [identidade, setIdentidade] = useState<IdentidadeDispositivo | null>(null);
  const [pseudonimo, setPseudonimo] = useState<string>('');

  const [foto, setFoto] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [evidenciaFoto, setEvidenciaFoto] = useState<{ pHash: string; ocupacao: number | null } | null>(null);
  const [sugestao, setSugestao] = useState<Classificacao | null>(null);
  const [material, setMaterial] = useState<ClasseMaterial | null>(null);
  const [pesoTexto, setPesoTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [sinalizacoes, setSinalizacoes] = useState<Sinalizacao[]>([]);

  const [contagem, setContagem] = useState<Record<SituacaoFila, number>>({
    pendente: 0, enviando: 0, enviado: 0, falhou: 0,
  });
  const [registros, setRegistros] = useState<RegistroGuardado[]>([]);
  const [situacoes, setSituacoes] = useState<Map<string, SituacaoFila>>(new Map());
  const [online, setOnline] = useState(navigator.onLine);
  const [sincronizando, setSincronizando] = useState(false);

  const classificador = useMemo(() => classificadorPadrao(), []);
  const sincronizador = useRef<Sincronizador | null>(null);

  /* ------------------------------------------------------------ abertura --- */

  useEffect(() => {
    let vivo = true;
    (async () => {
      const aberto = await BancoLocal.abrir();
      const id = await IdentidadeDispositivo.carregar(aberto);
      const pseudo = await pseudonimoDe(COLETOR_PADRAO);
      if (!vivo) return;

      setBanco(aberto);
      setIdentidade(id);
      setPseudonimo(pseudo);

      /* Retenção das fotos, na abertura. É o único momento com garantia de
         execução no celular do catador: tarefa de fundo em PWA não tem. */
      void aplicarRetencao(aberto).then(({ apagadas }) => {
        if (apagadas > 0) console.info(`[validação] ${apagadas} foto(s) apagadas pelo prazo de retenção`);
      });
      /* O transporte em memória é o padrão do piloto: o adaptador que fala com a
         base compartilhada entra aqui, e só aqui, quando a equipe plugá-lo. */
      sincronizador.current = new Sincronizador(aberto, new TransporteMemoria());

      // O modelo carrega em segundo plano: a primeira tela não espera por ele.
      void classificador.iniciar();
    })();
    return () => { vivo = false; };
  }, [classificador]);

  const atualizarResumo = useCallback(async (bancoAtual: BancoLocal) => {
    setContagem(await bancoAtual.contarFila());
    const lista = await bancoAtual.registrosRecentes(50);
    setRegistros(lista);
    const itens = await bancoAtual.itensDaFila();
    setSituacoes(new Map(itens.map(i => [i.id, i.situacao])));
  }, []);

  useEffect(() => {
    if (banco) void atualizarResumo(banco);
  }, [banco, atualizarResumo]);

  /* --------------------------------------------------------------- rede --- */

  const sincronizar = useCallback(async () => {
    if (!banco || !sincronizador.current || sincronizando) return;
    setSincronizando(true);
    try {
      await sincronizador.current.sincronizar();
      await atualizarResumo(banco);
    } finally {
      setSincronizando(false);
    }
  }, [banco, sincronizando, atualizarResumo]);

  useEffect(() => {
    const entrou = () => { setOnline(true); void sincronizar(); };
    const saiu = () => setOnline(false);
    window.addEventListener('online', entrou);
    window.addEventListener('offline', saiu);
    return () => {
      window.removeEventListener('online', entrou);
      window.removeEventListener('offline', saiu);
    };
  }, [sincronizar]);

  /* --------------------------------------------------------------- foto --- */

  const aoEscolherFoto = useCallback(async (arquivo: File) => {
    setFoto(arquivo);
    setPrevia(anterior => {
      if (anterior) URL.revokeObjectURL(anterior);
      return URL.createObjectURL(arquivo);
    });
    setAnalisando(true);
    setSugestao(null);
    setEvidenciaFoto(null);

    const bitmap = await createImageBitmap(arquivo);
    try {
      // pHash e ocupação primeiro: são baratos e não dependem do modelo, então
      // a evidência antifraude existe mesmo se a classificação falhar.
      const pHash = calcularPHash(reduzirParaCinza(bitmap));
      const ocupacao = estimarOcupacaoDaImagem(bitmap);
      setEvidenciaFoto({ pHash, ocupacao });

      const resultado = await classificador.classificar(bitmap);
      setSugestao(resultado);
      if (resultado) setMaterial(resultado.classe);
    } finally {
      bitmap.close();
      setAnalisando(false);
    }
  }, [classificador]);

  /* ------------------------------------------------------------- guardar --- */

  const salvar = useCallback(async () => {
    if (!banco || !identidade || !foto || !evidenciaFoto || !material) return;
    setSalvando(true);
    try {
      const posicao = await lerPosicao();
      const resultado = await registrarColeta({
        foto,
        pHash: evidenciaFoto.pHash,
        ocupacaoQuadro: evidenciaFoto.ocupacao,
        classeSugerida: sugestao?.classe ?? material,
        // Sem modelo, a confiança é a da pessoa que estava lá, e isso é
        // registrado como 1 com correção humana marcada.
        confianca: sugestao?.confianca ?? 1,
        classeFinal: material,
        versaoModelo: sugestao?.versaoModelo ?? 'sem-modelo',
        pesoKg: textoParaPeso(pesoTexto),
        pontoColetaId: PONTO_PADRAO,
        coletorPseudonimo: pseudonimo,
        posicao,
      }, banco, identidade);

      setSinalizacoes(resultado.sinalizacoes);
      setPasso('pronto');
      await atualizarResumo(banco);
      if (navigator.onLine) void sincronizar();
    } finally {
      setSalvando(false);
    }
  }, [banco, identidade, foto, evidenciaFoto, material, sugestao, pesoTexto, pseudonimo,
      atualizarResumo, sincronizar]);

  const limpar = useCallback(() => {
    setFoto(null);
    setPrevia(anterior => { if (anterior) URL.revokeObjectURL(anterior); return null; });
    setEvidenciaFoto(null);
    setSugestao(null);
    setMaterial(null);
    setPesoTexto('');
    setSinalizacoes([]);
  }, []);

  /* --------------------------------------------------------------- telas --- */

  const conteudo = () => {
    switch (passo) {
      case 'foto':
        return (
          <TelaFoto
            previa={previa}
            analisando={analisando}
            aoEscolherFoto={arquivo => { void aoEscolherFoto(arquivo); }}
            aoContinuar={() => setPasso('material')}
            aoCancelar={() => { limpar(); setPasso('inicio'); }}
          />
        );

      case 'material':
        return (
          <TelaMaterial
            sugestao={sugestao
              ? { classe: sugestao.classe, confianca: sugestao.confianca, confiavel: sugestao.confiavel }
              : null}
            motivoSemModelo={classificador.motivoIndisponivel}
            escolhido={material}
            aoEscolher={setMaterial}
            aoConfirmar={() => setPasso('peso')}
            aoVoltar={() => setPasso('foto')}
          />
        );

      case 'peso':
        return (
          <TelaPeso
            material={material ?? 'outros'}
            valor={pesoTexto}
            aoDigitar={setPesoTexto}
            aoConfirmar={() => setPasso('confere')}
            aoVoltar={() => setPasso('material')}
          />
        );

      case 'confere':
        return (
          <TelaConfirmacao
            material={material ?? 'outros'}
            pesoTexto={pesoTexto}
            pontoColetaId={PONTO_PADRAO}
            salvando={salvando}
            aoSalvar={() => { void salvar(); }}
            aoVoltar={() => setPasso('peso')}
          />
        );

      case 'pronto':
        return (
          <TelaSucesso
            pesoTexto={pesoTexto}
            material={material ?? 'outros'}
            sinalizacoes={sinalizacoes}
            aoNovaColeta={() => { limpar(); setPasso('foto'); }}
            aoVerFila={() => { limpar(); setPasso('fila'); }}
          />
        );

      case 'fila':
        return <TelaFila registros={registros} situacoes={situacoes} aoVoltar={() => setPasso('inicio')} />;

      default:
        return (
          <TelaInicio
            contagem={contagem}
            online={online}
            sincronizando={sincronizando}
            aoRegistrar={() => { limpar(); setPasso('foto'); }}
            aoSincronizar={() => { void sincronizar(); }}
            aoVerFila={() => setPasso('fila')}
          />
        );
    }
  };

  const pendentes = contagem.pendente + contagem.enviando;

  return (
    <div className="campo">
      <header className="campo-topo">
        <h1>Coleta</h1>
        {PASSOS_VISIVEIS[passo] && <span className="campo-passo">{PASSOS_VISIVEIS[passo]}</span>}
        <span className="campo-estado">
          <span className={'bolinha' + (online ? '' : ' offline')} />
          {online ? (pendentes > 0 ? `${pendentes} a enviar` : 'em dia') : 'sem internet'}
        </span>
      </header>

      {banco ? conteudo() : <div className="campo-corpo"><p className="campo-dica">Abrindo…</p></div>}
    </div>
  );
}

// Peso válido é conferido na tela; reexportado aqui para o teste do fluxo.
export { pesoValido };
