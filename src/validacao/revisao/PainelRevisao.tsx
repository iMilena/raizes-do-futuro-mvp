/* ---------------------------------------------------------------------------
   Painel de revisão da coordenação.

   Público diferente do app de campo: aqui é notebook, mesa, tempo para ler. Por
   isso a tela mostra NÚMERO e TEXTO, e não ícone gigante: quem revisa precisa
   dos detalhes que sustentaram a sinalização, e vai copiar esses detalhes para
   uma conversa com a coletora.

   O que esta tela deliberadamente NÃO mostra: a foto. A foto fica no aparelho de
   quem coletou, e essa decisão é do módulo inteiro, não desta tela. O que a
   coordenação recebe é a evidência (a distância entre as fotos, os minutos, os
   metros, os quilos) e o nome do que o sistema viu. Quando isso não bastar, o
   caminho é falar com a pessoa, que é o que a coordenação já faz hoje.
--------------------------------------------------------------------------- */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
/* O componente carrega o próprio estilo: ele é montado em dois lugares (a página
   revisao.html e uma aba do painel da operação), e deixar a importação a cargo de
   quem monta é garantir que um dos dois esqueça. */
import './estilos/revisao.css';
import { BancoLocal } from '../armazenamento/bd.js';
import type { RegistroGuardado } from '../armazenamento/bd.js';
import { verificarAssinatura } from '../identidade/chave-dispositivo.js';
import { salConfigurado } from '../identidade/pseudonimo.js';
import { montarLotes } from '../ancoragem/lote-diario.js';
import { AncoradoraMock } from '../ancoragem/ancoradora-mock.js';
import { decidir, ErroDecisao, montarFilaRevisao, resumoRevisao } from './decisoes.js';
import {
  limparDemonstracao, O_QUE_O_EXEMPLO_MOSTRA, semearDemonstracao, temDemonstracao,
} from './dados-de-demonstracao.js';
import type { FiltroRevisao, ItemRevisao } from './decisoes.js';
import { ROTULOS_MATERIAL } from '../campo/material.js';
import { TelaCabecalho } from '../../painel/ui/TelaCabecalho.jsx';
import type { RegistroEvidencia } from '../dominio/tipos.js';

const AUTOR_PADRAO = 'coordenacao';

