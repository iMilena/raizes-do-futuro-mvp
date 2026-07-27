import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useStore, fmt, BONUS_POR_CRIANCA, PROVIDER_CARTEIRA, REDE } from '../estado/store.jsx';
import { useToast, BarraProgresso } from './ui.jsx';

/* ---------------------------------------------------------------------------
   Modo demo guiado: executa o ciclo completo do projeto em passos automáticos,
   trocando de aba e destacando o elemento ativo. Usado para o vídeo pitch.
--------------------------------------------------------------------------- */

const FAMILIA_DEMO = 1;   // Maria de Lourdes (2 crianças)
const CONDICAO_DEMO = 5;  // Consulta pediátrica em dia

/** Passos da jornada. `acao` recebe { dispatch, state, toast }. */
const PASSOS = [
  {
    rot: 'Ponto de partida',
    narracao: 'Boipeba, Bahia. O lixo chega na praia todos os dias — e 1 em cada 3 crianças da ilha vive em família sem renda fixa. Vamos seguir o caminho de um único quilo de vidro.',
    tab: 'dashboard', foco: 'fluxo', dur: 4200,
    acao: ({ dispatch }) => dispatch({ type: 'RESET' }),
  },
  {
    rot: 'Coleta',
    narracao: 'Dona Nilza registra 52 kg de vidro recolhidos na Praia de Cueira. No app real, foto e geolocalização compõem a evidência.',
    tab: 'coleta', foco: 'coleta-form', dur: 3400,
    acao: ({ dispatch, toast }) => {
      dispatch({ type: 'NOVA_COLETA', payload: { coletor: 'Dona Nilza', material: 'Vidro', kg: 52, local: 'Praia de Cueira', data: new Date().toISOString().slice(0, 10) } });
      toast('Coleta de 52 kg enviada ✔');
    },
  },
  {
    rot: 'Verificação',
    narracao: 'A DeTrash confere a coleta pela metodologia dela. A validação vira uma transação na ' + REDE + ' — ninguém pode reescrever esse registro depois.',
    tab: 'validacao', foco: 'validar-coletas', dur: 3600,
    acao: ({ dispatch, state, toast }) => {
      const c = [...state.coletas].reverse().find(c => c.status === 'pendente');
      if (c) { dispatch({ type: 'VALIDAR_COLETA', id: c.id }); toast(`Coleta de ${c.kg} kg validada pela DeTrash ✔`); }
    },
  },
  {
    rot: 'Relatório de Circularidade',
    narracao: 'As coletas validadas são consolidadas num Relatório de Circularidade: o produto que a empresa compra. Impacto ambiental auditável, não promessa.',
    tab: 'validacao', foco: 'relatorio', dur: 3600,
    acao: ({ dispatch, toast }) => {
      dispatch({ type: 'EMITIR_RELATORIO', periodo: 'Julho 2026 — quinzena 2' });
      toast('Relatório de Circularidade emitido 📄');
    },
  },
  {
    rot: 'Receita',
    narracao: 'A Costa Verde Ltda. patrocina o relatório por R$ 2.500. É dinheiro real entrando no ciclo, vindo de quem precisa comprovar meta ESG.',
    tab: 'mercado', foco: 'split', dur: 3200,
    acao: ({ dispatch, toast }) => {
      dispatch({ type: 'NOVA_VENDA', payload: { tipo: 'esg', descricao: 'Relatório de Circularidade — Julho Q2', comprador: 'Costa Verde Ltda.', valor: 2500 } });
      toast('Venda de R$ 2.500,00 registrada 🛒');
    },
  },
  {
    rot: 'Divisão automática 60/25/15',
    narracao: 'O contrato divide na hora: 60% renda direta de quem trabalhou (incondicional), 25% para o Fundo Infância, 15% operação. Ninguém decide isso manualmente.',
    tab: 'mercado', foco: 'split', dur: 4200,
  },
  {
    rot: 'Comprovação da família',
    narracao: 'No celular, a família de Maria de Lourdes envia a foto da consulta pediátrica das duas crianças. A foto não sai do aparelho: o app calcula o hash dela e só esse código vai ao registro.',
    tab: 'familia', foco: 'compromissos', dur: 3800,
    acao: ({ dispatch, toast }) => {
      dispatch({ type: 'ENVIAR_COMPROVACAO', familiaId: FAMILIA_DEMO, condicaoId: CONDICAO_DEMO });
      toast('Foto do comprovante enviada 📎');
    },
  },
  {
    rot: 'Validação social',
    narracao: 'O Instituto Vivá confere a comprovação com dupla checagem. Só o hash do documento vai à rede — nenhum dado da criança.',
    tab: 'validacao', foco: 'comprovacoes', dur: 3800,
    acao: ({ dispatch, toast }) => {
      dispatch({ type: 'VALIDAR_CONDICAO', familiaId: FAMILIA_DEMO, condicaoId: CONDICAO_DEMO });
      toast('Comprovação validada → proposta criada no cofre 🗳️', 'info');
    },
  },
  {
    rot: 'Multisig 1 de 2',
    narracao: 'O dinheiro não sai por decisão de uma pessoa. O cofre é 2-de-3: Instituto Vivá assina primeiro.',
    tab: 'fundo', foco: 'propostas', dur: 3600,
    acao: ({ dispatch, state, toast }) => {
      const p = state.propostas.find(p => p.status === 'aguardando' && p.familiaId === FAMILIA_DEMO && p.condicaoId === CONDICAO_DEMO);
      if (p) { dispatch({ type: 'ASSINAR_PROPOSTA', propostaId: p.id, signatario: 'viva' }); toast('Instituto Vivá assinou (1/2) ✍️', 'info'); }
    },
  },
  {
    rot: 'Multisig 2 de 2 — executa',
    narracao: 'A DeTrash assina em seguida. Limiar atingido: o cofre executa sozinho e transfere o bônus. Nem o Instituto sozinho consegue desviar esse valor.',
    tab: 'fundo', foco: 'propostas', dur: 4200,
    acao: ({ dispatch, state, toast }) => {
      const p = state.propostas.find(p => p.status === 'aguardando' && p.familiaId === FAMILIA_DEMO && p.condicaoId === CONDICAO_DEMO);
      if (p) {
        dispatch({ type: 'ASSINAR_PROPOSTA', propostaId: p.id, signatario: 'detrash' });
        toast(`Bônus de ${fmt(p.valor)} liberado 🎉`);
      }
    },
  },
  {
    rot: `Bônus na conta ${PROVIDER_CARTEIRA}`,
    narracao: `Na tela da família não aparece nenhuma palavra difícil: o saldo simplesmente subiu R$ ${BONUS_POR_CRIANCA * 2},00. Sem seed phrase, sem taxa de gás, sem jargão.`,
    tab: 'familia', foco: 'saldo', dur: 4200,
  },
  {
    rot: 'Retirada pelo Pix',
    narracao: 'Dois toques e o dinheiro sai pelo Pix, em reais, na conta da família. Da praia de Cueira ao prato da criança — tudo rastreável, nada exposto.',
    tab: 'familia', foco: 'saque', dur: 4000,
    acao: ({ dispatch, state, toast }) => {
      const f = state.familias.find(f => f.id === FAMILIA_DEMO);
      if (f && f.saldo > 0) { dispatch({ type: 'SACAR_PIX', id: f.id, valor: f.saldo }); toast('Pix enviado 💸'); }
    },
  },
  {
    rot: 'Ciclo completo',
    narracao: 'Resíduo → renda → proteção da infância, com cada etapa verificável e a família no controle. É isso que o Raízes do Futuro entrega.',
    tab: 'dashboard', foco: 'graficos', dur: 5000,
  },
];

