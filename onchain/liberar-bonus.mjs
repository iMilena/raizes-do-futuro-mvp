/* ---------------------------------------------------------------------------
   LIBERAR BÔNUS NO COFRE 2-DE-3, DE VERDADE, NA SOLANA DEVNET

   POR QUE ISTO É UM SCRIPT E NÃO UM BOTÃO NO APP
   Assinar na Solana exige chave privada. Chave de signatário do cofre não pode
   estar num bundle de navegador — qualquer visitante do site a extrai — nem
   numa função de servidor que o app chame, porque aí o SERVIDOR passa a ser o
   signatário e o 2-de-3 deixa de existir. Então quem assina é a pessoa da
   organização, no computador dela, com a chave dela. O app mostra o comando,
   recebe a assinatura de volta e guarda o comprovante.

   POR QUE EM DUAS ETAPAS
   O multisig nativo do SPL Token exige as M assinaturas na MESMA transação.
   Não existe "a Vivá assina hoje e a DeTrash amanhã" com estado no servidor: o
   que viaja entre as duas organizações é a própria transação parcialmente
   assinada. É por isso que o fluxo é preparar → passar adiante → assinar e
   enviar. Isso não é contorno; é como um 2-de-3 honesto funciona.

   USO

     # 1) primeira organização prepara e assina parcialmente
     node liberar-bonus.mjs preparar --valor 60 --org viva --proposta 42

     # (a saída é um blob base64 — mande para a outra organização)

     # 2) segunda organização confere, assina e envia
     node liberar-bonus.mjs assinar --org detrash --tx <base64>

     # conferir saldos a qualquer momento
     node liberar-bonus.mjs saldo

   O passo 2 IMPRIME O QUE ESTÁ ASSINANDO antes de enviar (valor, destino,
   quem já assinou). Assinar às cegas um blob que alguém mandou é o jeito de
   transformar multisig em teatro.
--------------------------------------------------------------------------- */
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { createTransferInstruction, getAccount } from '@solana/spl-token';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RPC = process.env.RPC ?? 'https://api.devnet.solana.com';
const ENDERECOS = path.join(AQUI, 'dados', 'enderecos.json');
const REGISTRO = path.join(AQUI, 'dados', 'liberacoes.json');

const ORGS = {
  viva: { arquivo: 'signatario-viva.json', nome: 'Instituto Vivá', chave: 'institutoViva' },
  detrash: { arquivo: 'signatario-detrash.json', nome: 'DeTrash', chave: 'deTrash' },
  comunidade: { arquivo: 'signatario-comunidade.json', nome: 'Representante Comunitário', chave: 'representanteComunitario' },
};

/* ------------------------------------------------------------ utilidades --- */
const carregarChave = arq => Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(path.join(AQUI, 'chaves', arq), 'utf8'))));

function argumentos() {
  const a = process.argv.slice(2);
  const comando = a[0];
  const opts = {};
  for (let i = 1; i < a.length; i++) {
    if (a[i].startsWith('--')) opts[a[i].slice(2)] = a[i + 1]?.startsWith('--') ? true : a[++i];
  }
  return { comando, opts };
}

