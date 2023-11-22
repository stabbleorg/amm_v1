#!/bin/bash

anchor build --arch sbf

solana program deploy -u https://staging-rpc.dev.eclipsenetwork.xyz \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id ./keypairs/slr.json \
  --max-len 512000 \
  ./target/deploy/slr.so

anchor idl init -f target/idl/slr.json \
  --provider.cluster https://staging-rpc.dev.eclipsenetwork.xyz \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  88eN7xkpWwyCrtVAuhuKtVLkmuSEFv6MgTkpAodvpd31

solana program deploy -u https://staging-rpc.dev.eclipsenetwork.xyz \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id ./keypairs/vault.json \
  --max-len 265000 \
  ./target/deploy/vault.so

anchor idl init -f target/idl/vault.json \
  --provider.cluster https://staging-rpc.dev.eclipsenetwork.xyz \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  7oh6tTdSfoWdKgqFXotGtPfS3Gqk6Jwc2yDZ7NCErYLW

solana program deploy -u https://staging-rpc.dev.eclipsenetwork.xyz \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id ./keypairs/pool-weighted.json \
  --max-len 512000 \
  ./target/deploy/pool_weighted.so

anchor idl init -f target/idl/pool_weighted.json \
  --provider.cluster https://staging-rpc.dev.eclipsenetwork.xyz \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  GfVXtcDC2vUReYr2kNsijGgvNjqhpnfCce5AnriQQvg4

solana program deploy -u https://staging-rpc.dev.eclipsenetwork.xyz \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id ./keypairs/pool-stable.json \
  --max-len 512000 \
  ./target/deploy/pool_stable.so

anchor idl init -f target/idl/pool_stable.json \
  --provider.cluster https://staging-rpc.dev.eclipsenetwork.xyz \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  CKZnJGq6aCDBccaoZUJkJpgYUVLpoVT51RfYpaMXP37f

# Stable: BHizB77Ay58GCLqbDjm86Cm9eM2ueDZUGvakHdvaqp5X
yarn cli vault-init -u https://staging-rpc.dev.eclipsenetwork.xyz \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --pool-kind stable \
  --beneficiary-k 7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma \
  --beneficiary-fee 0.22

# USDC: F631UhkbbdHkCajRC4o7hAxcBb8VkjY2YQjz4spyAoxq
# DAI: 5CejPYsMhwCCkpTVi43SSZk8tCdepenVqwpt795AcMsr
# USDC-DAI: FLMquCH1kQmxmk1aXSQ9cXFzLix8e8r16dtcag58Gxm1
# Pool: 9kRG729HsHhGextfEZAKZEqhhWUndN8s7h25ydeEwkyp
yarn cli pool-stable-init -u https://staging-rpc.dev.eclipsenetwork.xyz \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k BHizB77Ay58GCLqbDjm86Cm9eM2ueDZUGvakHdvaqp5X \
  --mints F631UhkbbdHkCajRC4o7hAxcBb8VkjY2YQjz4spyAoxq 5CejPYsMhwCCkpTVi43SSZk8tCdepenVqwpt795AcMsr \
  --amp 1000 \
  --swap-fee 0.0004
