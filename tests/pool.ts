import { BN } from "bn.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  VaultContext,
  WeightedPoolContext,
  StablePoolContext,
  WeightedMath,
  Amm,
  SafeNumber,
} from "@stabbleorg/solana-sdk";
import {
  weightedVaultKP,
  stableVaultKP,
  weightedN3PoolKP,
  weightedN2PoolKP,
  stableN3PoolKP,
  adminKP,
  stbMintKP,
  sbrMintKP,
  bonkMintKP,
  usdcMintKP,
  usdtMintKP,
  daiMintKP,
  stableN2PoolKP,
} from "./consts";

describe("Pool", () => {
  const provider = AnchorProvider.env();
  const ctxVault = new VaultContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const ctxWeighted = new WeightedPoolContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const ctxStable = new StablePoolContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const amm = new Amm({
    vault: ctxVault,
    weighted: ctxWeighted,
    stable: ctxStable,
  });

  // describe("STB50-SBR30-USDC20", () => {
  //   it("should create weighted pool", async () => {
  //     // STB: $0.0175, SBR: $0.001, USDC: $1
  //     const bRatio_STB_USDC = WeightedMath.calcBalanceRatio(0.5, 0.0175, 0.2, 1);
  //     const bRatio_SBR_USDC = WeightedMath.calcBalanceRatio(0.3, 0.001, 0.2, 1);
  //     // console.log("STB50/USDC20:", bRatio_STB_USDC);
  //     // console.log("SBR30/USDC20:", bRatio_SBR_USDC);

  //     // given 50,000 USDC
  //     const usdcAmount = 50000;
  //     const stbAmount = usdcAmount * bRatio_STB_USDC;
  //     const sbrAmount = usdcAmount * bRatio_SBR_USDC;

  //     const { tx: createTX, address: poolAddress } = await amm.createWeightedPoolAndAddress({
  //       vaultAddress: weightedVaultKP.publicKey,
  //       mintAddresses: [stbMintKP.publicKey, sbrMintKP.publicKey, usdcMintKP.publicKey],
  //       swapFee: 0.0125, // 1.25%
  //       weights: ["0.5", 0.3, 0.2], // either in string or in number
  //       poolKP: weightedN3PoolKP, // can omit in dapp
  //     });
  //     await ctxWeighted.provider.sendAndConfirm(createTX);

  //     // add initial liquidity
  //     const pool = await ctxWeighted.findOne(poolAddress);
  //     const { tx } = await amm.deposit({
  //       pool,
  //       mintAddresses: pool.tokens.map((token) => token.mintAddress),
  //       amounts: [stbAmount, sbrAmount, usdcAmount],
  //     });
  //     await ctxWeighted.provider.sendAndConfirm(tx);

  //     const { value: balance } = await provider.connection.getTokenAccountBalance(
  //       ctxWeighted.getAssociatedTokenAddress(pool.mintAddress),
  //     );
  //     console.log("LP out:", balance.uiAmountString);
  //   });

  //   it("should add liquidity in balance", async () => {
  //     const pool = await ctxWeighted.findOne(weightedN3PoolKP.publicKey); // selected pool address in dapp
  //     const bRatio_STB_USDC = pool.tokens[0].balance / pool.tokens[2].balance;
  //     const bRatio_SBR_USDC = pool.tokens[1].balance / pool.tokens[2].balance;
  //     // console.log("STB50/USDC20:", bRatio_STB_USDC);
  //     // console.log("SBR30/USDC20:", bRatio_SBR_USDC);

  //     // given 500 USDC
  //     const usdcAmount = 500;
  //     const stbAmount = usdcAmount * bRatio_STB_USDC;
  //     const sbrAmount = usdcAmount * bRatio_SBR_USDC;

  //     const { value: balance } = await provider.connection.getTokenAccountBalance(
  //       ctxWeighted.getAssociatedTokenAddress(pool.mintAddress),
  //     );
  //     const { tx } = await amm.deposit({
  //       pool,
  //       mintAddresses: pool.tokens.map((token) => token.mintAddress),
  //       amounts: [stbAmount, sbrAmount, usdcAmount],
  //     });
  //     await ctxWeighted.provider.sendAndConfirm(tx);

  //     const { value: postBalance } = await provider.connection.getTokenAccountBalance(
  //       ctxWeighted.getAssociatedTokenAddress(pool.mintAddress),
  //     );
  //     console.log(
  //       "LP out:",
  //       SafeNumber.toUiAmountString(new BN(postBalance.amount!).sub(new BN(balance.amount!)), postBalance.decimals),
  //     );
  //   });

  //   it("should add liquidity in single token", async () => {
  //     const pool = await ctxWeighted.findOne(weightedN3PoolKP.publicKey); // selected pool address in dapp

  //     const { value: balance } = await provider.connection.getTokenAccountBalance(
  //       ctxWeighted.getAssociatedTokenAddress(pool.mintAddress),
  //     );
  //     const { tx } = await amm.deposit({
  //       pool,
  //       mintAddresses: [usdcMintKP.publicKey],
  //       amounts: ["2500"],
  //     });
  //     await ctxWeighted.provider.sendAndConfirm(tx);

  //     const { value: postBalance } = await provider.connection.getTokenAccountBalance(
  //       ctxWeighted.getAssociatedTokenAddress(pool.mintAddress),
  //     );
  //     console.log(
  //       "LP out:",
  //       SafeNumber.toUiAmountString(new BN(postBalance.amount!).sub(new BN(balance.amount!)), postBalance.decimals),
  //     );
  //   });

  //   it("should remove liquidity in single token", async () => {
  //     const pool = await ctxWeighted.findOne(weightedN3PoolKP.publicKey); // selected pool address in dapp

  //     const { value: balance } = await provider.connection.getTokenAccountBalance(
  //       ctxWeighted.getAssociatedTokenAddress(usdcMintKP.publicKey),
  //     );
  //     const { tx } = await amm.withdraw({
  //       pool,
  //       mintAddresses: [usdcMintKP.publicKey],
  //       amount: "156189.993848500",
  //     });
  //     await ctxWeighted.provider.sendAndConfirm(tx);

  //     const { value: postBalance } = await provider.connection.getTokenAccountBalance(
  //       ctxWeighted.getAssociatedTokenAddress(usdcMintKP.publicKey),
  //     );
  //     console.log(
  //       "USDC out:",
  //       SafeNumber.toUiAmountString(new BN(postBalance.amount!).sub(new BN(balance.amount!)), postBalance.decimals),
  //     );
  //   });
  // });

  // describe("STB60-USDC40", () => {
  //   it("should create weighted pool", async () => {
  //     // select tokens
  //     const mintAddresses = [stbMintKP.publicKey, usdcMintKP.publicKey];

  //     // STB: $0.0175, USDC: $1
  //     const bRatio_STB_USDC = WeightedMath.calcBalanceRatio(0.6, 0.0175, 0.4, 1);
  //     // console.log("STB60/USDC40:", bRatio_STB_USDC);

  //     // given 50,000 USDC
  //     const usdcAmount = 50000;
  //     const stbAmount = usdcAmount * bRatio_STB_USDC;

  //     const { tx: createTX, address: poolAddress } = await amm.createWeightedPoolAndAddress({
  //       vaultAddress: weightedVaultKP.publicKey,
  //       mintAddresses,
  //       swapFee: 0.01, // 1%
  //       weights: ["0.6", "0.4"], // either in string or in number
  //       ticks: [0.00025, "0.000001"],
  //       poolKP: weightedN2PoolKP, // can omit in dapp
  //     });
  //     await ctxWeighted.provider.sendAndConfirm(createTX);

  //     // add initial liquidity
  //     const pool = await ctxWeighted.findOne(poolAddress);
  //     const { tx } = await amm.deposit({
  //       pool,
  //       mintAddresses,
  //       amounts: [stbAmount, usdcAmount],
  //     });
  //     await ctxWeighted.provider.sendAndConfirm(tx);

  //     const { value: balance } = await provider.connection.getTokenAccountBalance(
  //       ctxWeighted.getAssociatedTokenAddress(pool.mintAddress),
  //     );
  //     console.log("LP out:", balance.uiAmountString);
  //   });

  //   it("should add liquidity in balance", async () => {
  //     const pool = await ctxWeighted.findOne(weightedN2PoolKP.publicKey); // selected pool address in dapp
  //     const bRatio_STB_USDC = pool.tokens[0].balance / pool.tokens[1].balance;
  //     // console.log("STB60/USDC40:", bRatio_STB_USDC);

  //     // given 500 USDC
  //     const usdcAmount = 500;
  //     const stbAmount = usdcAmount * bRatio_STB_USDC;

  //     const { value: balance } = await provider.connection.getTokenAccountBalance(
  //       ctxWeighted.getAssociatedTokenAddress(pool.mintAddress),
  //     );
  //     const { tx } = await amm.deposit({
  //       pool,
  //       mintAddresses: pool.tokens.map((token) => token.mintAddress),
  //       amounts: [stbAmount, usdcAmount],
  //     });
  //     await ctxWeighted.provider.sendAndConfirm(tx);

  //     const { value: postBalance } = await provider.connection.getTokenAccountBalance(
  //       ctxWeighted.getAssociatedTokenAddress(pool.mintAddress),
  //     );
  //     console.log(
  //       "LP out:",
  //       SafeNumber.toUiAmountString(new BN(postBalance.amount!).sub(new BN(balance.amount!)), postBalance.decimals),
  //     );
  //   });

  //   it("should add liquidity in single token", async () => {
  //     const pool = await ctxWeighted.findOne(weightedN2PoolKP.publicKey); // selected pool address in dapp

  //     const { value: balance } = await provider.connection.getTokenAccountBalance(
  //       ctxWeighted.getAssociatedTokenAddress(pool.mintAddress),
  //     );
  //     const { tx } = await amm.deposit({
  //       pool,
  //       mintAddresses: [usdcMintKP.publicKey],
  //       amounts: ["1250"],
  //     });
  //     await ctxWeighted.provider.sendAndConfirm(tx);

  //     const { value: postBalance } = await provider.connection.getTokenAccountBalance(
  //       ctxWeighted.getAssociatedTokenAddress(pool.mintAddress),
  //     );
  //     console.log(
  //       "LP out:",
  //       SafeNumber.toUiAmountString(new BN(postBalance.amount!).sub(new BN(balance.amount!)), postBalance.decimals),
  //     );
  //   });

  //   it("should remove liquidity in single token", async () => {
  //     const pool = await ctxWeighted.findOne(weightedN2PoolKP.publicKey); // selected pool address in dapp

  //     const { value: balance } = await provider.connection.getTokenAccountBalance(
  //       ctxWeighted.getAssociatedTokenAddress(usdcMintKP.publicKey),
  //     );
  //     const { tx } = await amm.withdraw({
  //       pool,
  //       mintAddresses: [usdcMintKP.publicKey],
  //       amount: "56.760017596",
  //     });
  //     await ctxWeighted.provider.sendAndConfirm(tx);

  //     const { value: postBalance } = await provider.connection.getTokenAccountBalance(
  //       ctxWeighted.getAssociatedTokenAddress(usdcMintKP.publicKey),
  //     );
  //     console.log(
  //       "USDC out:",
  //       SafeNumber.toUiAmountString(new BN(postBalance.amount!).sub(new BN(balance.amount!)), postBalance.decimals),
  //     );
  //   });

  //   it("should match liquidity with reserves in vault", async () => {
  //     const pools = await ctxWeighted.findManyByVault(weightedVaultKP.publicKey);
  //     const vaultAuthorityAddress = amm.ctxVault.findVaultAuthorityAddress(weightedVaultKP.publicKey);

  //     const liqSTB = pools
  //       .filter((pool) => pool.vaultAddress.equals(weightedVaultKP.publicKey))
  //       .reduce(
  //         (liquidity, pool) =>
  //           (pool.tokens.find((token) => token.mintAddress.equals(stbMintKP.publicKey))?.balance || 0) + liquidity,
  //         0,
  //       );
  //     const {
  //       value: { uiAmount: balSTB },
  //     } = await provider.connection.getTokenAccountBalance(
  //       getAssociatedTokenAddressSync(stbMintKP.publicKey, vaultAuthorityAddress, true),
  //     );
  //     console.log("STB Liquidity:", liqSTB);
  //     console.log("STB Reserve:", balSTB);

  //     const liqUSDC = pools
  //       .filter((pool) => pool.vaultAddress.equals(weightedVaultKP.publicKey))
  //       .reduce(
  //         (liquidity, pool) =>
  //           (pool.tokens.find((token) => token.mintAddress.equals(usdcMintKP.publicKey))?.balance || 0) + liquidity,
  //         0,
  //       );
  //     const {
  //       value: { uiAmount: balUSDC },
  //     } = await provider.connection.getTokenAccountBalance(
  //       getAssociatedTokenAddressSync(usdcMintKP.publicKey, vaultAuthorityAddress, true),
  //     );
  //     console.log("USDC Liquidity:", liqUSDC);
  //     console.log("USDC Reserve:", balUSDC);
  //   });
  // });

  // describe("Bonk50-STB30-USDC20", () => {
  //   it("should create weighted pool", async () => {
  //     // Bonk: $0.000000109, STB: $0.0175, USDC: $1
  //     const bRatio_BONK_USDC = WeightedMath.calcBalanceRatio(0.5, 0.000000109, 0.2, 1);
  //     const bRatio_STB_USDC = WeightedMath.calcBalanceRatio(0.3, 0.0175, 0.2, 1);

  //     // given 1,000,000 USDC
  //     const usdcAmount = 1000000;
  //     const bonkAmount = usdcAmount * bRatio_BONK_USDC;
  //     const stbAmount = usdcAmount * bRatio_STB_USDC;
  //     console.log("Bonk in:", bonkAmount);

  //     const { tx: createTX, address: poolAddress } = await amm.createWeightedPoolAndAddress({
  //       vaultAddress: weightedVaultKP.publicKey,
  //       mintAddresses: [bonkMintKP.publicKey, stbMintKP.publicKey, usdcMintKP.publicKey],
  //       swapFee: 0.001, // 0.1%
  //       weights: ["0.5", 0.3, 0.2], // either in string or in number
  //       ticks: [1, "0.000000001", 0.000001],
  //     });
  //     await ctxWeighted.provider.sendAndConfirm(createTX);

  //     // add initial liquidity
  //     const pool = await ctxWeighted.findOne(poolAddress);
  //     const {tx} = await amm.deposit({
  //       pool,
  //       mintAddresses: pool.tokens.map((token) => token.mintAddress),
  //       amounts: [bonkAmount, stbAmount, usdcAmount],
  //     });
  //     await ctxWeighted.provider.sendAndConfirm(tx);

  //     const { value: balance } = await provider.connection.getTokenAccountBalance(
  //       ctxWeighted.getAssociatedTokenAddress(pool.mintAddress),
  //     );
  //     console.log("LP out:", balance.uiAmountString);

  //     {
  //       const pool = await ctxWeighted.findOne(poolAddress);
  //       console.log("Bonk balance (ticks):", pool.tokens[0].balance);
  //       console.log("Bonk balance (amount):", pool.tokens[0].amount);
  //     }

  //     {
  //       const pool = await ctxWeighted.findOne(poolAddress);
  //       const { value: balance } = await provider.connection.getTokenAccountBalance(
  //         ctxWeighted.getAssociatedTokenAddress(bonkMintKP.publicKey),
  //       );
  //       const {tx} = await amm.withdraw({
  //         pool,
  //         mintAddresses: [bonkMintKP.publicKey, stbMintKP.publicKey, usdcMintKP.publicKey],
  //         amount: 86350325.209763808,
  //       });
  //       await ctxWeighted.provider.sendAndConfirm(tx);

  //       const { value: postBalance } = await provider.connection.getTokenAccountBalance(
  //         ctxWeighted.getAssociatedTokenAddress(bonkMintKP.publicKey),
  //       );
  //       console.log(
  //         "Bonk out:",
  //         SafeNumber.toUiAmountString(new BN(postBalance.amount!).sub(new BN(balance.amount!)), postBalance.decimals),
  //       );
  //     }

  //     {
  //       const pool = await ctxWeighted.findOne(poolAddress);
  //       const { value: balance } = await provider.connection.getTokenAccountBalance(
  //         ctxWeighted.getAssociatedTokenAddress(bonkMintKP.publicKey),
  //       );
  //       const {tx} = await amm.withdraw({
  //         pool,
  //         mintAddresses: [bonkMintKP.publicKey, stbMintKP.publicKey, usdcMintKP.publicKey],
  //         amount: 8635032.520976381,
  //       });
  //       await ctxWeighted.provider.sendAndConfirm(tx);

  //       const { value: postBalance } = await provider.connection.getTokenAccountBalance(
  //         ctxWeighted.getAssociatedTokenAddress(bonkMintKP.publicKey),
  //       );
  //       console.log(
  //         "Bonk out:",
  //         SafeNumber.toUiAmountString(new BN(postBalance.amount!).sub(new BN(balance.amount!)), postBalance.decimals),
  //       );
  //     }

  //     {
  //       const pool = await ctxWeighted.findOne(poolAddress);
  //       const { value: balance } = await provider.connection.getTokenAccountBalance(
  //         ctxWeighted.getAssociatedTokenAddress(bonkMintKP.publicKey),
  //       );
  //       const {tx} = await amm.withdraw({
  //         pool,
  //         mintAddresses: [bonkMintKP.publicKey],
  //         amount: 8635032.520976381,
  //       });
  //       await ctxWeighted.provider.sendAndConfirm(tx);

  //       const { value: postBalance } = await provider.connection.getTokenAccountBalance(
  //         ctxWeighted.getAssociatedTokenAddress(bonkMintKP.publicKey),
  //       );
  //       console.log(
  //         "Bonk out:",
  //         SafeNumber.toUiAmountString(new BN(postBalance.amount!).sub(new BN(balance.amount!)), postBalance.decimals),
  //       );
  //     }
  //   });
  // });

  describe("DAI-USDT-USDC", () => {
    it("should create stable pool", async () => {
      const { tx: createTX, address: poolAddress } = await amm.createStablePoolAndAddress({
        vaultAddress: stableVaultKP.publicKey,
        mintAddresses: [daiMintKP.publicKey, usdtMintKP.publicKey, usdcMintKP.publicKey],
        amp: 2000,
        swapFee: "0.004", // 0.4%
        poolKP: stableN3PoolKP, // can omit in dapp
      });
      await ctxStable.provider.sendAndConfirm(createTX);

      // add initial liquidity
      const pool = await ctxStable.findOne(poolAddress);
      const { tx } = await amm.deposit({
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

      // given 200 USDC
      const usdcAmount = 200;
      const daiAmount = usdcAmount * bRatio_DAI_USDC;
      const usdtAmount = usdcAmount * bRatio_USDT_USDC;

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        ctxStable.getAssociatedTokenAddress(pool.mintAddress),
      );

      try {
        const { tx } = await amm.deposit({
          pool,
          mintAddresses: pool.tokens.map((token) => token.mintAddress),
          amounts: [daiAmount, usdtAmount, usdcAmount],
        });
        await ctxStable.provider.sendAndConfirm(tx);
      } catch (err) {
        console.log(err);
      }

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        ctxStable.getAssociatedTokenAddress(pool.mintAddress),
      );
      console.log(
        "LP out:",
        SafeNumber.toUiAmountString(new BN(postBalance.amount!).sub(new BN(balance.amount!)), postBalance.decimals),
      );
    });

    it("should add liquidity in single token", async () => {
      const pool = await ctxStable.findOne(stableN3PoolKP.publicKey); // selected pool address in dapp

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        ctxStable.getAssociatedTokenAddress(pool.mintAddress),
      );
      const { tx } = await amm.deposit({
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
        SafeNumber.toUiAmountString(new BN(postBalance.amount!).sub(new BN(balance.amount!)), postBalance.decimals),
      );
    });

    it("should remove liquidity in single token", async () => {
      const pool = await ctxStable.findOne(stableN3PoolKP.publicKey); // selected pool address in dapp

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        ctxStable.getAssociatedTokenAddress(usdcMintKP.publicKey),
      );
      const { tx } = await amm.withdraw({
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
        SafeNumber.toUiAmountString(new BN(postBalance.amount!).sub(new BN(balance.amount!)), postBalance.decimals),
      );
    });
  });

  describe("USDT-USDC", () => {
    it("should create stable pool", async () => {
      const { tx: createTX, address: poolAddress } = await amm.createStablePoolAndAddress({
        vaultAddress: stableVaultKP.publicKey,
        mintAddresses: [usdtMintKP.publicKey, usdcMintKP.publicKey],
        amp: 5000,
        swapFee: "0.0001", // 0.1%
        poolKP: stableN2PoolKP, // can omit in dapp
      });
      await ctxStable.provider.sendAndConfirm(createTX);

      // add initial liquidity
      const pool = await ctxStable.findOne(poolAddress);
      const { tx } = await amm.deposit({
        pool,
        mintAddresses: pool.tokens.map((token) => token.mintAddress),
        amounts: [1391616, 1978200],
      });
      await ctxStable.provider.sendAndConfirm(tx);

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        ctxStable.getAssociatedTokenAddress(pool.mintAddress),
      );
      console.log("LP out:", balance.uiAmountString!);
    });
  });
});
