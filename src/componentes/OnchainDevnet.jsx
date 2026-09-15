import { useEffect, useState } from 'react';
import { trunc } from '../estado/store.jsx';
import {
  Card, CardNota, Fig, Grade, Ledger, LedgerLinha, LinkAuditoria, Nota, Pill,
} from '../painel/ui/primitivos.jsx';

/* ---------------------------------------------------------------------------
   Painel do cofre REAL na Solana devnet.
   Aparece automaticamente quando public/dados/onchain.json existe (gerado pelo
   script onchain/implantar-devnet.mjs). Lê os saldos ao vivo da rede.
--------------------------------------------------------------------------- */

const RPC = 'https://api.devnet.solana.com';

async function saldoToken(conta) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenAccountBalance', params: [conta] }),
  });
  const j = await r.json();
  return j?.result?.value?.uiAmount ?? null;
}

export default function OnchainDevnet() {
  const [dados, setDados] = useState(null);
  const [saldos, setSaldos] = useState(null);
  const [erroRpc, setErroRpc] = useState(false);

  useEffect(() => {
    fetch('./dados/onchain.json')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.multisig) setDados(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!dados) return;
    Promise.all([saldoToken(dados.contas.cofre), saldoToken(dados.contas.familiaMaria)])
      .then(([cofre, maria]) => setSaldos({ cofre, maria }))
      .catch(() => setErroRpc(true));
  }, [dados]);

  if (!dados) return null; // sem implantação, o app segue 100% simulado

  const fmt = v => (v == null ? 'sem leitura' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  const lerSaldo = (aoVivo, deArquivo) => (saldos ? fmt(aoVivo) : erroRpc ? fmt(deArquivo) : '…');

  const ENDERECOS = [
    ['Cofre multisig (2-de-3)', dados.multisig.endereco, dados.links.multisig],
    ['Token cRED (mint)', dados.mint, dados.links.mint],
    ['Depósito do fundo (tx)', dados.transacoes.depositoFundo, dados.links.depositoFundo],
    ['Liberação assinada 2-de-3 (tx)', dados.transacoes.liberacaoBonusMultisig, dados.links.liberacaoBonusMultisig],
  ];

  return (
    <Card className="pn-onchain">
      <div className="pn-onchain-topo">
        <Pill tom="ok">Cofre real · Solana devnet</Pill>
        <CardNota>
          Programas oficiais SPL Token · multisig nativo {dados.multisig.limiar}
        </CardNota>
      </div>

      <Grade colunas={2} style={{ marginTop: 20, gap: 22 }}>
        <Fig rotulo="Saldo do cofre (ao vivo da rede)" valor={lerSaldo(saldos?.cofre, dados.saldos?.cofre)} />
        <Fig rotulo="Conta da família Maria" valor={lerSaldo(saldos?.maria, dados.saldos?.familiaMaria)} />
      </Grade>

      <Ledger style={{ marginTop: 20 }}>
        {ENDERECOS.map(([rot, valor, link]) => (
          <LedgerLinha
            key={rot}
            chave={rot}
            valor={<LinkAuditoria href={link}>{trunc(valor, 6, 6)}</LinkAuditoria>}
          />
        ))}
      </Ledger>

      <div style={{ marginTop: 16 }}>
        <Nota tipo="i" icone="check">
          A liberação acima foi <b>assinada de verdade</b> por Instituto Vivá e DeTrash, e
          executada pelo programa SPL Token. Os links abrem no Solana Explorer para auditoria.
          As telas seguintes demonstram a jornada operacional completa.
        </Nota>
      </div>
    </Card>
  );
}
