#!/bin/bash

anchor build --arch sbf

# Vault
solana program deploy -u https://staging-rpc.dev.eclipsenetwork.xyz \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id 6sTpp3Z7s4YSWgxuibjhE8tvcywhRc8a5FYfuv6vhuQA \
  ./target/deploy/vault.so

anchor idl upgrade -f target/idl/vault.json \
  --provider.cluster https://staging-rpc.dev.eclipsenetwork.xyz \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  6sTpp3Z7s4YSWgxuibjhE8tvcywhRc8a5FYfuv6vhuQA

# Pool Weighted
solana program deploy -u https://staging-rpc.dev.eclipsenetwork.xyz \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id MT29MUjo7TPYxWK2NjLUCQ32dFgYEGW3nEDSAAJbyVy \
  ./target/deploy/pool_weighted.so

anchor idl upgrade -f target/idl/pool_weighted.json \
  --provider.cluster https://staging-rpc.dev.eclipsenetwork.xyz \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  MT29MUjo7TPYxWK2NjLUCQ32dFgYEGW3nEDSAAJbyVy

# Pool Stable
solana program deploy -u https://staging-rpc.dev.eclipsenetwork.xyz \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id EeyyyuAXAzo3YuMv7REuHYtPzEssgK4oBeFYM8K9CoGM \
  ./target/deploy/pool_stable.so

anchor idl upgrade -f target/idl/pool_stable.json \
  --provider.cluster https://staging-rpc.dev.eclipsenetwork.xyz \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  EeyyyuAXAzo3YuMv7REuHYtPzEssgK4oBeFYM8K9CoGM

# Pool Smart
solana program deploy -u https://staging-rpc.dev.eclipsenetwork.xyz \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id smpDKqHRt79KZPjWNC1UK5UWrrRv5avn9NqU6y2HJPT \
  ./target/deploy/pool_smart.so

anchor idl upgrade -f target/idl/pool_smart.json \
  --provider.cluster https://staging-rpc.dev.eclipsenetwork.xyz \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  smpDKqHRt79KZPjWNC1UK5UWrrRv5avn9NqU6y2HJPT
