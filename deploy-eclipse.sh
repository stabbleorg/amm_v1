#!/bin/bash

anchor build --arch sbf

solana program deploy -u https://staging-rpc.dev.eclipsenetwork.xyz \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id keypairs/programs/slr.json \
  ./target/deploy/slr.so

anchor idl init -f target/idl/slr.json \
  --provider.cluster https://staging-rpc.dev.eclipsenetwork.xyz \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  FtmRXo2x8Re3PrzLebm7dqNKPoYSnXYBzU9toXeKCvAw

solana program deploy -u https://staging-rpc.dev.eclipsenetwork.xyz \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id keypairs/programs/vault.json \
  ./target/deploy/vault.so

anchor idl init -f target/idl/vault.json \
  --provider.cluster https://staging-rpc.dev.eclipsenetwork.xyz \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  6sTpp3Z7s4YSWgxuibjhE8tvcywhRc8a5FYfuv6vhuQA

solana program deploy -u https://staging-rpc.dev.eclipsenetwork.xyz \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id keypairs/programs/pool-weighted.json \
  ./target/deploy/pool_weighted.so

anchor idl init -f target/idl/pool_weighted.json \
  --provider.cluster https://staging-rpc.dev.eclipsenetwork.xyz \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  MT29MUjo7TPYxWK2NjLUCQ32dFgYEGW3nEDSAAJbyVy

solana program deploy -u https://staging-rpc.dev.eclipsenetwork.xyz \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id keypairs/programs/pool-stable.json \
  ./target/deploy/pool_stable.so

anchor idl init -f target/idl/pool_stable.json \
  --provider.cluster https://staging-rpc.dev.eclipsenetwork.xyz \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  EeyyyuAXAzo3YuMv7REuHYtPzEssgK4oBeFYM8K9CoGM
