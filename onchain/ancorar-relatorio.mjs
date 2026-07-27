/* ---------------------------------------------------------------------------
   Ancora o hash de um Relatório de Circularidade na Solana devnet.

   Grava o SHA-256 do relatório numa transação com o programa Memo — registro
   público, com data e hora, que qualquer pessoa confere no explorer sem
   depender de nós. É o único ponto do projeto que sai da simulação.

   Por que é script de operador e não botão no site: assinar exige chave
   privada. Chave em navegador é pública (o bundle é legível) e chave em
   servidor é chave a mais para vazar. Aqui ela fica só na máquina de quem
   opera, no mesmo lugar do implantar-devnet.mjs.

   Uso:
     node ancorar-relatorio.mjs <sha256> "<período>"

   Exemplo:
     node ancorar-relatorio.mjs 3bb13611cde6b9f6... "Julho 2026 — quinzena 1"

   O app mostra o hash pronto para copiar (aba Instituto Vivá → relatório →
   "Ancorar"), e depois recebe de volta a assinatura que este script imprime.
--------------------------------------------------------------------------- */
import {
  Connection, Keypair, PublicKey, Transaction, TransactionInstruction, LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

const RPC = process.env.RPC || 'https://api.devnet.solana.com';
const MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'); // programa Memo v2
const DIR = './chaves';
const explorer = (tipo, id) => `https://explorer.solana.com/${tipo}/${id}?cluster=devnet`;

const [hash, periodo] = process.argv.slice(2);

if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) {
  console.error('\n❌ informe o SHA-256 do relatório (64 caracteres hexadecimais).');
  console.error('   uso: node ancorar-relatorio.mjs <sha256> "<período>"');
  console.error('   o app mostra esse hash na aba Instituto Vivá, no relatório.\n');
  process.exit(1);
}

const arquivoChave = path.join(DIR, 'pagador-operacao.json');
if (!fs.existsSync(arquivoChave)) {
  console.error(`\n❌ ${arquivoChave} não existe. Rode primeiro o implantar-devnet.mjs`);
  console.error('   (ele gera e financia a conta que paga as taxas da operação).\n');
  process.exit(1);
}

const pagador = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(arquivoChave, 'utf8'))));

const conexao = new Connection(RPC, 'confirmed');

console.log('\n⚓ Ancoragem de Relatório de Circularidade — Solana devnet\n');
console.log('  hash    :', hash.toLowerCase());
console.log('  período :', periodo || '(não informado)');
console.log('  pagador :', pagador.publicKey.toBase58());

const saldo = await conexao.getBalance(pagador.publicKey);
console.log('  saldo   :', (saldo / LAMPORTS_PER_SOL).toFixed(4), 'SOL');
if (saldo === 0) {
  console.error('\n❌ conta sem saldo. Financie em https://faucet.solana.com (devnet) e rode de novo.\n');
  process.exit(1);
}

/* O conteúdo do memo é deliberadamente enxuto: identifica o projeto, o tipo de
   registro e o hash. Nenhum dado de família ou criança — só a impressão
   digital de um documento que fica fora da rede. */
const conteudo = JSON.stringify({
  p: 'raizes-do-futuro',
  t: 'relatorio-circularidade',
  h: hash.toLowerCase(),
  ...(periodo ? { periodo } : {}),
});

const tx = new Transaction().add(new TransactionInstruction({
  keys: [{ pubkey: pagador.publicKey, isSigner: true, isWritable: true }],
  programId: MEMO,
  data: Buffer.from(conteudo, 'utf8'),
}));

console.log('\n  memo    :', conteudo);
console.log('  enviando…');

try {
  const assinatura = await conexao.sendTransaction(tx, [pagador], { preflightCommitment: 'confirmed' });
  await conexao.confirmTransaction(assinatura, 'confirmed');

  const detalhe = await conexao.getTransaction(assinatura, { maxSupportedTransactionVersion: 0 });

  console.log('\n✅ Ancorado na Solana devnet');
  console.log('   assinatura :', assinatura);
  console.log('   slot       :', detalhe?.slot ?? '(confirmando)');
  console.log('   explorer   :', explorer('tx', assinatura));
  console.log('\n👉 Cole esta assinatura no app (Instituto Vivá → relatório → Ancorar) para');
  console.log('   o selo e o link aparecerem no explorador de transações.\n');

  const registro = {
    rede: 'Solana devnet',
    hash: hash.toLowerCase(),
    periodo: periodo || null,
    txId: assinatura,
    slot: detalhe?.slot ?? null,
    url: explorer('tx', assinatura),
    em: new Date().toISOString(),
  };
  const arq = 'dados/ancoragens.json';
  const antes = fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : [];
  antes.push(registro);
  fs.writeFileSync(arq, JSON.stringify(antes, null, 2));
  console.log('   histórico salvo em onchain/dados/ancoragens.json\n');
} catch (e) {
  console.error('\n❌ falhou:', e.message);
  process.exit(1);
}
