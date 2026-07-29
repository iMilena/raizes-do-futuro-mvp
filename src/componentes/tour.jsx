import React, { useEffect } from 'react';
import { useDemo } from './demo.jsx';

/* ---------------------------------------------------------------------------
   Tour de primeira visita do painel: apresenta o ciclo do projeto e o que
   cada uma das 7 abas faz. Avança no ritmo de quem está lendo (não é o modo
   demo automático) e destaca a aba descrita.
--------------------------------------------------------------------------- */

const CHAVE = 'raizes-tour-v1';

export function tourVisto() {
  try { return localStorage.getItem(CHAVE) === 'visto'; } catch (e) { return true; }
}
function marcarVisto() {
  try { localStorage.setItem(CHAVE, 'visto'); } catch (e) { /* segue sem persistir */ }
}

export const PASSOS_TOUR = [
  {
    tab: 'dashboard', icone: '🌱', titulo: 'Bem-vindo ao Raízes do Futuro', semAlvo: true,
    texto: 'Este painel demonstra o ciclo completo do piloto de Boipeba, na Bahia: o resíduo que sai da praia se transforma em renda para quem coleta e em bônus de saúde e educação para as crianças. Cada etapa fica registrada e verificável — e é isso que as 7 abas acima mostram, uma por perfil.',
  },
  {
    tab: 'dashboard', icone: '📊', titulo: 'Dashboard',
    texto: 'Os indicadores do piloto contra as metas, os quilos validados por semana e a receita por fonte. Aqui também fica o botão ▶ Ver o ciclo completo, que executa a jornada inteira sozinho, narrando cada passo — é o atalho para ver tudo funcionando sem clicar em nada.',
  },
  {
    tab: 'coleta', icone: '🧹', titulo: 'Coletor',
    texto: 'Onde o ciclo começa: quem coletou, qual material, quantos quilos e em que praia. No app real, foto e geolocalização compõem a evidência. Ponto importante do modelo: a renda desse trabalho é incondicional — ela não depende de nenhuma contrapartida da família.',
  },
  {
    tab: 'validacao', icone: '✅', titulo: 'Instituto Vivá',
    texto: 'O oráculo credenciado. Valida a coleta pela metodologia DeTrash, consolida os Relatórios de Circularidade e confere as comprovações de saúde e educação. Repare: validar uma comprovação não libera dinheiro — apenas cria uma proposta no cofre.',
  },
  {
    tab: 'mercado', icone: '🛒', titulo: 'Mercado',
    texto: 'De onde vem o dinheiro: turista comprando produto reaproveitado e empresa financiando resultado ambiental verificável. Cada venda é dividida na hora — 60% renda direta, 25% Fundo Infância, 15% operação — e você vê essa divisão acontecer na animação.',
  },
  {
    tab: 'fundo', icone: '🔗', titulo: 'Cofre Multisig',
    texto: 'O coração do modelo: um cofre 2-de-3 na Solana. Para o bônus sair, dois entre Instituto Vivá, DeTrash e Representante Comunitário precisam assinar a proposta. Nenhuma organização move esse dinheiro sozinha. Mais abaixo, o explorador mostra cada transação com sua signature e slot.',
  },
  {
    tab: 'carteira', icone: '👨‍👩‍👧', titulo: 'Família (operação)',
    texto: 'A visão do agente que acompanha a família: conectar a carteira Decaf, conferir o endereço na Solana, o extrato e o saque via Pix. Sem seed phrase de 12 palavras — só celular e um PIN de 4 números, porque essa barreira exclui exatamente quem o projeto quer alcançar.',
  },
  {
    tab: 'familia', icone: '📱', titulo: 'App da Família',
    texto: 'A mesma conta, do lado de quem recebe. Nenhuma palavra técnica aparece aqui: é "conta da família", "dinheiro" e "cofre digital". Tem onboarding guiado pelo caranguejo Tuca, saldo em reais e retirada em dois toques. Esta tela também abre sozinha, em modo celular, no endereço #/familia.',
  },
  {
    tab: 'dashboard', icone: '🎬', titulo: 'Pronto para explorar', semAlvo: true,
    texto: 'Dois atalhos para guardar: ▶ Ver o ciclo completo, no Dashboard, roda a jornada inteira narrada; e Resetar demo, no rodapé, devolve tudo ao estado inicial quantas vezes você quiser. Este tour fica sempre disponível no ❔ Como funciona, no topo da página.',
  },
];

/** Controlado por fora (o índice mora no App) para o cabeçalho poder destacar a aba do passo. */
export function TourPainel({ indice: i, setIndice: setI, setTab, aoFechar }) {
  const { rodando } = useDemo();
  const passo = PASSOS_TOUR[i];
  const ultimo = i === PASSOS_TOUR.length - 1;

  // troca para a aba que o passo descreve
  useEffect(() => {
    if (passo.tab) setTab(passo.tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // o modo demo assume o comando da tela: o tour sai da frente
  useEffect(() => { if (rodando) aoFechar(false); }, [rodando, aoFechar]);

  const avancar = () => (ultimo ? aoFechar(true) : setI(n => n + 1));
  const voltar = () => setI(n => Math.max(0, n - 1));

  useEffect(() => {
    const tecla = e => {
      if (e.key === 'Escape') aoFechar(false);
      else if (e.key === 'ArrowRight') avancar();
      else if (e.key === 'ArrowLeft') voltar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, ultimo]);

  if (rodando) return null;

  return (
    <div className="tour" role="dialog" aria-label="Tour do painel">
      <div className="tour-topo">
        <span className="tour-icone" aria-hidden="true">{passo.icone}</span>
        <b>{passo.titulo}</b>
        <span className="tour-contador">{i + 1} de {PASSOS_TOUR.length}</span>
      </div>

      <p key={i}>{passo.texto}</p>

      <div className="tour-acoes">
        <div className="tour-pontos" aria-hidden="true">
          {PASSOS_TOUR.map((_, n) => (
            <i key={n} className={n === i ? 'on' : n < i ? 'feito' : ''} onClick={() => setI(n)} />
          ))}
        </div>
        <div className="tour-botoes">
          {i > 0 && <button className="acao sec" onClick={voltar}>Voltar</button>}
          <button className="acao" onClick={avancar}>{ultimo ? 'Começar a explorar' : 'Avançar'}</button>
        </div>
      </div>

      <div className="tour-rodape">
        <button className="tour-nunca" onClick={() => aoFechar(false)}>Pular por agora</button>
        <button className="tour-nunca" onClick={() => aoFechar(true)}>Não mostrar de novo</button>
      </div>
    </div>
  );
}

/** Registra que o tour não deve mais abrir sozinho. */
export function encerrarTour(persistir) {
  if (persistir) marcarVisto();
}

/** Aba destacada pelo passo atual do tour (ou null). */
export const alvoDoPasso = i => {
  const p = PASSOS_TOUR[i];
  return p && !p.semAlvo ? p.tab : null;
};
