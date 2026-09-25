import React, { useEffect } from 'react';
import { useDemo } from './demo.jsx';

/* ---------------------------------------------------------------------------
   Tour de primeira visita do painel: apresenta o ciclo do projeto e o que
   cada tela do menu faz. Avança no ritmo de quem está lendo (não é o modo
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
    tab: 'dashboard', titulo: 'Bem-vindo ao Raízes do Futuro', semAlvo: true,
    texto: 'Este painel é uma demonstração, com dados de exemplo, do ciclo que o Raízes vai implantar em Boipeba, na Bahia: o resíduo que sai da praia vira renda para quem coleta e bônus de saúde e educação para as crianças. Cada etapa vai ficar registrada e verificável, e é isso que as telas do menu mostram, uma por perfil.',
  },
  {
    tab: 'dashboard', titulo: 'Visão geral',
    texto: 'O relatório do mês: de onde veio cada real e para onde foi, do quilo validado até a conta das famílias. No modo Apresentação, cada número mostra a sua fonte; no modo Operação, aparece a fila do dia. Aqui também fica o botão Ver o ciclo completo, que executa a jornada inteira sozinho, narrando cada passo.',
  },
  {
    tab: 'trilha', titulo: 'Trilha de prova',
    texto: 'Um valor pago, e todas as provas que ele atravessou: a coleta, a conferência da IA, a validação, a venda, a divisão no contrato e a liberação no cofre. É a resposta para a pergunta que todo investidor faz: como eu sei que o dinheiro chegou?',
  },
  {
    tab: 'coleta', titulo: 'Coleta',
    texto: 'Onde o ciclo começa: quem coletou, qual material, quantos quilos e em que praia. No app real, foto e geolocalização compõem a evidência. Ponto importante do modelo: a renda desse trabalho é incondicional, e não depende de nenhuma contrapartida da família.',
  },
  {
    tab: 'conferencia', titulo: 'Conferência da IA',
    texto: 'A IA sinaliza. Uma pessoa decide. Quatro detectores revisam cada coleta, e o que parece estranho vem para esta fila com o motivo explicado. Ninguém é punido automaticamente.',
  },
  {
    tab: 'validacao', titulo: 'Validação do Vivá',
    texto: 'O oráculo credenciado. Valida a coleta pela metodologia DeTrash, consolida os Relatórios de Circularidade e confere as comprovações de saúde e educação. Repare: validar uma comprovação não libera dinheiro, apenas cria uma proposta no cofre.',
  },
  {
    tab: 'mercado', titulo: 'Mercado',
    texto: 'De onde vem o dinheiro: turista comprando produto reaproveitado e empresa financiando resultado ambiental verificável. Cada venda é dividida na hora (60% renda direta, 25% Fundo Infância, 15% operação), e você vê essa divisão acontecer na animação.',
  },
  {
    tab: 'fundo', titulo: 'Cofre 2-de-3',
    texto: 'O coração do modelo: um cofre 2-de-3 na Solana. Para o bônus sair, dois entre Instituto Vivá, DeTrash e Representante Comunitário precisam assinar a proposta. Nenhuma organização move esse dinheiro sozinha. Mais abaixo, o explorador mostra cada transação com sua signature e slot.',
  },
  {
    tab: 'carteira', titulo: 'Famílias e carteiras',
    texto: 'Três visões da mesma família: o cadastro com o consentimento, a conta vista pelo agente (carteira Decaf, extrato e saque via Pix) e o App da Família, do lado de quem recebe. Sem seed phrase de 12 palavras: só celular e um PIN de 4 números.',
  },
  {
    tab: 'familia', titulo: 'App da Família',
    texto: 'A mesma conta, do lado de quem recebe. Nenhuma palavra técnica aparece aqui: é "conta da família", "dinheiro" e "cofre digital". Saldo em reais, o que falta para o bônus de cada filho e retirada em dois toques. Esta tela também abre sozinha, em modo celular, no endereço #/familia.',
  },
  {
    tab: 'dashboard', titulo: 'Pronto para explorar', semAlvo: true,
    texto: 'Dois atalhos para guardar: Ver o ciclo completo, na Visão geral, roda a jornada inteira narrada; e Resetar demo, no rodapé, devolve tudo ao estado inicial quantas vezes você quiser. Este tour fica sempre disponível no botão Como funciona, no topo da página.',
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
