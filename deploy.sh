#!/bin/bash

anchor build --arch sbf

# 7oh6tTdSfoWdKgqFXotGtPfS3Gqk6Jwc2yDZ7NCErYLW
solana program deploy -u devnet --skip-fee-check \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id ./keypairs/vault.json \
  --max-len 265000 \
  ./target/deploy/vault.so

anchor idl upgrade -f target/idl/vault.json \
  --provider.cluster devnet \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  7oh6tTdSfoWdKgqFXotGtPfS3Gqk6Jwc2yDZ7NCErYLW

# GfVXtcDC2vUReYr2kNsijGgvNjqhpnfCce5AnriQQvg4
solana program deploy -u devnet --skip-fee-check \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id ./keypairs/pool-weighted.json \
  --max-len 512000 \
  ./target/deploy/pool_weighted.so

anchor idl upgrade -f target/idl/pool_weighted.json \
  --provider.cluster devnet \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  GfVXtcDC2vUReYr2kNsijGgvNjqhpnfCce5AnriQQvg4

# CKZnJGq6aCDBccaoZUJkJpgYUVLpoVT51RfYpaMXP37f
solana program deploy -u devnet --skip-fee-check \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id ./keypairs/pool-stable.json \
  --max-len 512000 \
  ./target/deploy/pool_stable.so

anchor idl upgrade -f target/idl/pool_stable.json \
  --provider.cluster devnet \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  CKZnJGq6aCDBccaoZUJkJpgYUVLpoVT51RfYpaMXP37f

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

yarn cli pool-weighted-deposit \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --pool-k 5waHmrTZoNZBysSXfvgzYkXmkGkpbRBtHCQzFiSDnrh7 \
  --amounts 26666666.666666662,200000 \
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

yarn cli pool-weighted-deposit \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --pool-k HqYNu4hXRJuFBmiXD4pm6HuTdukUT3gqNKraD1huCJhS \
  --amounts 26666666.666666662,116666.666667 \
  --mints STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1,FeCtM4bXUGo8vGrvHUCZjybmesovZLkQqCGqMuhHUHfZ

# STB40-PSOL35-USDC25
# Pool: E19KQr8pBnZn5C2oefC3JMCqvyn2QqdCHuroxew1R1Zr
# Mint: 6RX8gWNHpauYTAHftLbXKwef8erUFGwE29e1bZW3Pqtv
yarn cli pool-weighted-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k TxMkrJ8Nn9qLxM4FHmCbm957nf6264VL6bov1F2daxq \
  --swap-fee 0.005 \
  --weights 0.4,0.35,0.25 \
  --mints STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1,HK3Q8SJYiV1kLo3b6vfwLnL45nhunnt4kSBVQNa3Z28J,AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX

yarn cli pool-weighted-deposit \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --pool-k E19KQr8pBnZn5C2oefC3JMCqvyn2QqdCHuroxew1R1Zr \
  --amounts 1828571.428571429,280000,20000 \
  --mints STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1,HK3Q8SJYiV1kLo3b6vfwLnL45nhunnt4kSBVQNa3Z28J,AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX

# USDH-USDT-USDC
# Pool: 4bJ6m57f6ugoy5ANqtdPz1QPFoVNQTENa4k4BQhQ6K2K
# Mint: BZujQEGsSuK3JddRDEyCAGNvm3RmTsPeBhJPZE8qk1EA
yarn cli pool-stable-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k 8MVYa7EoyUMgsXVSoYDdpj94oFV5Vo7Er8JptJo9wmsB \
  --swap-fee 0.005 \
  --amp 500 \
  --mints HhskQmZneTQem7QzaeZQ2q1baz9LCrngBMrWgM5jetPz,FeCtM4bXUGo8vGrvHUCZjybmesovZLkQqCGqMuhHUHfZ,AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX

yarn cli pool-stable-deposit \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --pool-k 4bJ6m57f6ugoy5ANqtdPz1QPFoVNQTENa4k4BQhQ6K2K \
  --amounts 200000,200000,200000 \
  --mints HhskQmZneTQem7QzaeZQ2q1baz9LCrngBMrWgM5jetPz,FeCtM4bXUGo8vGrvHUCZjybmesovZLkQqCGqMuhHUHfZ,AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX

# USH-USDC
# Pool: BnYsLJsMY3M5Nw6EsG6WoDiHHZjnY7hC9DKW7BmL8fhm
# Mint: 2RvHCdmgUPsz7R8BTFQumu9hF1wbUiU7df6vwi3rcuwu
yarn cli pool-stable-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k 8MVYa7EoyUMgsXVSoYDdpj94oFV5Vo7Er8JptJo9wmsB \
  --swap-fee 0.0004 \
  --amp 100 \
  --mints 8anyQR9CrzDHap8gm9YRymvEoFUzy71yd5MygQVQ4hVB,AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX

yarn cli pool-stable-deposit \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --pool-k BnYsLJsMY3M5Nw6EsG6WoDiHHZjnY7hC9DKW7BmL8fhm \
  --amounts 63052.01,21875.76 \
  --mints 8anyQR9CrzDHap8gm9YRymvEoFUzy71yd5MygQVQ4hVB,AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX

# USDT-USDC
# Pool: EFCjUhXAbtRY5oC2TBoTp15jr8e58d2x2WvnZCAZbzwV
# Mint: FAmYe4ENxG4VXmv68XsEu5UA4YzyoWz5huJXLdLk7BPW
yarn cli pool-stable-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k 8MVYa7EoyUMgsXVSoYDdpj94oFV5Vo7Er8JptJo9wmsB \
  --swap-fee 0.005 \
  --amp 5000 \
  --mints FeCtM4bXUGo8vGrvHUCZjybmesovZLkQqCGqMuhHUHfZ,AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX

yarn cli pool-stable-deposit \
  -u https://twilight-necessary-liquid.solana-devnet.quiknode.pro/2bfc6e7fb487a78fb5ef6811fd89954567629035/ \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --pool-k EFCjUhXAbtRY5oC2TBoTp15jr8e58d2x2WvnZCAZbzwV \
  --amounts 821588.3,386525.6 \
  --mints FeCtM4bXUGo8vGrvHUCZjybmesovZLkQqCGqMuhHUHfZ,AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX
