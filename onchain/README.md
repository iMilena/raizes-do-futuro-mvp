# Cofre real na Solana devnet 🔗

Implanta a versão **real e verificável** do Fundo Infância na Solana devnet, usando apenas programas oficiais da rede (SPL Token):

- Token **cRED** (1 cRED = R$ 1,00, 2 casas decimais)
- **Cofre multisig 2-de-3 nativo** — Instituto Vivá, DeTrash e Representante Comunitário
- Depósito de R$ 645,00 no cofre
- **Liberação real de R$ 60,00** para a família de Maria, assinada por 2 dos 3 signatários

Sem Rust, sem Anchor, sem carteira de navegador — um único comando.

## Como rodar (nesta pasta)

Pré-requisito: Node 18+ e internet.

```bash
npm install
node implantar-devnet.mjs
```

O script imprime todos os endereços e os links do Solana Explorer (devnet). Ele também copia `dados/enderecos.json` para `../public/dados/onchain.json` — depois disso:

```bash
cd ..
npm run build   # ou npm run dev
```

A aba **🔗 Cofre Multisig** do app passa a exibir o painel "cofre real na devnet" automaticamente, com saldos lidos ao vivo da rede.

## Se o airdrop falhar

A devnet limita airdrops por IP. O script tenta 5 vezes; se não conseguir:
1. Copie o endereço do "pagador" que o script imprime
2. Peça 2 SOL em https://faucet.solana.com
3. Rode o script de novo (ele reaproveita as mesmas chaves de `./chaves`)

## Segurança

As chaves em `./chaves` são exclusivamente de teste (devnet — sem valor real). Mesmo assim, não use essas chaves para nada além da demo. Em produção: chaves dos signatários em dispositivos separados de cada organização e cofre no padrão Squads.

## O que mostrar à banca

- Link do **multisig** no explorer: prova de que o cofre exige 2-de-3
- Link da **transação de liberação**: prova da transferência assinada por Vivá + DeTrash
- No app, painel verde na aba Cofre Multisig com saldos ao vivo
