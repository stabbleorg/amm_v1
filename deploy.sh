#!/bin/bash

anchor build --arch sbf

# Vault
solana program deploy -u devnet --skip-fee-check \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id keypairs/programs/vault.json \
  ./target/deploy/vault.so

anchor idl init -f target/idl/vault.json \
  --provider.cluster devnet \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  6sTpp3Z7s4YSWgxuibjhE8tvcywhRc8a5FYfuv6vhuQA

# Pool Weighted
solana program deploy -u devnet --skip-fee-check \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id keypairs/programs/pool-weighted.json \
  ./target/deploy/pool_weighted.so

anchor idl init -f target/idl/pool_weighted.json \
  --provider.cluster devnet \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  MT29MUjo7TPYxWK2NjLUCQ32dFgYEGW3nEDSAAJbyVy

# Pool Stable
solana program deploy -u devnet --skip-fee-check \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id keypairs/programs/pool-stable.json \
  ./target/deploy/pool_stable.so

anchor idl init -f target/idl/pool_stable.json \
  --provider.cluster devnet \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  EeyyyuAXAzo3YuMv7REuHYtPzEssgK4oBeFYM8K9CoGM

# Pool Smart
solana program deploy -u devnet --skip-fee-check \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id keypairs/programs/pool-smart.json \
  ./target/deploy/pool_smart.so

anchor idl init -f target/idl/pool_smart.json \
  --provider.cluster devnet \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  smpDKqHRt79KZPjWNC1UK5UWrrRv5avn9NqU6y2HJPT
