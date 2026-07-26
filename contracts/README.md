# FundoInfancia.sol — integração com a Rede Recy (Sepolia) 🔗

Contrato do fundo comunitário de saúde e educação infantil, escrito **no padrão do RecyReport.sol** da Rede Recy ([contrato principal na Sepolia](https://sepolia.etherscan.io/address/0xc2b9a91fd9789ebe93c22b5a4981c2d643c9e6b1#code)).

## Correspondência de funções (conforme orientação da Rede Recy)

| RecyReport.sol | FundoInfancia.sol | O que faz |
|---|---|---|
| `mintRecyReportResult` | `askForFunding(familia, valor, categoria, evidenciaHash)` | Registra o pedido de assistência de uma família (chamado por signatário credenciado) |
| `validateRecyReport` | `validateAsk(id)` | Signatário credenciado valida evidências (Certificados Recy + prova de necessidade) |
| `claimRecyReportReward` | `claimFunding(id)` | Libera o recurso para a família após a validação (chamável por qualquer um) |

### Por que a família não chama o contrato

`askForFunding` recebe o endereço da família como parâmetro e só aceita signatário credenciado; `claimFunding` pode ser chamado por qualquer endereço, mas o dinheiro vai **sempre** para a família do pedido.

Isso é deliberado: a família de Boipeba usa conta custodiada e **não tem ETH para gás**. Exigir que ela pague taxa de rede contradiria o princípio de inclusão do projeto — a operação paga o gás, a família só recebe. Como efeito colateral, ninguém de fora consegue inflar o storage do contrato com pedidos falsos.

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
   - Com a conta **Vivá**: `askForFunding(<endereço da família>, 2000000000000000, 0, 0x<sha256 da evidência>)`
     — `0` = Saude, `1` = Educacao; o hash é `bytes32`, ou seja `0x` + 64 hexadecimais
   - Com Vivá: `validateAsk(1)` → 1/2 · Com DeTrash: `validateAsk(1)` → **Validado** ✅
   - Com **qualquer** conta: `claimFunding(1)` → ETH vai para a família → `FundingLiberado`
   - Teste a regra de reserva: peça um valor maior que o saldo e chame `claimFunding` —
     ele **não reverte**, devolve `false` e emite `FundingReservado`, deixando o pedido liberável depois
6. Verifique o contrato no Etherscan (Verify & Publish) e guarde os links das transações — são a prova para a banca

> **Antes de divulgar o endereço:** chame `initialize` na mesma sessão da implantação.
> Só quem implantou consegue inicializar, mas um contrato publicado e não inicializado
> não serve para nada — e o `askForFunding` rejeita tudo até lá.

## Limitação conhecida

A regra 4 do cofre ("saldo residual do ciclo → ações coletivas definidas com a comunidade") **não tem caminho on-chain**: não existe função de saque residual, então ETH depositado e não reclamado fica preso no contrato para sempre. Isso é decisão de governança pendente — quem decide o destino, e sob qual quórum. Implementar antes de qualquer uso com valor real.

## O que enviar ao contato da Rede Recy

- Este arquivo `FundoInfancia.sol`
- Os 3 endereços dos signatários do piloto (Instituto Vivá, DeTrash, Representante Comunitário)
- Pedir: criação do proxy via `initialize` + endereço do proxy na Sepolia para colocarmos no app e na submissão
