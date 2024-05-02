# stabble AMM CLI

## Vault

### Initialize

```bash
# Initialize a vault for weighted_swap
yarn cli vault-init -u devnet -p HELIUS_API_KEY \
  -k admin.json \
  --vault-k-p w8edo9a9TDw52c1rBmVbP6dNakaAuFiPjDd52ZJwwVi.json \
  --kind weighted_swap \
  --beneficiary-k HsBK1f1MwPb7fH3CcbQbunSHLuXho3yPqTz4TyuL1bLS \
  --beneficiary-fee 0.14

# Initialize a vault for stable_swap
yarn cli vault-init -u devnet -p HELIUS_API_KEY \
  -k admin.json \
  --vault-k-p stab1io8dHvK26KoHmTwwHyYmHRbUWbyEJx6CdrGabC.json \
  --kind stable_swap \
  --beneficiary-k HsBK1f1MwPb7fH3CcbQbunSHLuXho3yPqTz4TyuL1bLS \
  --beneficiary-fee 0.14
```

### Dump a report for vault balances

```bash
yarn cli vault-check -u devnet -p HELIUS_API_KEY
```
