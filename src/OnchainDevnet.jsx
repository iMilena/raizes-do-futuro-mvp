import React, { useEffect, useState } from 'react';
import { trunc } from './store.jsx';

/* ---------------------------------------------------------------------------
   Painel do cofre REAL na Solana devnet.
   Aparece automaticamente quando public/onchain.json existe (gerado pelo
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
    fetch('./onchain.json')
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

  if (!dados) return null; // sem implantação → app segue 100% simulado

  const fmt = v => (v == null ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  const Linha = ({ rot, valor, link }) => (
    <div className="onchain-linha">
      <span>{rot}</span>
      <a href={link} target="_blank" rel="noreferrer" className="hash" title="Abrir no Solana Explorer (devnet)">
        {trunc(valor, 6, 6)} ↗
      </a>
    </div>
  );

  return (
    <div className="card onchain">
      <div className="onchain-topo">
        <span className="onchain-badge">🟢 COFRE REAL · SOLANA DEVNET</span>
        <span className="mini">programas oficiais SPL Token · multisig nativo {dados.multisig.limiar}</span>
      </div>

      <div className="onchain-saldos">
        <div>
          <span className="mini">saldo do cofre (ao vivo da rede)</span>
          <b>{saldos ? fmt(saldos.cofre) : erroRpc ? fmt(dados.saldos?.cofre) : '…'}</b>
        </div>
        <div>
          <span className="mini">conta da família Maria</span>
          <b>{saldos ? fmt(saldos.maria) : erroRpc ? fmt(dados.saldos?.familiaMaria) : '…'}</b>
        </div>
      </div>

      <div className="onchain-grade">
        <Linha rot="Cofre multisig (2-de-3)" valor={dados.multisig.endereco} link={dados.links.multisig} />
        <Linha rot="Token cRED (mint)" valor={dados.mint} link={dados.links.mint} />
        <Linha rot="Depósito do fundo (tx)" valor={dados.transacoes.depositoFundo} link={dados.links.depositoFundo} />
        <Linha rot="Liberação assinada 2-de-3 (tx)" valor={dados.transacoes.liberacaoBonusMultisig} link={dados.links.liberacaoBonusMultisig} />
      </div>

      <p className="mini" style={{ marginBottom: 0 }}>
        ✍️ A liberação acima foi <b>assinada de verdade</b> por Instituto Vivá + DeTrash e executada pelo programa
        SPL Token — clique nos links para auditar no Solana Explorer. As telas abaixo continuam em modo simulado
        para demonstrar a jornada completa.
      </p>
    </div>
  );
}