function horaCurta(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export interface PropsPainelRevisao {
  /**
   * Montado dentro do painel da operação?
   *
   * O painel já escreve "Conferência" na barra de cima, e repetir um título logo
   * abaixo gasta a primeira dobra da tela com redundância. Na página própria
   * (revisao.html) não há barra nenhuma, e aí o título é necessário.
   */
  embutido?: boolean;
}

export default function PainelRevisao({ embutido = false }: PropsPainelRevisao) {
  const [banco, setBanco] = useState<BancoLocal | null>(null);
  const [guardados, setGuardados] = useState<RegistroGuardado[]>([]);
  const [filtro, setFiltro] = useState<FiltroRevisao>('pendentes');
  const [autor, setAutor] = useState(AUTOR_PADRAO);
  const [assinaturas, setAssinaturas] = useState<Map<string, boolean>>(new Map());
  const [erro, setErro] = useState<string | null>(null);
  const [mexendoNoExemplo, setMexendoNoExemplo] = useState(false);

  const ancoradora = useMemo(() => new AncoradoraMock({ rede: 'devnet (simulada)' }), []);
  const [ancoragens, setAncoragens] = useState<Map<string, string>>(new Map());

  const recarregar = useCallback(async (bancoAtual: BancoLocal) => {
    const lista = await bancoAtual.listarRegistros();
    setGuardados(lista);

    /* A assinatura é verificada aqui, na máquina de quem revisa, e não confiada
       do que veio junto: verificação que roda só onde o dado foi produzido não
       verifica nada. */
    const conferidas = new Map<string, boolean>();
    for (const item of lista) {
      conferidas.set(item.id, await verificarAssinatura(item.registro));
    }
    setAssinaturas(conferidas);
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const aberto = await BancoLocal.abrir();
      if (!vivo) return;
      setBanco(aberto);
      await recarregar(aberto);
    })();
    return () => { vivo = false; };
  }, [recarregar]);

  const registros = useMemo(() => guardados.map(g => g.registro), [guardados]);
  const fila = useMemo(() => montarFilaRevisao(registros, filtro), [registros, filtro]);
  const resumo = useMemo(() => resumoRevisao(registros), [registros]);
  const lotes = useMemo(() => montarLotes(registros), [registros]);

  const aplicarDecisao = useCallback(async (
    registro: RegistroEvidencia,
    decisao: 'aprovado' | 'rejeitado',
    justificativa: string,
  ) => {
    if (!banco) return;
    setErro(null);
    try {
      const atualizado = decidir(registro, {
        decisao, autor, justificativa,
        substituindo: registro.revisao !== null,
      });
      const anterior = guardados.find(g => g.id === registro.conteudo.id)!;
      await banco.atualizarRegistro({ ...anterior, registro: atualizado });
      await recarregar(banco);
    } catch (e) {
      setErro(e instanceof ErroDecisao ? e.message : String(e));
    }
  }, [banco, autor, guardados, recarregar]);

  /* ------------------------------------------------------- exemplo ---------
     A tela le o banco do aparelho, que numa maquina de demonstracao esta vazio.
     Sem isto, o modulo aparece como "nada esperando conferencia" justamente na
     hora de mostra-lo. O exemplo passa pelos detectores de verdade, entao o que
     aparece na tela e o que o codigo produz. */

  const temExemplo = useMemo(() => temDemonstracao(guardados), [guardados]);

  const carregarExemplo = useCallback(async () => {
    if (!banco) return;
    setMexendoNoExemplo(true);
    try {
      await semearDemonstracao(banco);
      await recarregar(banco);
    } finally {
      setMexendoNoExemplo(false);
    }
  }, [banco, recarregar]);

  const removerExemplo = useCallback(async () => {
    if (!banco) return;
    setMexendoNoExemplo(true);
    try {
      await limparDemonstracao(banco);
      await recarregar(banco);
    } finally {
      setMexendoNoExemplo(false);
    }
  }, [banco, recarregar]);

  const ancorar = useCallback(async (dataLote: string) => {
    const lote = lotes.find(l => l.dataLote === dataLote);
    if (!lote) return;
    const recibo = await ancoradora.ancorar(lote.payload);
    setAncoragens(mapa => new Map(mapa).set(dataLote, recibo.idTransacao));
  }, [lotes, ancoradora]);

  return (
    <div className="revisao">
      {/* Dentro do painel, esta e a etapa 4 da jornada, e usa o mesmo cabecalho
          das outras oito. Na pagina autonoma (revisao.html) o publico chega
          direto pelo link, sem jornada em volta, e ai vale o titulo simples. */}
      {embutido && (
        <TelaCabecalho etapa={4} total={9} area="Operação" titulo="Conferência da coleta sinalizada">
          O que a IA apontou e o que uma pessoa precisa decidir. <b>Toda sinalização vira pedido
          de conferência humana, nunca rejeição automática.</b>
        </TelaCabecalho>
      )}

      <header className="revisao-topo">
        <div>
          {!embutido && <h1>Validação de Coleta</h1>}
          {!embutido && <p>Registros que pediram conferência humana</p>}
        </div>
        <label className="revisao-autor">
          quem está revisando
          <input value={autor} onChange={e => setAutor(e.target.value)} />
        </label>
      </header>

      {!salConfigurado() && (
        <div className="revisao-alerta">
          O sal de pseudonimização está no valor de demonstração. Antes de operar com dados
          reais, defina <code>VITE_SAL_PSEUDONIMO</code>: sem isso, o pseudônimo do coletor
          pode ser revertido por quem tiver a lista de famílias.
        </div>
      )}

      {temExemplo && (
        <div className="revisao-exemplo">
          <div>
            <b>Você está vendo um exemplo.</b> Um dia de coleta em Boipeba, plantado para
            demonstração. As sinalizações abaixo não foram escritas à mão: os registros
            passaram pelos mesmos detectores que rodam no celular do catador.
            <ul>
              {O_QUE_O_EXEMPLO_MOSTRA.filter(t => !t.startsWith('coleta normal')).map(t => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            Nada disso entra na fila de sincronização, então não sobe para lugar nenhum.
          </div>
          <button className="botao-pequeno" disabled={mexendoNoExemplo} onClick={() => void removerExemplo()}>
            {mexendoNoExemplo ? 'removendo…' : 'remover exemplo'}
          </button>
        </div>
      )}

      <section className="revisao-numeros">
        {[
          ['a conferir', resumo.pendentes, resumo.graves > 0],
          ['graves', resumo.graves, resumo.graves > 0],
          ['aprovados', resumo.aprovados, false],
          ['rejeitados', resumo.rejeitados, false],
          ['coletas no total', resumo.total, false],
        ].map(([rotulo, valor, destaque]) => (
          <div className={'numero-caixa' + (destaque ? ' destaque' : '')} key={String(rotulo)}>
            <span className="numero">{String(valor)}</span>
            <span className="rotulo">{String(rotulo)}</span>
          </div>
        ))}
      </section>

      <nav className="revisao-filtros">
        {(['pendentes', 'decididos', 'todos'] as FiltroRevisao[]).map(opcao => (
          <button
            key={opcao}
            className={'filtro' + (filtro === opcao ? ' ativo' : '')}
            onClick={() => setFiltro(opcao)}
          >
            {opcao}
          </button>
        ))}
      </nav>

      {erro && <div className="revisao-alerta">{erro}</div>}

      <main className="revisao-lista">
        {fila.length === 0 && guardados.length === 0 && (
          <div className="vazio">
            <p>
              <b>Nenhuma coleta neste aparelho ainda.</b><br />
              Os registros chegam do app de campo (<code>campo.html</code>), que o catador usa
              na praia, sem internet.
            </p>
            <button className="botao-pequeno" disabled={mexendoNoExemplo} onClick={() => void carregarExemplo()}>
              {mexendoNoExemplo ? 'carregando…' : 'Carregar um dia de exemplo'}
            </button>
            <p className="campo-dica" style={{ marginTop: 10 }}>
              O exemplo fica marcado como demonstração e pode ser removido a qualquer momento.
            </p>
          </div>
        )}
        {fila.length === 0 && guardados.length > 0 && (
          <p className="vazio">
            {filtro === 'pendentes'
              ? 'Nada esperando conferência. Todas as coletas passaram nas checagens.'
              : 'Nenhum registro neste filtro.'}
          </p>
        )}
        {fila.map(item => (
          <CartaoRevisao
            key={item.registro.conteudo.id}
            item={item}
            assinaturaConfere={assinaturas.get(item.registro.conteudo.id) ?? null}
            aoDecidir={aplicarDecisao}
          />
        ))}
      </main>

      <section className="revisao-lotes">
        <h2>Lotes diários</h2>
        <p className="campo-dica">
          Só a raiz de Merkle e os totais vão para a cadeia. Nenhuma foto, nenhum nome,
          nenhuma localização exata, nenhum registro individual.
        </p>
        <div className="rolagem">
        <table>
          <thead>
            <tr>
              <th>dia</th><th>coletas</th><th>peso</th><th>a conferir</th>
              <th>raiz de Merkle</th><th></th>
            </tr>
          </thead>
          <tbody>
            {lotes.map(lote => (
              <tr key={lote.dataLote}>
                <td>{lote.dataLote}</td>
                <td>{lote.payload.quantidadeRegistros}</td>
                <td>{lote.payload.pesoTotalKg} kg</td>
                <td>{lote.payload.quantidadeSinalizados}</td>
                <td><code>{lote.payload.merkleRoot.slice(0, 18)}…</code></td>
                <td>
                  {ancoragens.has(lote.dataLote)
                    ? <span className="ancorado">ancorado {ancoragens.get(lote.dataLote)?.slice(0, 12)}…</span>
                    : <button className="botao-pequeno" onClick={() => void ancorar(lote.dataLote)}>
                        ancorar (simulado)
                      </button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  );
}

interface PropsCartao {
  item: ItemRevisao;
  assinaturaConfere: boolean | null;
  aoDecidir: (r: RegistroEvidencia, d: 'aprovado' | 'rejeitado', j: string) => void | Promise<void>;
}

function CartaoRevisao({ item, assinaturaConfere, aoDecidir }: PropsCartao) {
  const [justificativa, setJustificativa] = useState('');
  const { conteudo, sinalizacoes, revisao } = item.registro;

  return (
    <article className={'cartao' + (sinalizacoes.some(s => s.gravidade === 'alta') ? ' grave' : '')}>
      <header>
        <h3>
          {conteudo.pesoKg} kg de {ROTULOS_MATERIAL[conteudo.classificacao.classeFinal]}
        </h3>
        <span className="quando">{horaCurta(conteudo.timestampDispositivo)}</span>
      </header>

      <dl className="dados">
        <div><dt>ponto</dt><dd>{conteudo.pontoColetaId}</dd></div>
        <div><dt>área (geohash 7)</dt><dd><code>{conteudo.geohash}</code></dd></div>
        <div><dt>coletor</dt><dd><code>{conteudo.coletorPseudonimo.slice(0, 12)}…</code></dd></div>
        <div>
          <dt>classificação</dt>
          <dd>
            {conteudo.classificacao.classeSugerida} a {Math.round(conteudo.classificacao.confianca * 100)}%
            {conteudo.classificacao.corrigidoPorHumano
              && ` · corrigido para ${conteudo.classificacao.classeFinal}`}
          </dd>
        </div>
        <div><dt>foto (pHash)</dt><dd><code>{conteudo.pHash}</code></dd></div>
        <div>
          <dt>integridade</dt>
          <dd>
            {item.hashConfere ? 'hash confere' : '⚠ HASH NÃO CONFERE'}
            {' · '}
            {assinaturaConfere === null ? 'assinatura não verificada'
              : assinaturaConfere ? 'assinatura confere' : '⚠ ASSINATURA INVÁLIDA'}
          </dd>
        </div>
      </dl>

      <section className="sinais">
        {sinalizacoes.map(sinal => (
          <div key={sinal.codigo} className={'sinal ' + sinal.gravidade}>
            <b>{sinal.motivo}</b>
            {sinal.detalhes && (
              <ul>
                {Object.entries(sinal.detalhes).map(([chave, valor]) => (
                  <li key={chave}><span>{chave}</span>: {String(valor)}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      {item.relacionados.length > 0 && (
        <section className="relacionados">
          <h4>Registros comparados</h4>
          {item.relacionados.map(outro => (
            <div key={outro.conteudo.id}>
              {horaCurta(outro.conteudo.timestampDispositivo)} · {outro.conteudo.pesoKg} kg ·{' '}
              {ROTULOS_MATERIAL[outro.conteudo.classificacao.classeFinal]} ·{' '}
              <code>{outro.conteudo.pHash}</code>
            </div>
          ))}
        </section>
      )}

      {revisao && (
        <div className="decisao-anterior">
          já {revisao.decisao} por {revisao.autor} em {horaCurta(revisao.timestamp)}:{' '}
          <i>{revisao.justificativa}</i>
        </div>
      )}

      <footer>
        <textarea
          value={justificativa}
          onChange={e => setJustificativa(e.target.value)}
          placeholder="O que você verificou? (fica registrado com seu nome e vale como prestação de contas)"
          rows={2}
        />
        <div className="acoes">
          <button
            className="botao-aprovar"
            onClick={() => void aoDecidir(item.registro, 'aprovado', justificativa)}
          >
            ✓ Aprovar coleta
          </button>
          <button
            className="botao-rejeitar"
            onClick={() => void aoDecidir(item.registro, 'rejeitado', justificativa)}
          >
            ✕ Rejeitar coleta
          </button>
        </div>
      </footer>
    </article>
  );
}