function endereços() {
  if (!fs.existsSync(ENDERECOS)) {
    console.error('✗ dados/enderecos.json não encontrado. Rode `node implantar-devnet.mjs` primeiro.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(ENDERECOS, 'utf8'));
}

/** cRED tem 2 decimais: R$ 60,00 → 6000 unidades. */
const paraUnidades = reais => Math.round(Number(reais) * 100);
const paraReais = u => (Number(u) / 100).toFixed(2);

/* ------------------------------------------------------------------ saldo --- */
async function saldo() {
  const e = endereços();
  const con = new Connection(RPC, 'confirmed');
  const cofre = await getAccount(con, new PublicKey(e.contas.cofre));
  const familia = await getAccount(con, new PublicKey(e.contas.familiaMaria));
  console.log(`\nrede: devnet · mint cRED ${e.mint}`);
  console.log(`cofre (multisig 2-de-3): R$ ${paraReais(cofre.amount)}`);
  console.log(`conta da família Maria:  R$ ${paraReais(familia.amount)}`);
  console.log(`\ncofre é propriedade do multisig? ${cofre.owner.toBase58() === e.multisig.endereco ? 'sim ✓' : 'NÃO ✗'}`);
}

/* --------------------------------------------------------------- preparar --- */
async function preparar({ valor, org, proposta, destino }) {
  if (!valor || !org) {
    console.error('uso: preparar --valor 60 --org viva [--proposta 42] [--destino <conta>]');
    process.exit(1);
  }
  const cfg = ORGS[org];
  if (!cfg) { console.error(`org desconhecida: ${org} (use viva, detrash ou comunidade)`); process.exit(1); }

  const e = endereços();
  const con = new Connection(RPC, 'confirmed');
  const pagador = carregarChave('pagador-operacao.json');
  const assinante = carregarChave(cfg.arquivo);
  const contaDestino = new PublicKey(destino || e.contas.familiaMaria);
  const unidades = paraUnidades(valor);

  const cofre = await getAccount(con, new PublicKey(e.contas.cofre));
  if (BigInt(cofre.amount) < BigInt(unidades)) {
    console.error(`✗ cofre tem R$ ${paraReais(cofre.amount)} e a liberação pede R$ ${paraReais(unidades)}.`);
    process.exit(1);
  }

  /* Instrução de transferência com dono = MULTISIG. Os signatários entram como
     `multiSigners`; a validação do limiar é do programa SPL Token, não nossa. */
  const ix = createTransferInstruction(
    new PublicKey(e.contas.cofre),
    contaDestino,
    new PublicKey(e.multisig.endereco),
    unidades,
    [assinante.publicKey, ...Object.values(ORGS)
      .filter(o => o !== cfg)
      .map(o => new PublicKey(e.signatarios[o.chave]))].slice(0, 2),
  );

  /* Precisa declarar QUAIS duas chaves vão assinar, e a ordem importa para o
     programa conferir. Fixamos: quem prepara + a próxima org da lista. */
  const outra = Object.entries(ORGS).find(([k]) => k !== org)[1];
  const ix2 = createTransferInstruction(
    new PublicKey(e.contas.cofre),
    contaDestino,
    new PublicKey(e.multisig.endereco),
    unidades,
    [assinante.publicKey, new PublicKey(e.signatarios[outra.chave])],
  );

  const tx = new Transaction().add(ix2);
  tx.feePayer = pagador.publicKey;
  tx.recentBlockhash = (await con.getLatestBlockhash('finalized')).blockhash;

  // fee payer e a primeira organização assinam agora; falta a segunda
  tx.partialSign(pagador, assinante);

  const blob = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');

  console.log(`\n── Liberação preparada por ${cfg.nome} ──────────────────────`);
  console.log(`valor:      R$ ${paraReais(unidades)}`);
  console.log(`do cofre:   ${e.contas.cofre}`);
  console.log(`para:       ${contaDestino.toBase58()}`);
  if (proposta) console.log(`proposta:   #${proposta}`);
  console.log(`assinou:    ${cfg.nome}`);
  console.log(`falta:      ${outra.nome} (limiar ${e.multisig.limiar})`);
  console.log(`\nMande esta linha para ${outra.nome}:\n`);
  console.log(`node liberar-bonus.mjs assinar --org ${Object.entries(ORGS).find(([, v]) => v === outra)[0]} --tx ${blob}`);
  console.log('\n⚠️  O blockhash expira em ~1 minuto e meio. Se der "blockhash not found",');
  console.log('   prepare de novo — não é erro de assinatura.');
  void ix; // a primeira construção serve só de conferência de tipos
}

/* ---------------------------------------------------------------- assinar --- */
async function assinar({ org, tx: blob }) {
  if (!org || !blob || blob === true) {
    console.error('uso: assinar --org detrash --tx <base64>');
    process.exit(1);
  }
  const cfg = ORGS[org];
  if (!cfg) { console.error(`org desconhecida: ${org}`); process.exit(1); }

  const e = endereços();
  const con = new Connection(RPC, 'confirmed');
  const assinante = carregarChave(cfg.arquivo);
  const tx = Transaction.from(Buffer.from(blob, 'base64'));

  /* CONFERIR ANTES DE ASSINAR. Assinar um blob às cegas porque "chegou por
     WhatsApp" transforma o 2-de-3 em teatro: a segunda assinatura só protege
     alguém se a segunda pessoa realmente olhar o que está autorizando. */
  const ix = tx.instructions[0];
  const de = ix.keys[0].pubkey.toBase58();
  const para = ix.keys[1].pubkey.toBase58();
  const dono = ix.keys[2].pubkey.toBase58();
  // layout do TransferChecked/Transfer: [1] = u64 little-endian com o valor
  const valor = Number(ix.data.readBigUInt64LE(1));
  const jaAssinaram = tx.signatures.filter(s => s.signature).map(s => s.publicKey.toBase58());

  console.log(`\n── Você está prestes a assinar como ${cfg.nome} ─────────────`);
  console.log(`valor:      R$ ${paraReais(valor)}`);
  console.log(`do cofre:   ${de}${de === e.contas.cofre ? ' ✓ (cofre do projeto)' : '  ⚠️ NÃO é o cofre conhecido'}`);
  console.log(`para:       ${para}${para === e.contas.familiaMaria ? ' ✓ (conta da família Maria)' : '  ⚠️ destino não catalogado'}`);
  console.log(`dono:       ${dono}${dono === e.multisig.endereco ? ' ✓ (multisig 2-de-3)' : '  ⚠️ NÃO é o multisig'}`);
  console.log(`já assinou: ${jaAssinaram.length} chave(s)`);

  if (de !== e.contas.cofre || dono !== e.multisig.endereco) {
    console.error('\n✗ Esta transação não sai do cofre conhecido. NÃO assine. Confirme com quem enviou.');
    process.exit(1);
  }

  tx.partialSign(assinante);

  console.log('\nenviando…');
  const sig = await con.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  await con.confirmTransaction(sig, 'confirmed');
  const det = await con.getTransaction(sig, { maxSupportedTransactionVersion: 0 });

  const registro = {
    rede: 'Solana devnet',
    valor: Number(paraReais(valor)),
    de, para,
    assinaram: tx.signatures.filter(s => s.signature).map(s => s.publicKey.toBase58()),
    txId: sig,
    slot: det?.slot ?? null,
    url: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
    em: new Date().toISOString(),
  };
  const anteriores = fs.existsSync(REGISTRO) ? JSON.parse(fs.readFileSync(REGISTRO, 'utf8')) : [];
  fs.writeFileSync(REGISTRO, JSON.stringify([...anteriores, registro], null, 2));

  /* Conta só as organizações: `tx.signatures` inclui o pagador da taxa, que não
     é signatário do cofre. Dizer "3 assinaturas" num 2-de-3 confunde justamente
     quem está conferindo se a regra foi cumprida. */
  const orgsQueAssinaram = registro.assinaram.filter(
    p => Object.values(e.signatarios).includes(p));
  console.log(`\n✅ Liberação executada pelo programa SPL Token`);
  console.log(`   ${orgsQueAssinaram.length} de 3 organizações assinaram (limiar ${e.multisig.limiar}); o pagador da taxa não conta`);
  console.log(`   slot ${registro.slot}`);
  console.log(`   ${registro.url}`);
  console.log(`\nCole esta assinatura no app (aba Cofre Multisig → Comprovante on-chain):\n`);
  console.log(sig);
}

/* --------------------------------------------------------------------------- */
const { comando, opts } = argumentos();
try {
  if (comando === 'saldo') await saldo();
  else if (comando === 'preparar') await preparar(opts);
  else if (comando === 'assinar') await assinar(opts);
  else {
    console.log(`comandos: saldo | preparar | assinar

  node liberar-bonus.mjs saldo
  node liberar-bonus.mjs preparar --valor 60 --org viva --proposta 42
  node liberar-bonus.mjs assinar --org detrash --tx <base64>`);
  }
} catch (e) {
  console.error('\n✗ ' + (e.message || e));
  if (/blockhash/i.test(String(e.message))) {
    console.error('  O blockhash expirou. Prepare a transação de novo.');
  }
  process.exitCode = 1;
}
