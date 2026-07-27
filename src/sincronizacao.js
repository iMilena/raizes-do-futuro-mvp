/* ---------------------------------------------------------------------------
   Sincronização multi-aparelho: traduz mudança de estado local em operações
   no esquema compartilhado.

   ── PRINCÍPIO ──────────────────────────────────────────────────────────────
   O app continua LOCAL-FIRST. Ele abre e funciona sem rede, sem Supabase e sem
   nada configurado — a demo em Boipeba não pode depender de sinal. A nuvem é
   uma camada que, quando existe, faz o coletor no celular e o Instituto Vivá
   no notebook verem a mesma verdade.

   ── POR QUE DIFF E NÃO MAPA DE AÇÕES ───────────────────────────────────────
   Poderíamos mapear cada action para chamadas de nuvem. Mas o reducer cria
   transações por dentro (pushTx) e mexe em caixas como efeito, então o mapa
   teria de repetir esse conhecimento e ficaria fora de sincronia no primeiro
   caso esquecido. Comparar antes/depois não tem como "esquecer" uma action.

   E há um motivo mais forte: a nuvem guarda DINHEIRO COMO LIVRO IMUTÁVEL, não
   como total. Ela precisa do delta ("entraram 625 no fundo"), não do saldo. Um
   diff produz delta naturalmente; um mapa de actions teria de calculá-lo.

   ── LGPD ───────────────────────────────────────────────────────────────────
   `familias.resp` (o nome da pessoa) NUNCA sobe. A nuvem conhece só o `codigo`
   pseudônimo. Na volta, o nome vem do cadastro local — ver `mesclar()`.
--------------------------------------------------------------------------- */
import * as nuvem from './nuvem.js';

/* Reexportados para quem usa a sincronização não precisar importar os dois
   módulos — e, no teste, para garantir que é a MESMA instância de nuvem.js
   (bundles separados teriam cópias distintas, cada uma com sua configuração). */
export { configurar, carregar, ativo, configuradoSemSessao, contarTransacoes, auth } from './nuvem.js';

const CHAVE_FILA = 'raizes-fila-sync';

/* ------------------------------------------------------------- deltas ----- */

const porId = lista => new Map((lista || []).map(x => [x.id, x]));

/* ------------------------------------------------- pseudonimização --------- */
/**
 * Troca nome de família pelo código, em qualquer texto que vá para a nuvem.
 *
 * Existe porque as descrições das transações — que são o registro auditável —
 * mencionam a pessoa ("bônus de Maria de Lourdes"). Localmente isso é desejável:
 * é o aparelho da operação, que legitimamente conhece a família. Na base
 * compartilhada, com chave anônima e leitura pública, não pode.
 *
 * Não é busca heurística: o conjunto de nomes é conhecido, vem do estado.
 */
function fazTradutor(familias) {
  const pares = [];
  for (const f of familias || []) {
    const codigo = codigoDe(f);
    if (!f.resp) continue;
    pares.push([f.resp, codigo]);
    const primeiro = String(f.resp).split(' ')[0];
    if (primeiro && primeiro.length > 2) pares.push([primeiro, codigo]);
  }
  // nomes maiores primeiro, para "Maria de Lourdes" não virar "BOI-001 de Lourdes"
  pares.sort((a, b) => b[0].length - a[0].length);

  return texto => {
    if (typeof texto !== 'string' || !texto) return texto;
    let saida = texto;
    for (const [nome, codigo] of pares) {
      saida = saida.replace(
        new RegExp(`(^|[^\\p{L}])${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[^\\p{L}]|$)`, 'gu'),
        (_, antes) => antes + codigo);
    }
    return saida;
  };
}

const codigoDe = f => f.codigo || `BOI-${String(f.id).padStart(3, '0')}`;

/**
 * A família tem consentimento ativo para os dados dela irem à nuvem?
 *
 * O banco já recusa (policies `fam_criar`, `cond_escrever`, `ext_inserir`), mas
 * a fila é FIFO e para no primeiro erro: uma família sem consentimento travaria
 * todo o resto do trabalho atrás dela. Então o filtro também vive aqui, e o
 * banco continua sendo a garantia — não a única checagem.
 */
