# BitPredict — Bitcoin Prediction Market on OP_NET

> Week 3 · OP_NET Vibecoding Challenge · #opnetvibecode

Fully on-chain prediction market on Bitcoin L1 via OP_NET.

## Quick Start

```bash
npm install
cp .env.example .env        # add PRIVATE_KEY
npm run compile
npm test
npm run deploy:testnet
# copy address → VITE_CONTRACT_ADDRESS in .env
npm run dev
```

## Files

- `contracts/PredictionMarket.sol` — Smart contract
- `scripts/deploy.js` — Deploy + seed markets
- `test/PredictionMarket.test.js` — Full test suite
- `src/abi/index.js` — ABI + contract address
- `src/hooks/useWallet.js` — OP Wallet connection
- `src/hooks/useMarkets.js` — Market data + bet actions
- `src/utils/oracle.js` — CoinGecko + formatters
- `src/App.jsx` — Full React UI
- `src/main.jsx` — Entry point

## Deploy

```bash
npm run deploy:testnet      # OP_NET testnet
npm run deploy:mainnet      # OP_NET mainnet
npm run build               # Production build → deploy /dist to Vercel
```