const DemoCtx = createContext({ rodando: false, foco: null, iniciar: () => {}, parar: () => {} });

export function DemoProvider({ setTab, children }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [rodando, setRodando] = useState(false);
  const [indice, setIndice] = useState(0);
  const [foco, setFoco] = useState(null);

  // o passo lê o estado no momento em que executa (não o do render que o agendou)
  const stateRef = useRef(state);
  stateRef.current = state;

  const iniciar = () => { setIndice(0); setRodando(true); };
  const parar = () => { setRodando(false); setFoco(null); };

  useEffect(() => {
    if (!rodando) return;
    if (indice >= PASSOS.length) { setRodando(false); setFoco(null); return; }

    const p = PASSOS[indice];
    if (p.tab) setTab(p.tab);
    setFoco(p.foco || null);

    const tAcao = setTimeout(() => {
      if (p.acao) p.acao({ dispatch, state: stateRef.current, toast });
    }, 500);
    const tProx = setTimeout(() => setIndice(i => i + 1), p.dur || 3200);

    return () => { clearTimeout(tAcao); clearTimeout(tProx); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodando, indice]);

  const valor = {
    rodando, indice, foco, iniciar, parar,
    total: PASSOS.length,
    passo: rodando ? PASSOS[Math.min(indice, PASSOS.length - 1)] : null,
    familiaDemo: FAMILIA_DEMO,
  };

  return <DemoCtx.Provider value={valor}>{children}</DemoCtx.Provider>;
}

export const useDemo = () => useContext(DemoCtx);

/** Classe de destaque para o elemento que o passo atual está apontando. */
export function useDestaque(chave) {
  const { foco, rodando } = useDemo();
  return rodando && foco === chave ? ' demo-foco' : '';
}

/** Card fixo que narra o passo atual — visível em qualquer aba. */
export function DemoNarrador() {
  const { rodando, indice, total, passo, parar } = useDemo();
  if (!rodando || !passo) return null;

  return (
    <div className="demo-narrador" role="status" aria-live="polite">
      <div className="demo-narrador-topo">
        <span className="demo-chip">▶ Passo {Math.min(indice + 1, total)} de {total}</span>
        <b>{passo.rot}</b>
        <button className="acao sec demo-parar" onClick={parar}>■ Parar</button>
      </div>
      <p key={indice}>{passo.narracao}</p>
      <BarraProgresso pct={(indice + 1) / total * 100} />
    </div>
  );
}
