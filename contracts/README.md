# FundoInfancia.sol — integração com a Rede Recy (Sepolia) 🔗

Contrato do fundo comunitário de saúde e educação infantil, escrito **no padrão do RecyReport.sol** da Rede Recy ([contrato principal na Sepolia](https://sepolia.etherscan.io/address/0xc2b9a91fd9789ebe93c22b5a4981c2d643c9e6b1#code)).

## Correspondência de funções (conforme orientação da Rede Recy)

| RecyReport.sol | FundoInfancia.sol | O que faz |
|---|---|---|
| `mintRecyReportResult` | `askForFunding(valor, categoria, evidenciaHash)` | Família solicita assistência para saúde ou educação de uma criança |
| `validateRecyReport` | `validateAsk(id)` | Signatário credenciado valida evidências (Certificados Recy + prova de necessidade) |
| `claimRecyReportReward` | `claimFunding(id)` | Libera o recurso para a família após a validação |

## Governança embutida (o diferencial do projeto)

`validateAsk` exige **2 validações de signatários distintos** entre Instituto Vivá, DeTrash e Representante Comunitário — a versão on-chain do nosso cofre 2-de-3. E os princípios do Raízes do Futuro estão em código:

- Pedido validado sem saldo → **reservado, nunca perdido** (`FundingReservado`); saca quando entrar depósito
- Nenhum dado de criança on-chain — só o **hash** da evidência (LGPD)
- Renda do trabalho é paga fora do contrato e é **incondicional**

## Padrão de proxy da Rede Recy

Sem constructor com estado: toda a configuração está em **`initialize(institutoViva, deTrash, representanteComunitario)`**, chamada uma única vez. É exatamente o que o contrato principal da Rede Recy usa para criar o proxy do piloto — basta enviar este `.sol` para o contato da Recy e informar os 3 endereços signatários. (Eles mencionaram que vão chamar `initialize` para criar o proxy do nosso piloto.)

## Testar por conta própria (Remix, ~10 min)

1. Abra https://remix.ethereum.org → novo arquivo → cole `FundoInfancia.sol`
2. Compile (Solidity 0.8.24+)
3. Deploy na Sepolia: MetaMask → rede Sepolia → ETH de teste em https://sepolia-faucet.pk910.de (sem cadastro) ou faucet da Alchemy
4. Chame `initialize` com 3 endereços de teste (podem ser 3 contas do próprio MetaMask)
5. Fluxo de demonstração:
   - Envie 0.01 ETH ao contrato (aba "Low level interactions" → Transact) → `DepositoRecebido`
   - Com a conta "família": `askForFunding(2000000000000000, "saude", "QmHashEvidencia...")` (0.002 ETH)
   - Com Vivá: `validateAsk(1)` → 1/2 · Com DeTrash: `validateAsk(1)` → **Validado** ✅
   - Com a família: `claimFunding(1)` → ETH transferido → `FundingLiberado`
6. Verifique o contrato no Etherscan (Verify & Publish) e guarde os links das transações — são a prova para a banca

## O que enviar ao contato da Rede Recy

- Este arquivo `FundoInfancia.sol`
- Os 3 endereços dos signatários do piloto (Instituto Vivá, DeTrash, Representante Comunitário)
- Pedir: criação do proxy via `initialize` + endereço do proxy na Sepolia para colocarmos no app e na submissão
