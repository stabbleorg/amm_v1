import { BN } from "bn.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  VaultContext,
  WeightedPoolContext,
  StablePoolContext,
  WeightedMath,
  SDKWrapper,
  TokenAmountUtil,
} from "@stabbleorg/solana-sdk";
import {
  weightedVaultKP,
  weightedN3PoolKP,
  stableVaultKP,
  stableN3PoolKP,
  adminKP,
  stbMintKP,
  sbrMintKP,
  usdcMintKP,
  usdtMintKP,
  daiMintKP,
} from "./consts";

describe("Pool", () => {
  const provider = AnchorProvider.env();
  const ctxVault = new VaultContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const ctxWeighted = new WeightedPoolContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const ctxStable = new StablePoolContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const sdk = new SDKWrapper({
    vault: ctxVault,
    weighted: ctxWeighted,
    stable: ctxStable,
  });

  describe("STB50-SBR30-USDC20", () => {
    it("should create weighted pool", async () => {
      // STB: $0.0175, SBR: $0.001, USDC: $1
      const bRatio_STB_USDC = WeightedMath.calcBalanceRatio(0.5, 0.0175, 0.2, 1);
      const bRatio_SBR_USDC = WeightedMath.calcBalanceRatio(0.3, 0.001, 0.2, 1);
      // console.log("STB50/USDC20:", bRatio_STB_USDC);
      // console.log("SBR30/USDC20:", bRatio_SBR_USDC);

      // Given 50,000 USDC
      const usdcAmount = 50000;
      const stbAmount = usdcAmount * bRatio_STB_USDC;
      const sbrAmount = usdcAmount * bRatio_SBR_USDC;

      const { tx: createTX, address: poolAddress } = await sdk.createWeightedPoolAndAddress({
        vaultAddress: weightedVaultKP.publicKey,
        mintAddresses: [stbMintKP.publicKey, sbrMintKP.publicKey, usdcMintKP.publicKey],
        weights: ["0.5", 0.3, 0.2], // either in string or in number
        swapFee: 0.0125, // 1.25%
        poolKP: weightedN3PoolKP, // can be omit in dapp
      });
      await ctxWeighted.provider.sendAndConfirm(createTX);

      // add initial liquidity
      const pool = await ctxWeighted.findOne(poolAddress);
      const tx = await sdk.addLiquidity({
        pool,
        mintAddresses: pool.tokens.map((token) => token.mintAddress),
        amounts: [stbAmount, sbrAmount, usdcAmount],
      });
      await ctxWeighted.provider.sendAndConfirm(tx);

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        ctxWeighted.getAssociatedTokenAddress(pool.mintAddress),
      );
      console.log("LP out:", balance.uiAmountString);
    });

    it("should add liquidity in balance", async () => {
      const pool = await ctxWeighted.findOne(weightedN3PoolKP.publicKey); // selected pool address in dapp
      const bRatio_STB_USDC = pool.tokens[0].balance / pool.tokens[2].balance;
      const bRatio_SBR_USDC = pool.tokens[1].balance / pool.tokens[2].balance;
      // console.log("STB50/USDC20:", bRatio_STB_USDC);
      // console.log("SBR30/USDC20:", bRatio_SBR_USDC);

      // Given 500 USDC
      const usdcAmount = 500;
      const stbAmount = usdcAmount * bRatio_STB_USDC;
      const sbrAmount = usdcAmount * bRatio_SBR_USDC;

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        ctxWeighted.getAssociatedTokenAddress(pool.mintAddress),
      );
      const tx = await sdk.addLiquidity({
        pool,
        mintAddresses: pool.tokens.map((token) => token.mintAddress),
        amounts: [stbAmount, sbrAmount, usdcAmount],
      });
      await ctxWeighted.provider.sendAndConfirm(tx);

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        ctxWeighted.getAssociatedTokenAddress(pool.mintAddress),
      );
      console.log(
        "LP out:",
        TokenAmountUtil.toUiAmountString(
          new BN(postBalance.amount!).sub(new BN(balance.amount!)),
          postBalance.decimals,
        ),
      );
    });

    it("should add liquidity in single token", async () => {
      const pool = await ctxWeighted.findOne(weightedN3PoolKP.publicKey); // selected pool address in dapp

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        ctxWeighted.getAssociatedTokenAddress(pool.mintAddress),
      );
      const tx = await sdk.addLiquidity({
        pool,
        mintAddresses: [usdcMintKP.publicKey],
        amounts: ["2500"],
      });
      await ctxWeighted.provider.sendAndConfirm(tx);

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        ctxWeighted.getAssociatedTokenAddress(pool.mintAddress),
      );
      console.log(
        "LP out:",
        TokenAmountUtil.toUiAmountString(
          new BN(postBalance.amount!).sub(new BN(balance.amount!)),
          postBalance.decimals,
        ),
      );
    });

    it("should remove liquidity in single token", async () => {
      const pool = await ctxWeighted.findOne(weightedN3PoolKP.publicKey); // selected pool address in dapp

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        ctxWeighted.getAssociatedTokenAddress(usdcMintKP.publicKey),
      );
      const tx = await sdk.removeLiquidity({
        pool,
        mintAddresses: [usdcMintKP.publicKey],
        amount: "164163.651935620",
      });
      await ctxWeighted.provider.sendAndConfirm(tx);

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        ctxWeighted.getAssociatedTokenAddress(usdcMintKP.publicKey),
      );
      console.log(
        "USDC out:",
        TokenAmountUtil.toUiAmountString(
          new BN(postBalance.amount!).sub(new BN(balance.amount!)),
          postBalance.decimals,
        ),
      );
    });
  });

  describe("DAI-USDT-USDC", () => {
    it("should create stable pool", async () => {
      const { tx: createTX, address: poolAddress } = await sdk.createStablePoolAndAddress({
        vaultAddress: stableVaultKP.publicKey,
        mintAddresses: [daiMintKP.publicKey, usdtMintKP.publicKey, usdcMintKP.publicKey],
        amp: 2000,
        swapFee: "0.004", // 0.4%
        poolKP: stableN3PoolKP, // can be omit in dapp
      });
      await ctxStable.provider.sendAndConfirm(createTX);

      // add initial liquidity
      const pool = await ctxStable.findOne(poolAddress);
      const tx = await sdk.addLiquidity({
        pool,
        mintAddresses: pool.tokens.map((token) => token.mintAddress),
        amounts: [40000, 30000, 20000],
      });
      await ctxStable.provider.sendAndConfirm(tx);

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        ctxStable.getAssociatedTokenAddress(pool.mintAddress),
      );
      console.log("LP out:", balance.uiAmountString!);
    });

    it("should add liquidity in balance", async () => {
      const pool = await ctxStable.findOne(stableN3PoolKP.publicKey); // selected pool address in dapp
      const bRatio_DAI_USDC = pool.tokens[0].balance / pool.tokens[2].balance;
      const bRatio_USDT_USDC = pool.tokens[1].balance / pool.tokens[2].balance;
      // console.log("DAI/USDC:", bRatio_DAI_USDC);
      // console.log("USDT/USDC:", bRatio_USDT_USDC);

      // Given 200 USDC
      const usdcAmount = 200;
      const daiAmount = usdcAmount * bRatio_DAI_USDC;
      const usdtAmount = usdcAmount * bRatio_USDT_USDC;

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        ctxStable.getAssociatedTokenAddress(pool.mintAddress),
      );
      const tx = await sdk.addLiquidity({
        pool,
        mintAddresses: pool.tokens.map((token) => token.mintAddress),
        amounts: [daiAmount, usdtAmount, usdcAmount],
      });
      await ctxStable.provider.sendAndConfirm(tx);

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        ctxStable.getAssociatedTokenAddress(pool.mintAddress),
      );
      console.log(
        "LP out:",
        TokenAmountUtil.toUiAmountString(
          new BN(postBalance.amount!).sub(new BN(balance.amount!)),
          postBalance.decimals,
        ),
      );
    });

    it("should add liquidity in single token", async () => {
      const pool = await ctxStable.findOne(stableN3PoolKP.publicKey); // selected pool address in dapp

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        ctxStable.getAssociatedTokenAddress(pool.mintAddress),
      );
      const tx = await sdk.addLiquidity({
        pool,
        mintAddresses: [usdcMintKP.publicKey],
        amounts: [900],
      });
      await ctxStable.provider.sendAndConfirm(tx);

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        ctxStable.getAssociatedTokenAddress(pool.mintAddress),
      );
      console.log(
        "LP out:",
        TokenAmountUtil.toUiAmountString(
          new BN(postBalance.amount!).sub(new BN(balance.amount!)),
          postBalance.decimals,
        ),
      );
    });

    it("should remove liquidity in single token", async () => {
      const pool = await ctxStable.findOne(stableN3PoolKP.publicKey); // selected pool address in dapp

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        ctxStable.getAssociatedTokenAddress(usdcMintKP.publicKey),
      );
      const tx = await sdk.removeLiquidity({
        pool,
        mintAddresses: [usdcMintKP.publicKey],
        amount: "897.420287765",
      });
      await ctxStable.provider.sendAndConfirm(tx);

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        ctxStable.getAssociatedTokenAddress(usdcMintKP.publicKey),
      );
      console.log(
        "USDC out:",
        TokenAmountUtil.toUiAmountString(
          new BN(postBalance.amount!).sub(new BN(balance.amount!)),
          postBalance.decimals,
        ),
      );
    });
  });
});