export const temConsentimentoAtivo = f =>
  (f?.consentimentos || []).some(c => !c.revogadoEm);
const CAIXAS = [
  ['renda', 'renda'],
  ['fundo', 'fundo'],
  ['operacao', 'operacao'],
  ['fundoLiberado', 'fundo_liberado'],
];

/**
 * Operações necessárias para a nuvem refletir a passagem de `antes` para `depois`.
 * Cada operação é `{ tipo, ...dados }` — serializável, para caber na fila.
 */
export function calcularDeltas(antes, depois) {
  const ops = [];
  if (!depois) return ops;
  const a = antes || { coletas: [], relatorios: [], vendas: [], familias: [], propostas: [], transacoes: [], caixas: {} };

  const semNome = fazTradutor(depois.familias);

  /* transações novas primeiro: movimentos e extrato referenciam elas.
     A descrição vai pseudonimizada — ver fazTradutor(). */
  const novasTx = depois.transacoes.slice((a.transacoes || []).length);
  for (const t of novasTx) ops.push({ tipo: 'transacao', tx: { ...t, desc: semNome(t.desc) } });
  // âncora é a signature (chave natural), não o seq — ver migracao-01
  const ancora = novasTx.length ? novasTx[novasTx.length - 1].signature : null;

  /* consentimentos novos e revogações — SEMPRE antes das famílias */
  const consAntes = porId((a.familias || []).flatMap(f => f.consentimentos || []));
  for (const f of depois.familias) {
    for (const c of f.consentimentos || []) {
      const ant = consAntes.get(c.id);
      if (!ant) ops.push({ tipo: 'consentimento', consentimento: { ...c, familiaId: f.id } });
      else if (!ant.revogadoEm && c.revogadoEm) {
        ops.push({ tipo: 'consentimento-revoga', id: c.id, motivo: c.revogadoMotivo });
      }
    }
  }

  /* famílias: só o que não é dado pessoal.
     Família SEM consentimento ativo não sobe — a policy recusaria e a fila
     entupiria. Barrar aqui deixa o motivo explícito em vez de virar 403. */
  const famAntes = porId(a.familias);
  for (const f of depois.familias) {
    if (!temConsentimentoAtivo(f)) continue;
    const ant = famAntes.get(f.id);
    if (!ant) {
      ops.push({ tipo: 'familia', familia: recorteFamilia(f) });
    } else if (JSON.stringify(ant.carteira) !== JSON.stringify(f.carteira)) {
      ops.push({ tipo: 'familia', familia: recorteFamilia(f) });
    }
  }

  /* condições */
  const condAntes = porId((a.familias || []).flatMap(f => f.condicoes.map(c => ({ ...c, familiaId: f.id }))));
  for (const f of depois.familias) {
    if (!temConsentimentoAtivo(f)) continue;
    for (const c of f.condicoes) {
      const ant = condAntes.get(c.id);
      if (!ant || ant.status !== c.status || ant.evidHash !== c.evidHash) {
        ops.push({ tipo: 'condicao', familiaId: f.id, condicao: c });
      }
    }
  }

  /* coletas, relatórios, vendas */
  const colAntes = porId(a.coletas);
  for (const c of depois.coletas) {
    const ant = colAntes.get(c.id);
    if (!ant || ant.status !== c.status || ant.signature !== c.signature) ops.push({ tipo: 'coleta', coleta: c });
  }
  const relAntes = porId(a.relatorios);
  for (const r of depois.relatorios) {
    const ant = relAntes.get(r.id);
    if (!ant || JSON.stringify(ant.ancoragem) !== JSON.stringify(r.ancoragem)) ops.push({ tipo: 'relatorio', relatorio: r });
  }
  const vendAntes = porId(a.vendas);
  for (const v of depois.vendas) if (!vendAntes.has(v.id)) ops.push({ tipo: 'venda', venda: v });

  /* propostas e assinaturas (assinatura é linha, não contador) */
  const propAntes = porId(a.propostas);
  for (const p of depois.propostas) {
    const ant = propAntes.get(p.id);
    if (!ant) ops.push({ tipo: 'proposta', proposta: p });
    else if (ant.status !== p.status || ant.signature !== p.signature) {
      ops.push({ tipo: 'proposta-atualiza', id: p.id, status: p.status, signature: p.signature ?? null });
    }
    const jaTinha = new Set(ant?.assinaturas || []);
    for (const s of p.assinaturas || []) {
      if (!jaTinha.has(s)) ops.push({ tipo: 'assinatura', propostaId: p.id, signatario: s });
    }
  }

  /* dinheiro: delta, nunca total — a nuvem soma o livro */
  for (const [local, remoto] of CAIXAS) {
    const delta = Number(depois.caixas[local] || 0) - Number(a.caixas?.[local] || 0);
    if (Math.abs(delta) > 0.0001 && ancora != null) {
      ops.push({ tipo: 'movimento', caixa: remoto, valor: Number(delta.toFixed(2)), motivo: semNome(motivoDe(novasTx)), transacaoSig: ancora });
    }
  }

  /* extrato da família: idem, linha por linha nova */
  for (const f of depois.familias) {
    if (!temConsentimentoAtivo(f)) continue;
    const ant = famAntes.get(f.id);
    const novas = (f.extrato || []).slice((ant?.extrato || []).length);
    for (const e of novas) {
      if (ancora == null) continue;
      ops.push({ tipo: 'extrato', familiaId: f.id, descricao: semNome(e.desc), valor: e.valor, transacaoSig: ancora });
    }
  }

  return ops;
}

/** O que de uma família pode subir: nada que identifique a pessoa. */
function recorteFamilia(f) {
  return {
    id: f.id,
    codigo: codigoDe(f),
    criancas: f.criancas,
    carteira: f.carteira || null,
  };
}

const motivoDe = txs => (txs.length ? `${txs[txs.length - 1].tipo}: ${txs[txs.length - 1].desc}`.slice(0, 200) : 'ajuste');

/* -------------------------------------------------------------- envio ----- */

/** Executa uma operação. Lança em falha, para a fila poder reter. */
async function executar(op) {
  switch (op.tipo) {
    case 'transacao': return nuvem.registrarTransacao(op.tx);
    /* consentimento vem antes da família de propósito: a policy `fam_criar`
       recusa família sem consentimento ativo. A ordem FIFO da fila garante. */
    case 'consentimento': return nuvem.registrarConsentimento(op.consentimento);
    case 'consentimento-revoga': return nuvem.revogarConsentimento(op.id, op.motivo);
    case 'familia': return nuvem.registrarFamilia(op.familia);
    case 'condicao': return nuvem.registrarCondicao(op.familiaId, op.condicao);
    case 'coleta': return nuvem.registrarColeta(op.coleta);
    case 'relatorio': return nuvem.registrarRelatorio(op.relatorio);
    case 'venda': return nuvem.registrarVenda(op.venda);
    case 'proposta': return nuvem.registrarProposta(op.proposta);
    case 'proposta-atualiza': return nuvem.atualizarProposta(op.id, { status: op.status, signature: op.signature });
    case 'assinatura': return nuvem.registrarAssinatura(op.propostaId, op.signatario);
    case 'movimento': return nuvem.registrarMovimento(op.caixa, op.valor, op.motivo, op.transacaoSig);
    case 'extrato': return nuvem.registrarExtrato(op.familiaId, op.descricao, op.valor, op.transacaoSig);
    default: return null;
  }
}

/* ---------------------------------------------------------------- fila ---- */
/* Persistida: se o aparelho fechar offline, o trabalho não se perde. A ordem
   importa (transação antes do movimento que a referencia), então é FIFO e para
   no primeiro erro em vez de pular adiante. */

