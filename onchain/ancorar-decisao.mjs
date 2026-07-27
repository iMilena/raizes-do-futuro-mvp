/* ---------------------------------------------------------------------------
   Ancora a DECISÃO COLETIVA de fechamento de ciclo na Solana devnet.

   Isto é a regra 4 do cofre: "saldo residual do ciclo → ações coletivas de
   saúde e educação definidas com a comunidade".

   O QUE A CADEIA PODE E NÃO PODE FAZER AQUI
   A decisão em si é humana e acontece em assembleia — nenhum contrato decide o
   que a comunidade quer. O que a cadeia oferece é o que falta hoje: prova
   pública, com data e hora, de que ESTA decisão, com ESTE valor, foi a
   combinada. Sem isso, "a comunidade decidiu" é palavra da operação contra
   a memória de quem estava lá.

   Por isso a regra 4 vive aqui, e não numa função de contrato: um contrato que
   distribuísse o residual sozinho tomaria a decisão no lugar da assembleia. O
   que precisa ser imutável é o REGISTRO da decisão, não a decisão.

   Uso:
     node ancorar-decisao.mjs <sha256> "<ciclo>"

   O app monta o hash a partir do formulário de fechamento (aba Cofre Multisig →
   Fechamento de ciclo) e recebe de volta a assinatura que este script imprime.
--------------------------------------------------------------------------- */
import {
  Connection, Keypair, PublicKey, Transaction, TransactionInstruction, LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

const RPC = process.env.RPC || 'https://api.devnet.solana.com';
const MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const DIR = './chaves';
const explorer = (tipo, id) => `https://explorer.solana.com/${tipo}/${id}?cluster=devnet`;

const [hash, ciclo] = process.argv.slice(2);

if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) {
  console.error('\n❌ informe o SHA-256 da decisão (64 caracteres hexadecimais).');
  console.error('   uso: node ancorar-decisao.mjs <sha256> "<ciclo>"');
  console.error('   o app mostra esse hash no Cofre Multisig → Fechamento de ciclo.\n');
  process.exit(1);
}

const arquivoChave = path.join(DIR, 'pagador-operacao.json');
if (!fs.existsSync(arquivoChave)) {
  console.error(`\n❌ ${arquivoChave} não existe. Rode primeiro o implantar-devnet.mjs\n`);
  process.exit(1);
}

const pagador = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(arquivoChave, 'utf8'))));
const conexao = new Connection(RPC, 'confirmed');

console.log('\n🤝 Decisão coletiva de fechamento de ciclo — Solana devnet\n');
console.log('  hash  :', hash.toLowerCase());
console.log('  ciclo :', ciclo || '(não informado)');

const saldo = await conexao.getBalance(pagador.publicKey);
console.log('  saldo :', (saldo / LAMPORTS_PER_SOL).toFixed(4), 'SOL');
if (saldo === 0) {
  console.error('\n❌ conta sem saldo. Financie em https://faucet.solana.com (devnet).\n');
  process.exit(1);
}

/* Só a impressão digital. O texto da decisão — que menciona pessoas presentes na
   assembleia — fica no registro do projeto, fora da rede. */
const conteudo = JSON.stringify({
  p: 'raizes-do-futuro',
  t: 'decisao-coletiva-residual',
  h: hash.toLowerCase(),
  ...(ciclo ? { ciclo } : {}),
});

const tx = new Transaction().add(new TransactionInstruction({
  keys: [{ pubkey: pagador.publicKey, isSigner: true, isWritable: true }],
  programId: MEMO,
  data: Buffer.from(conteudo, 'utf8'),
}));

console.log('\n  memo  :', conteudo);
console.log('  enviando…');

try {
  const assinatura = await conexao.sendTransaction(tx, [pagador], { preflightCommitment: 'confirmed' });
  await conexao.confirmTransaction(assinatura, 'confirmed');
  const detalhe = await conexao.getTransaction(assinatura, { maxSupportedTransactionVersion: 0 });

  console.log('\n✅ Decisão ancorada na Solana devnet');
  console.log('   assinatura :', assinatura);
  console.log('   slot       :', detalhe?.slot ?? '(confirmando)');
  console.log('   explorer   :', explorer('tx', assinatura));
  console.log('\n👉 Cole no app (Cofre Multisig → Fechamento de ciclo).\n');

  const arq = 'decisoes.json';
  const antes = fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : [];
  antes.push({
    rede: 'Solana devnet', hash: hash.toLowerCase(), ciclo: ciclo || null,
    txId: assinatura, slot: detalhe?.slot ?? null, url: explorer('tx', assinatura),
    em: new Date().toISOString(),
  });
  fs.writeFileSync(arq, JSON.stringify(antes, null, 2));
  console.log('   histórico salvo em onchain/decisoes.json\n');
} catch (e) {
  console.error('\n❌ falhou:', e.message);
  process.exit(1);
}
