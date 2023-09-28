#!/bin/bash

anchor build --arch sbf

# 7oh6tTdSfoWdKgqFXotGtPfS3Gqk6Jwc2yDZ7NCErYLW
solana program deploy -u devnet --skip-fee-check \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id ./keypairs/vault.json \
  --max-len 265000 \
  ./target/deploy/vault.so

# GfVXtcDC2vUReYr2kNsijGgvNjqhpnfCce5AnriQQvg4
solana program deploy -u devnet --skip-fee-check \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id ./keypairs/pool-weighted.json \
  --max-len 512000 \
  ./target/deploy/pool_weighted.so

#
solana program deploy -u devnet --skip-fee-check \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id ./keypairs/pool-stable.json \
  --max-len 512000 \
  ./target/deploy/pool_stable.so

# Weighted: TxMkrJ8Nn9qLxM4FHmCbm957nf6264VL6bov1F2daxq
# Stable: 8MVYa7EoyUMgsXVSoYDdpj94oFV5Vo7Er8JptJo9wmsB
yarn cli vault-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --beneficiary-k 7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma \
  --beneficiary-fee 0.22

# STB70-USDC30
# Pool: 5waHmrTZoNZBysSXfvgzYkXmkGkpbRBtHCQzFiSDnrh7
# Mint: E91biZKsBsw4difabKp9PGUEwMfEDghZMftsVQo6qqBx
yarn cli pool-weighted-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k TxMkrJ8Nn9qLxM4FHmCbm957nf6264VL6bov1F2daxq \
  --swap-fee 0.005 \
  --weights 0.7,0.3 \
  --mints STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1,AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX

# STB80-USDT20
# Pool: HqYNu4hXRJuFBmiXD4pm6HuTdukUT3gqNKraD1huCJhS
# Mint: Hk7QqKJQmJhVnYw6q1deQS6LDw6KLms8HBqor9bpBMRq
yarn cli pool-weighted-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k TxMkrJ8Nn9qLxM4FHmCbm957nf6264VL6bov1F2daxq \
  --swap-fee 0.005 \
  --weights 0.8,0.2 \
  --mints STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1,FeCtM4bXUGo8vGrvHUCZjybmesovZLkQqCGqMuhHUHfZ