/* Sem localStorage (Node, nos testes) a fila vive em memória: o comportamento
   testado é o mesmo, só não sobrevive ao fim do processo. */
const memoria = new Map();
const armazem = () => (typeof localStorage !== 'undefined' ? localStorage : {
  getItem: k => memoria.get(k) ?? null,
  setItem: (k, v) => memoria.set(k, v),
});

const lerFila = () => {
  try { return JSON.parse(armazem().getItem(CHAVE_FILA)) || []; } catch { return []; }
};
const gravarFila = f => {
  try { armazem().setItem(CHAVE_FILA, JSON.stringify(f.slice(-500))); } catch { /* cota cheia */ }
};

export const tamanhoFila = () => lerFila().length;

export function enfileirar(ops) {
  if (!ops.length) return;
  gravarFila([...lerFila(), ...ops]);
}

/**
 * Tenta esvaziar a fila. Para no primeiro erro e mantém o resto para depois.
 * @returns {{enviadas:number, restantes:number, erro:string|null}}
 */
export async function escoarFila() {
  if (!nuvem.ativo()) return { enviadas: 0, restantes: lerFila().length, erro: 'sem-configuracao' };

  let fila = lerFila();
  let enviadas = 0;
  let erro = null;

  while (fila.length) {
    try {
      await executar(fila[0]);
      fila = fila.slice(1);
      enviadas++;
      gravarFila(fila);
    } catch (e) {
      erro = String(e.message || e).slice(0, 160);
      break;
    }
  }
  return { enviadas, restantes: fila.length, erro };
}

/* -------------------------------------------------------------- merge ----- */

/**
 * Junta o estado remoto ao local. Regra: entidade e dinheiro vêm da nuvem;
 * NOME DA FAMÍLIA vem do cadastro local, porque nome não sobe (LGPD).
 */
export function mesclar(local, remoto) {
  if (!remoto) return local;
  const nomes = new Map((local?.familias || []).map(f => [f.id, f.resp]));

  return {
    ...local,
    ...remoto,
    /* slot segue o maior dos dois: é contador monotônico.
       `nextId` não aparece aqui de propósito — ids agora nascem de novoId()
       (relógio + aleatório), justamente para não depender de contador local
       compartilhado entre aparelhos. Ver store.jsx. */
    slot: Math.max(local?.slot || 0, remoto.transacoes?.length ? remoto.transacoes[remoto.transacoes.length - 1].slot : 0),
    cofre: local?.cofre || remoto.cofre,
    familias: (remoto.familias || []).map(f => ({
      ...f,
      resp: nomes.get(f.id) || f.codigo || `Família ${f.id}`,
    })),
  };
}

/**
 * Impressão digital do estado: só as contagens que mudam quando alguém trabalha.
 *
 * Existe porque a primeira versão comparava só o número de transações — e
 * `NOVA_COLETA` **não gera transação** (ela só nasce na validação). Resultado: a
 * coleta que o coletor registrava no celular nunca chegava ao notebook do
 * Instituto Vivá, que é justamente o caso que a sincronização precisa cobrir.
 * Encontrado pelo teste de dois aparelhos.
 */
export const impressao = e => !e ? '' : [
  e.transacoes?.length || 0,
  e.coletas?.length || 0,
  e.relatorios?.length || 0,
  e.vendas?.length || 0,
  e.propostas?.length || 0,
  (e.propostas || []).reduce((a, p) => a + (p.assinaturas?.length || 0), 0),
  (e.familias || []).reduce((a, f) => a + (f.condicoes?.length || 0) + (f.extrato?.length || 0), 0),
  (e.familias || []).filter(f => f.carteira).length,
  Math.round(Number(e.caixas?.fundo || 0) * 100),
].join('.');

/**
 * Vale trazer o estado remoto? Só quando ele DIFERE do local — em qualquer
 * direção. Quem chama já garantiu que a fila está vazia, senão isto descartaria
 * trabalho ainda não enviado.
 */
export const nuvemDifere = (local, remoto) =>
  Boolean(remoto) && impressao(remoto) !== impressao(local);
