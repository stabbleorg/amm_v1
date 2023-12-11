#!/bin/bash

anchor build --arch sbf

# SLR
solana program deploy -u devnet --skip-fee-check \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id 88eN7xkpWwyCrtVAuhuKtVLkmuSEFv6MgTkpAodvpd31 \
  ./target/deploy/slr.so

anchor idl upgrade -f target/idl/slr.json \
  --provider.cluster devnet \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  88eN7xkpWwyCrtVAuhuKtVLkmuSEFv6MgTkpAodvpd31

# Vault
solana program deploy -u devnet --skip-fee-check \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id 7oh6tTdSfoWdKgqFXotGtPfS3Gqk6Jwc2yDZ7NCErYLW \
  ./target/deploy/vault.so

anchor idl upgrade -f target/idl/vault.json \
  --provider.cluster devnet \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  7oh6tTdSfoWdKgqFXotGtPfS3Gqk6Jwc2yDZ7NCErYLW

# Pool Weighted
solana program deploy -u devnet --skip-fee-check \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id keypairs/programs/pool-weighted.json \
  ./target/deploy/pool_weighted.so

anchor idl init -f target/idl/pool_weighted.json \
  --provider.cluster devnet \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  BQnZgt5MrNEnMyB2LhBbmJUuF2hoRu5Cf1yXcLTRaJEZ

# Pool Stable
solana program deploy -u devnet --skip-fee-check \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --upgrade-authority ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --program-id keypairs/programs/pool-stable.json \
  ./target/deploy/pool_stable.so

anchor idl init -f target/idl/pool_stable.json \
  --provider.cluster devnet \
  --provider.wallet ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  BGJ7Ra51bCSLfJTzXXQsx6Mc8KYuzBnvG2JuUgkp454a

# Weighted: 9XjzkNWouCZsdwQ3uQ9LLyfVKq3yNmWC12bmApSoywbF
yarn cli vault-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k-p keypairs/vault-weighted.json \
  --pool-kind weighted \
  --beneficiary-k 77a8316JgKH9b5Y69uhGJDysD4wya3hxLmcgjugPpN1p \
  --beneficiary-fee 0.22

# Stable: 5eCVujqt76MtEaz9oCknwPqj8atA8XwtE1V22eprVrbz
yarn cli vault-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k-p keypairs/vault-stable.json \
  --pool-kind stable \
  --beneficiary-k 77a8316JgKH9b5Y69uhGJDysD4wya3hxLmcgjugPpN1p \
  --beneficiary-fee 0.22

# STB70-USDC30
# Pool: 5CVwLg7FoDSpYqdRdTNc98YTpdz8godWv5f6FGCryarL
yarn cli pool-weighted-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k 9XjzkNWouCZsdwQ3uQ9LLyfVKq3yNmWC12bmApSoywbF \
  --mints STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1 AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --weights 0.7 0.3 \
  --swap-fee 0.001

yarn cli pool-weighted-deposit \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --pool-k 5CVwLg7FoDSpYqdRdTNc98YTpdz8godWv5f6FGCryarL \
  --mints STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1 AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --amounts 39999999.999999993 300000

# STB80-USDT20
# Pool: BULJBb32S2ai5Yps2q3kgx4RGzpDQsskxQ2s9jEz18NS
yarn cli pool-weighted-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k 9XjzkNWouCZsdwQ3uQ9LLyfVKq3yNmWC12bmApSoywbF \
  --mints STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1 FeCtM4bXUGo8vGrvHUCZjybmesovZLkQqCGqMuhHUHfZ \
  --weights 0.8 0.2 \
  --swap-fee 0.001

yarn cli pool-weighted-deposit \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --pool-k BULJBb32S2ai5Yps2q3kgx4RGzpDQsskxQ2s9jEz18NS \
  --mints STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1 FeCtM4bXUGo8vGrvHUCZjybmesovZLkQqCGqMuhHUHfZ \
  --amounts 39999999.999999993 175000

# Bonk50-STB20-USDC30
# Pool: CHqnje9EfjzhBupPerzJYuNsRvNTy8GG17WKtThCy4wS
yarn cli pool-weighted-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k 9XjzkNWouCZsdwQ3uQ9LLyfVKq3yNmWC12bmApSoywbF \
  --mints C6nokjAzpaEWa3zor751WnM6gqJvrhBngxxBSFWWVqGs STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1 AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --weights 0.5 0.2 0.3 \
  --swap-fee 0.002 \
  --ticks 1 0.000000001 0.000001

yarn cli pool-weighted-deposit \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --pool-k CHqnje9EfjzhBupPerzJYuNsRvNTy8GG17WKtThCy4wS \
  --mints C6nokjAzpaEWa3zor751WnM6gqJvrhBngxxBSFWWVqGs STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1 AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --amounts 71215940976.22812 11428571.42857143 300000

# USDT-USDC
# Pool: 2W5WBB84Sj9sChysqBpQ6psb1uFsnn1keWcfK9UDBoNB
yarn cli pool-stable-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k 5eCVujqt76MtEaz9oCknwPqj8atA8XwtE1V22eprVrbz \
  --mints FeCtM4bXUGo8vGrvHUCZjybmesovZLkQqCGqMuhHUHfZ AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --amp 5000 \
  --swap-fee 0.0001

yarn cli pool-stable-deposit \
  -u https://twilight-necessary-liquid.solana-devnet.quiknode.pro/2bfc6e7fb487a78fb5ef6811fd89954567629035/ \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --pool-k 2W5WBB84Sj9sChysqBpQ6psb1uFsnn1keWcfK9UDBoNB \
  --mints FeCtM4bXUGo8vGrvHUCZjybmesovZLkQqCGqMuhHUHfZ AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --amounts 821588.3 386525.6

# UXD-USDC
# Pool: Ap5Dsn8ey15v9kP7A6S1dsvk1AdRJHhRFziR6hvLnYUM
yarn cli pool-stable-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k 5eCVujqt76MtEaz9oCknwPqj8atA8XwtE1V22eprVrbz \
  --mints 94w5e3aQfc2DR3CuvAgr9XZXGpyMghznPqPWo2UFUuDU AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --amp 400 \
  --swap-fee 0.0002

yarn cli pool-stable-deposit \
  -u https://twilight-necessary-liquid.solana-devnet.quiknode.pro/2bfc6e7fb487a78fb5ef6811fd89954567629035/ \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --pool-k Ap5Dsn8ey15v9kP7A6S1dsvk1AdRJHhRFziR6hvLnYUM \
  --mints 94w5e3aQfc2DR3CuvAgr9XZXGpyMghznPqPWo2UFUuDU AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --amounts 4236919 4081940

# USH-USDC
# Pool: 3wvwQVrFf5jakBSsSDna8CzPveoHhHSuQJaa5yWJirUY
yarn cli pool-stable-init \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --vault-k 5eCVujqt76MtEaz9oCknwPqj8atA8XwtE1V22eprVrbz \
  --mints 8anyQR9CrzDHap8gm9YRymvEoFUzy71yd5MygQVQ4hVB AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --amp 100 \
  --swap-fee 0.0004

yarn cli pool-stable-deposit \
  -k ~/.config/solana/7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma.json \
  --pool-k 3wvwQVrFf5jakBSsSDna8CzPveoHhHSuQJaa5yWJirUY \
  --mints 8anyQR9CrzDHap8gm9YRymvEoFUzy71yd5MygQVQ4hVB AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX \
  --amounts 63052.01 21875.76

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
