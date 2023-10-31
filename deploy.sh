#!/bin/bash

anchor build --arch sbf

# SLR
solana program deploy -u devnet --skip-fee-check \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id ./keypairs/slr.json \
  --max-len 512000 \
  ./target/deploy/slr.so

anchor idl upgrade -f target/idl/slr.json \
  --provider.cluster devnet \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  88eN7xkpWwyCrtVAuhuKtVLkmuSEFv6MgTkpAodvpd31

# Vault
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

# Pool Weighted
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

# Pool Stable
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
  --mints STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1 AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --weights 0.7 0.3 \
  --swap-fee 0.005

yarn cli pool-weighted-deposit \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --pool-k 5waHmrTZoNZBysSXfvgzYkXmkGkpbRBtHCQzFiSDnrh7 \
  --mints STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1 AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --amounts 26666666.666666662 200000

# STB80-USDT20
# Pool: HqYNu4hXRJuFBmiXD4pm6HuTdukUT3gqNKraD1huCJhS
# Mint: Hk7QqKJQmJhVnYw6q1deQS6LDw6KLms8HBqor9bpBMRq
yarn cli pool-weighted-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k TxMkrJ8Nn9qLxM4FHmCbm957nf6264VL6bov1F2daxq \
  --mints STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1 FeCtM4bXUGo8vGrvHUCZjybmesovZLkQqCGqMuhHUHfZ \
  --weights 0.8 0.2 \
  --swap-fee 0.005

yarn cli pool-weighted-deposit \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --pool-k HqYNu4hXRJuFBmiXD4pm6HuTdukUT3gqNKraD1huCJhS \
  --mints STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1 FeCtM4bXUGo8vGrvHUCZjybmesovZLkQqCGqMuhHUHfZ \
  --amounts 26666666.666666662 116666.666667

# STB40-PSOL35-USDC25
# Pool: E19KQr8pBnZn5C2oefC3JMCqvyn2QqdCHuroxew1R1Zr
# Mint: 6RX8gWNHpauYTAHftLbXKwef8erUFGwE29e1bZW3Pqtv
yarn cli pool-weighted-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k TxMkrJ8Nn9qLxM4FHmCbm957nf6264VL6bov1F2daxq \
  --mints STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1 HK3Q8SJYiV1kLo3b6vfwLnL45nhunnt4kSBVQNa3Z28J AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --weights 0.4 0.35 0.25 \
  --swap-fee 0.005

yarn cli pool-weighted-deposit \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --pool-k E19KQr8pBnZn5C2oefC3JMCqvyn2QqdCHuroxew1R1Zr \
  --mints STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1 HK3Q8SJYiV1kLo3b6vfwLnL45nhunnt4kSBVQNa3Z28J AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --amounts 1828571.428571429 280000 20000

# USDH-USDT-USDC
# Pool: 4bJ6m57f6ugoy5ANqtdPz1QPFoVNQTENa4k4BQhQ6K2K
# Mint: BZujQEGsSuK3JddRDEyCAGNvm3RmTsPeBhJPZE8qk1EA
yarn cli pool-stable-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k 8MVYa7EoyUMgsXVSoYDdpj94oFV5Vo7Er8JptJo9wmsB \
  --mints HhskQmZneTQem7QzaeZQ2q1baz9LCrngBMrWgM5jetPz FeCtM4bXUGo8vGrvHUCZjybmesovZLkQqCGqMuhHUHfZ AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --amp 500 \
  --swap-fee 0.005

yarn cli pool-stable-deposit \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --pool-k 4bJ6m57f6ugoy5ANqtdPz1QPFoVNQTENa4k4BQhQ6K2K \
  --mints HhskQmZneTQem7QzaeZQ2q1baz9LCrngBMrWgM5jetPz FeCtM4bXUGo8vGrvHUCZjybmesovZLkQqCGqMuhHUHfZ AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --amounts 200000 200000 200000

# USH-USDC
# Pool: BnYsLJsMY3M5Nw6EsG6WoDiHHZjnY7hC9DKW7BmL8fhm
# Mint: 2RvHCdmgUPsz7R8BTFQumu9hF1wbUiU7df6vwi3rcuwu
yarn cli pool-stable-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k 8MVYa7EoyUMgsXVSoYDdpj94oFV5Vo7Er8JptJo9wmsB \
  --mints 8anyQR9CrzDHap8gm9YRymvEoFUzy71yd5MygQVQ4hVB AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --amp 100 \
  --swap-fee 0.0004

yarn cli pool-stable-deposit \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --pool-k BnYsLJsMY3M5Nw6EsG6WoDiHHZjnY7hC9DKW7BmL8fhm \
  --mints 8anyQR9CrzDHap8gm9YRymvEoFUzy71yd5MygQVQ4hVB AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --amounts 63052.01 21875.76

# USDT-USDC
# Pool: EFCjUhXAbtRY5oC2TBoTp15jr8e58d2x2WvnZCAZbzwV
# Mint: FAmYe4ENxG4VXmv68XsEu5UA4YzyoWz5huJXLdLk7BPW
yarn cli pool-stable-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k 8MVYa7EoyUMgsXVSoYDdpj94oFV5Vo7Er8JptJo9wmsB \
  --mints FeCtM4bXUGo8vGrvHUCZjybmesovZLkQqCGqMuhHUHfZ AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --amp 5000 \
  --swap-fee 0.005

yarn cli pool-stable-deposit \
  -u https://twilight-necessary-liquid.solana-devnet.quiknode.pro/2bfc6e7fb487a78fb5ef6811fd89954567629035/ \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --pool-k EFCjUhXAbtRY5oC2TBoTp15jr8e58d2x2WvnZCAZbzwV \
  --mints FeCtM4bXUGo8vGrvHUCZjybmesovZLkQqCGqMuhHUHfZ AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --amounts 821588.3 386525.6

# USDC (SLR)
# Pool: DuyBdvKBfyzTk43rPiBme8PckHU8RnW1oDPmD6rz93Zp
# Mint: HEGgkKLQhjfmZe3GyHup9W7vS7PPg3v7LyejTZsv3644
yarn cli slr-init \
  -u https://twilight-necessary-liquid.solana-devnet.quiknode.pro/2bfc6e7fb487a78fb5ef6811fd89954567629035/ \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --underlying-mint-k AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --max-liquidity 200000

# USDT (SLR)
# Pool: xjvxKg5Q5d9sqRdsyUxA2QFjMDG1HpneqDnMvomSGFW
# Mint: 9qpciUarFEJfGW3ocABvfBUpeqAcCUGz4Wg6SZHLzyZ1
yarn cli slr-init \
  -u https://twilight-necessary-liquid.solana-devnet.quiknode.pro/2bfc6e7fb487a78fb5ef6811fd89954567629035/ \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --underlying-mint-k FeCtM4bXUGo8vGrvHUCZjybmesovZLkQqCGqMuhHUHfZ \
  --max-liquidity 200000
