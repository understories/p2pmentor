# What's Public and What's Not

Understanding exactly what data lives on-chain versus off-chain is the foundation of Web3 privacy.

## On-Chain (Public Forever)

| Data                  | Example                                      |
| --------------------- | -------------------------------------------- |
| Wallet addresses      | `0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18` |
| Transaction amounts   | Sent 1.5 ETH                                 |
| Token balances        | Holds 500 USDC                               |
| Contract interactions | Called `swap()` on Uniswap                   |
| NFT ownership         | Owns CryptoPunk #1234                        |
| Gas paid              | 0.003 ETH in gas                             |
| Timestamps            | Block 18,000,000 (Oct 2023)                  |
| Contract code         | Verified source on Etherscan                 |

## Off-Chain (Not Public by Default)

| Data               | How It Gets Linked                            |
| ------------------ | --------------------------------------------- |
| Real name          | KYC on exchanges → address linked to identity |
| Email address      | Signing up for services with wallet connect   |
| IP address         | RPC providers logging requests                |
| Physical location  | IP geolocation via RPC                        |
| Social accounts    | ENS profiles, Twitter verification            |
| Transaction intent | Only you know why you sent a transaction      |

## The Linking Problem

The critical privacy risk is **linking** — connecting your on-chain address to your off-chain identity. Once linked, all your transaction history becomes attributable to you.

Common linking vectors:

1. **Exchange KYC**: Withdrawing from Coinbase links that address to your verified identity
2. **ENS names**: `yourname.eth` publicly connects your name to an address
3. **Social verification**: Tweeting your address, adding it to your bio
4. **Payment requests**: Sharing your address to receive payment

## What You Can Control

You can't make transactions invisible on a public chain, but you can:

- Use **separate wallets** for different purposes
- Avoid **unnecessary linking** of addresses to identity
- Be deliberate about which addresses you share publicly
