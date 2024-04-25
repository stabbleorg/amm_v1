import { assert } from "chai";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  VaultContext,
  WeightedSwapContext,
  StableSwapContext,
  Vault,
  WeightedPool,
  StablePool,
  WeightedMath,
  SafeNumber,
} from "@stabbleorg/amm-sdk";
import {
  WEIGHTED_VAULT_KP,
  STABLE_VAULT_KP,
  MINT_AUTH_KP,
  USDC_MINT_KP,
  USDT_MINT_KP,
  DAI_MINT_KP,
  STB_MINT_KP,
  BONK_MINT_KP,
} from "./consts";

describe("Pool", () => {
  const provider = AnchorProvider.env();
  provider.opts.commitment = "confirmed";
  provider.opts.maxRetries = 1;
  provider.opts.preflightCommitment = "confirmed";
  provider.opts.skipPreflight = true;

  const vaultCtx = new VaultContext(provider);
  const weightedSwap = new WeightedSwapContext(provider);
  const stableSwap = new StableSwapContext(provider);

  let weightedVault: Vault;
  let stableVault: Vault;

  let POOL_ID_STB_USDC: PublicKey;
  let POOL_ID_USDT_USDC: PublicKey;

  before(async () => {
    const vaults = await vaultCtx.findAll();
    weightedVault = vaults.find((vault) => vault.address.equals(WEIGHTED_VAULT_KP.publicKey))!;
    stableVault = vaults.find((vault) => vault.address.equals(STABLE_VAULT_KP.publicKey))!;
  });

  describe("STB50-USDC50", () => {
    it("should create weighted pool", async () => {
      const mintAddresses = [BONK_MINT_KP.publicKey, USDC_MINT_KP.publicKey];

      const { pool } = await weightedSwap.initialize({
        vault: weightedVault,
        mintAddresses,
        maxCaps: [500000000, 2000000],
        weights: [0.5, "0.5"], // 50:50
        swapFee: "0.005", // 0.5%
      });
      POOL_ID_STB_USDC = pool.address;

      // STB: $0.03, USDC: $1
      const bRatio_STB_USDC = WeightedMath.calcBalanceRatio(0.5, 0.03, 0.5, 1);
      const usdcAmount = 1000000;
      const stbAmount = usdcAmount * bRatio_STB_USDC;

      await vaultCtx.createMissingTokenAccounts({ vault: weightedVault, mintAddresses });

      // add initial liquidity
      await weightedSwap.deposit({
        pool,
        mintAddresses,
        amounts: [stbAmount, usdcAmount],
      });
    });

    it("should deposit in balance", async () => {
      const pools = await weightedSwap.findByVault(weightedVault);
      const pool = pools.find((pool) => pool.address.equals(POOL_ID_STB_USDC))!;

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(pool.mintAddress),
      );

      const mintAddresses = pool.tokens.map((token) => token.mintAddress);
      const bRatio_STB_USDC = pool.tokens[0].balance / pool.tokens[1].balance;
      const usdcAmount = 10000;
      const stbAmount = usdcAmount * bRatio_STB_USDC;

      // add liquidity
      await weightedSwap.deposit({
        pool,
        mintAddresses,
        amounts: [stbAmount, usdcAmount],
      });

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(pool.mintAddress),
      );

      const ratio = balance.uiAmount! / (postBalance.uiAmount! - balance.uiAmount!);

      assert.ok(ratio > 99.99998);
      assert.ok(ratio < 100.00002);
    });
  });

  describe("USDT-USDC", () => {
    it("should create stable pool", async () => {
      const mintAddresses = [USDT_MINT_KP.publicKey, USDC_MINT_KP.publicKey];
      const ampFactor = 5000;

      const { pool } = await stableSwap.initialize({
        vault: stableVault,
        mintAddresses,
        maxCaps: [3000000000, 3000000000],
        ampFactor,
        swapFee: "0.0001", // 0.01%
      });
      POOL_ID_USDT_USDC = pool.address;

      await vaultCtx.createMissingTokenAccounts({ vault: stableVault, mintAddresses });

      // add initial liquidity
      await stableSwap.deposit({
        pool,
        mintAddresses,
        amounts: ["3165522.820842", "771061.758046"],
      });

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(pool.mintAddress),
      );
      console.log("LP out:", balance);
    });
  });

  // describe("DAI-USDT-USDC", () => {
  //   it("should create stable pool", async () => {
  //     const { transaction: createTX, address: poolAddress } = await amm.createStablePoolAndAddress({
  //       vaultAddress: stableVaultKP.publicKey,
  //       mintAddresses: [daiMintKP.publicKey, usdtMintKP.publicKey, usdcMintKP.publicKey],
  //       amp: 2000,
  //       swapFee: "0.004", // 0.4%
  //       poolKP: stableN3PoolKP, // can omit in dapp
  //     });
  //     await ctxStable.provider.sendAndConfirm(createTX);

  //     // add initial liquidity
  //     const pool = await ctxStable.findOne(poolAddress);
  //     const { transaction } = await amm.deposit({
  //       pool,
  //       mintAddresses: pool.tokens.map((token) => token.mintAddress),
  //       amounts: [40000, 30000, 20000],
  //     });
  //     await ctxStable.provider.sendAndConfirm(transaction);

  //     const { value: balance } = await provider.connection.getTokenAccountBalance(
  //       ctxStable.getAssociatedTokenAddress(pool.mintAddress),
  //     );
  //     console.log("LP out:", balance.uiAmountString!);
  //   });

  //   it("should add liquidity in balance", async () => {
  //     const pool = await ctxStable.findOne(stableN3PoolKP.publicKey); // selected pool address in dapp
  //     const bRatio_DAI_USDC = pool.tokens[0].balance / pool.tokens[2].balance;
  //     const bRatio_USDT_USDC = pool.tokens[1].balance / pool.tokens[2].balance;
  //     // console.log("DAI/USDC:", bRatio_DAI_USDC);
  //     // console.log("USDT/USDC:", bRatio_USDT_USDC);

  //     // given 200 USDC
  //     const usdcAmount = 200;
  //     const daiAmount = usdcAmount * bRatio_DAI_USDC;
  //     const usdtAmount = usdcAmount * bRatio_USDT_USDC;

  //     const { value: balance } = await provider.connection.getTokenAccountBalance(
  //       ctxStable.getAssociatedTokenAddress(pool.mintAddress),
  //     );

  //     const { transaction } = await amm.deposit({
  //       pool,
  //       mintAddresses: pool.tokens.map((token) => token.mintAddress),
  //       amounts: [daiAmount, usdtAmount, usdcAmount],
  //     });
  //     await ctxStable.provider.sendAndConfirm(transaction);

  //     const { value: postBalance } = await provider.connection.getTokenAccountBalance(
  //       ctxStable.getAssociatedTokenAddress(pool.mintAddress),
  //     );
  //     console.log(
  //       "LP out:",
  //       SafeNumber.toUiAmountString(new BN(postBalance.amount!).sub(new BN(balance.amount!)), postBalance.decimals),
  //     );
  //   });

  //   it("should add liquidity in single token", async () => {
  //     const pool = await ctxStable.findOne(stableN3PoolKP.publicKey); // selected pool address in dapp

  //     const { value: balance } = await provider.connection.getTokenAccountBalance(
  //       ctxStable.getAssociatedTokenAddress(pool.mintAddress),
  //     );
  //     const { transaction } = await amm.deposit({
  //       pool,
  //       mintAddresses: [usdcMintKP.publicKey],
  //       amounts: [900],
  //     });
  //     await ctxStable.provider.sendAndConfirm(transaction);

  //     const { value: postBalance } = await provider.connection.getTokenAccountBalance(
  //       ctxStable.getAssociatedTokenAddress(pool.mintAddress),
  //     );
  //     console.log(
  //       "LP out:",
  //       SafeNumber.toUiAmountString(new BN(postBalance.amount!).sub(new BN(balance.amount!)), postBalance.decimals),
  //     );
  //   });

  //   it("should remove liquidity in single token", async () => {
  //     const pool = await ctxStable.findOne(stableN3PoolKP.publicKey); // selected pool address in dapp

  //     const { value: balance } = await provider.connection.getTokenAccountBalance(
  //       ctxStable.getAssociatedTokenAddress(usdcMintKP.publicKey),
  //     );
  //     const { transaction } = await amm.withdraw({
  //       pool,
  //       mintAddresses: [usdcMintKP.publicKey],
  //       amount: "897.420287765",
  //     });
  //     await ctxStable.provider.sendAndConfirm(transaction);

  //     const { value: postBalance } = await provider.connection.getTokenAccountBalance(
  //       ctxStable.getAssociatedTokenAddress(usdcMintKP.publicKey),
  //     );
  //     console.log(
  //       "USDC out:",
  //       SafeNumber.toUiAmountString(new BN(postBalance.amount!).sub(new BN(balance.amount!)), postBalance.decimals),
  //     );
  //   });
  // });
});
