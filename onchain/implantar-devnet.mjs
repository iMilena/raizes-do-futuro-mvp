/* ---------------------------------------------------------------------------
   RAÍZES DO FUTURO — implantação real na Solana DEVNET
   Cria: token cRED (2 casas = centavos), cofre com MULTISIG NATIVO 2-de-3
   (Instituto Vivá, DeTrash, Representante Comunitário), deposita R$ 645,00
   no cofre e executa a liberação de R$ 60,00 para a família de Maria
   assinada por 2 dos 3 signatários — tudo verificável no explorer.

   Uso:  npm install && node implantar-devnet.mjs
   Saída: enderecos.json (+ cópia em ../public/onchain.json para o app)
   ⚠️ Chaves geradas em ./chaves são APENAS de teste (devnet, sem valor real).
--------------------------------------------------------------------------- */
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  createMint, createMultisig, getOrCreateAssociatedTokenAccount, mintTo, transfer,
} from '@solana/spl-token';
import fs from 'fs';
import path from 'path';

const conexao = new Connection(process.env.RPC || 'https://api.devnet.solana.com', 'confirmed');
const DIR = './chaves';
const explorer = (tipo, id) => `https://explorer.solana.com/${tipo}/${id}?cluster=devnet`;

/* chaves persistentes: rodar de novo reaproveita as mesmas contas */
function chave(nome) {
  fs.mkdirSync(DIR, { recursive: true });
  const arq = path.join(DIR, nome + '.json');
  if (fs.existsSync(arq)) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(arq, 'utf8'))));
  }
  const kp = Keypair.generate();
  fs.writeFileSync(arq, JSON.stringify([...kp.secretKey]));
  return kp;
}

async function airdrop(pub, sol = 2) {
  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    try {
      const saldo = await conexao.getBalance(pub);
      if (saldo >= 0.5 * LAMPORTS_PER_SOL) { console.log(`  saldo ok: ${(saldo / LAMPORTS_PER_SOL).toFixed(2)} SOL`); return; }
      console.log(`  pedindo airdrop (tentativa ${tentativa})…`);
      const sig = await conexao.requestAirdrop(pub, sol * LAMPORTS_PER_SOL);
      await conexao.confirmTransaction(sig, 'confirmed');
      console.log(`  airdrop ok → ${explorer('tx', sig)}`);
      return;
    } catch (e) {
      console.log(`  airdrop falhou (${e.message?.slice(0, 60)}). Aguardando 8s…`);
      await new Promise(r => setTimeout(r, 8000));
    }
  }
  throw new Error('Airdrop indisponível. Use https://faucet.solana.com para financiar a conta pagadora e rode de novo.');
}

const main = async () => {
  console.log('\n🌱 Raízes do Futuro — implantação na Solana devnet\n');

  const pagador = chave('pagador-operacao');   // paga as taxas (operação, 15%)
  const viva = chave('signatario-viva');
  const detrash = chave('signatario-detrash');
  const comunidade = chave('signatario-comunidade');
  const maria = chave('familia-maria');

  console.log('1/6 · Financiando a conta pagadora (taxas da operação)');
  console.log('  pagador:', pagador.publicKey.toBase58());
  await airdrop(pagador.publicKey);

  console.log('\n2/6 · Criando o token cRED (1 cRED = R$ 1,00 · 2 casas decimais)');
  const mint = await createMint(conexao, pagador, pagador.publicKey, null, 2);
  console.log('  mint:', mint.toBase58());

  console.log('\n3/6 · Criando o COFRE MULTISIG 2-de-3 (programa SPL Token nativo)');
  const multisig = await createMultisig(
    conexao, pagador,
    [viva.publicKey, detrash.publicKey, comunidade.publicKey],
    2,
  );
  console.log('  multisig (2-de-3):', multisig.toBase58());
  console.log('   • Instituto Vivá        ', viva.publicKey.toBase58());
  console.log('   • DeTrash               ', detrash.publicKey.toBase58());
  console.log('   • Rep. Comunitário      ', comunidade.publicKey.toBase58());

  console.log('\n4/6 · Contas de token (cofre e família)');
  const cofre = await getOrCreateAssociatedTokenAccount(conexao, pagador, mint, multisig, true);
  const contaMaria = await getOrCreateAssociatedTokenAccount(conexao, pagador, mint, maria.publicKey);
  console.log('  cofre  :', cofre.address.toBase58());
  console.log('  família:', contaMaria.address.toBase58());

  console.log('\n5/6 · Depositando R$ 645,00 no cofre (25% da receita do piloto)');
  const sigDeposito = await mintTo(conexao, pagador, mint, cofre.address, pagador, 64500);
  console.log('  tx:', explorer('tx', sigDeposito));

  console.log('\n6/6 · LIBERAÇÃO REAL: R$ 60,00 para a família de Maria');
  console.log('  exige 2 de 3 assinaturas → assinando com Instituto Vivá + DeTrash…');
  const sigBonus = await transfer(
    conexao, pagador,
    cofre.address, contaMaria.address,
    multisig,            // dono da conta é o multisig
    6000,                // R$ 60,00
    [viva, detrash],     // ✍️✍️ as duas assinaturas reais
  );
  console.log('  tx:', explorer('tx', sigBonus));

  const saldoCofre = await conexao.getTokenAccountBalance(cofre.address);
  const saldoMaria = await conexao.getTokenAccountBalance(contaMaria.address);

  const dados = {
    rede: 'devnet',
    geradoEm: new Date().toISOString(),
    moeda: 'cRED (1 = R$ 1,00)',
    mint: mint.toBase58(),
    multisig: { endereco: multisig.toBase58(), limiar: '2 de 3' },
    signatarios: {
      institutoViva: viva.publicKey.toBase58(),
      deTrash: detrash.publicKey.toBase58(),
      representanteComunitario: comunidade.publicKey.toBase58(),
    },
    contas: { cofre: cofre.address.toBase58(), familiaMaria: contaMaria.address.toBase58() },
    saldos: { cofre: saldoCofre.value.uiAmount, familiaMaria: saldoMaria.value.uiAmount },
    transacoes: { depositoFundo: sigDeposito, liberacaoBonusMultisig: sigBonus },
    links: {
      mint: explorer('address', mint.toBase58()),
      multisig: explorer('address', multisig.toBase58()),
      cofre: explorer('address', cofre.address.toBase58()),
      familiaMaria: explorer('address', contaMaria.address.toBase58()),
      depositoFundo: explorer('tx', sigDeposito),
      liberacaoBonusMultisig: explorer('tx', sigBonus),
    },
  };

  fs.writeFileSync('enderecos.json', JSON.stringify(dados, null, 2));
  try {
    fs.writeFileSync(path.join('..', 'public', 'onchain.json'), JSON.stringify(dados, null, 2));
    console.log('\n✅ Tudo no ar! enderecos.json salvo e copiado para ../public/onchain.json');
    console.log('   Rode `npm run build` na raiz do projeto e republique o site — a aba Cofre Multisig vai exibir o cofre real automaticamente.');
  } catch (e) {
    console.log('\n✅ Tudo no ar! Copie enderecos.json para public/onchain.json do app.');
  }
  console.log('\n🔗 Prova para a banca:');
  console.log('   Cofre multisig:', dados.links.multisig);
  console.log('   Liberação 2-de-3:', dados.links.liberacaoBonusMultisig, '\n');
};

main().catch(e => { console.error('\n❌ Erro:', e.message); process.exit(1); });
