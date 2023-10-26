import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { VaultContext, WeightedPoolContext, StablePoolContext, WeightedMath, SDKWrapper } from "@stabbleorg/solana-sdk";
import {
  weightedVaultKP,
  weightedN3PoolKP,
  stableVaultKP,
  stableN3PoolKP,
  adminKP,
  swapFee,
  stbMintKP,
  sbrMintKP,
  usdcMintKP,
  usdtMintKP,
  daiMintKP,
} from "./consts";

describe("Weighted Pool", () => {
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
      console.log("STB50/USDC20:", bRatio_STB_USDC);
      console.log("SBR30/USDC20:", bRatio_SBR_USDC);

      // Given 50,000 USDC
      const usdcAmount = 50000;
      const stbAmount = usdcAmount * bRatio_STB_USDC;
      const sbrAmount = usdcAmount * bRatio_SBR_USDC;

      const { tx: createTX, address: poolAddress } = await sdk.createWeightedPoolAndAddress({
        vaultAddress: weightedVaultKP.publicKey,
        mintAddresses: [stbMintKP.publicKey, sbrMintKP.publicKey, usdcMintKP.publicKey],
        weights: ["0.5", 0.3, 0.2], // either in string or in number
        swapFee,
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
      console.log("LP out:", balance.uiAmount!);
    });

    // it("should swap 100 USDC for STB", async () => {
    //   const { value: balance } = await provider.connection.getTokenAccountBalance(
    //     adminWeightedPoolContext.getAssociatedTokenAddress(mintSTB),
    //   );

    //   // should be preloaded & up to date in real-time by event listener in dapp
    //   const pools = await adminWeightedPoolContext.loadPoolsByVault(vaultAddress);
    //   // pick the best pool
    //   const pool = pools
    //     .filter((pool) => pool.isActive)
    //     .sort((a, b) => b.getEstAmountOut(mintUSDC, mintSTB, 100) - a.getEstAmountOut(mintUSDC, mintSTB, 100))[0];
    //   if (!pool) assert.fail();

    //   // price info
    //   const price = pool.getPriceInfo(mintUSDC, mintSTB, 100);
    //   if (price === null) assert.fail();

    //   console.log("1 USDC =", price.currentPrice, "STB");
    //   // price impact
    //   console.log("Price impact ratio:", price.priceImpactRatio);
    //   // estimated amount out
    //   console.log("Est. amount out:", price.amountOut);
    //   // given slippage 0.1% (0.001)
    //   const minAmountOut = price.amountOut * (1 - 0.001);

    //   const ixs = await adminWeightedPoolContext.swapInstructions(
    //     vaultAddress,
    //     vaultContext.findVaultAuthorityAddress(vaultAddress),
    //     beneficiaryAddress,
    //     vaultContext.program.programId,
    //     poolAddress,
    //     mintUSDC,
    //     mintSTB,
    //     6,
    //     9,
    //     "100",
    //     minAmountOut,
    //   );
    //   const tx = await adminWeightedPoolContext.newTX(ixs);
    //   await adminWeightedPoolContext.provider.sendAndConfirm!(tx);

    //   const { value: postBalance } = await provider.connection.getTokenAccountBalance(
    //     adminWeightedPoolContext.getAssociatedTokenAddress(mintSTB),
    //   );
    //   console.log("STB out:", postBalance.uiAmount! - balance.uiAmount!);
    // });

    // it("should swap 5650 STB for USDC", async () => {
    //   const { value: balance } = await provider.connection.getTokenAccountBalance(
    //     adminWeightedPoolContext.getAssociatedTokenAddress(mintUSDC),
    //   );

    //   // should be preloaded & up to date in real-time by event listener in dapp
    //   const pools = await adminWeightedPoolContext.loadPoolsByVault(vaultAddress);
    //   // pick the best pool
    //   const pool = pools
    //     .filter((pool) => pool.isActive)
    //     .sort((a, b) => b.getEstAmountOut(mintSTB, mintUSDC, 5650) - a.getEstAmountOut(mintSTB, mintUSDC, 5650))[0];
    //   if (!pool) assert.fail();

    //   // price info
    //   const price = pool.getPriceInfo(mintSTB, mintUSDC, 5650);
    //   if (price === null) assert.fail();

    //   console.log("1 STB =", price.currentPrice, "USDC");
    //   // price impact
    //   console.log("Price impact ratio:", price.priceImpactRatio);
    //   // estimated amount out
    //   console.log("Est. amount out:", price.amountOut);
    //   // given slippage 0.1% (0.001)
    //   const minAmountOut = price.amountOut * (1 - 0.001);

    //   const ixs = await adminWeightedPoolContext.swapInstructions(
    //     vaultAddress,
    //     vaultContext.findVaultAuthorityAddress(vaultAddress),
    //     beneficiaryAddress,
    //     vaultContext.program.programId,
    //     poolAddress,
    //     mintSTB,
    //     mintUSDC,
    //     9,
    //     6,
    //     "5650",
    //     minAmountOut,
    //   );
    //   const tx = await adminWeightedPoolContext.newTX(ixs);
    //   await adminWeightedPoolContext.provider.sendAndConfirm!(tx);

    //   const { value: postBalance } = await provider.connection.getTokenAccountBalance(
    //     adminWeightedPoolContext.getAssociatedTokenAddress(mintUSDC),
    //   );
    //   console.log("USDC out:", postBalance.uiAmount! - balance.uiAmount!);
    // });

    // it("should add liquidity in balance given 50 USDC", async () => {
    //   const { value: balance } = await provider.connection.getTokenAccountBalance(
    //     adminWeightedPoolContext.getAssociatedTokenAddress(poolMintAddress),
    //   );

    //   // should be preloaded & up to date in real-time by event listener in dapp
    //   const pool = await adminWeightedPoolContext.loadPool(poolAddress);

    //   // calculate balance ratios from spot price
    //   const price_STB_USDC = WeightedMath.calcSpotPrice(
    //     pool.tokens[0].balance,
    //     pool.tokens[0].weight,
    //     pool.tokens[2].balance,
    //     pool.tokens[2].weight,
    //   );
    //   console.log("STB/USDC:", price_STB_USDC);
    //   const price_ETH_USDC = WeightedMath.calcSpotPrice(
    //     pool.tokens[1].balance,
    //     pool.tokens[1].weight,
    //     pool.tokens[2].balance,
    //     pool.tokens[2].weight,
    //   );
    //   console.log("ETH/USDC:", price_ETH_USDC);
    //   const bRatio_STB_USDC = WeightedMath.calcBalanceRatio(
    //     pool.tokens[0].weight,
    //     price_STB_USDC,
    //     pool.tokens[2].weight,
    //     1,
    //   );
    //   const bRatio_ETH_USDC = WeightedMath.calcBalanceRatio(
    //     pool.tokens[1].weight,
    //     price_ETH_USDC,
    //     pool.tokens[2].weight,
    //     1,
    //   );
    //   // Given 50 USDC
    //   const amountUSDC = 50;
    //   const amountSTB = amountUSDC * bRatio_STB_USDC;
    //   const amountETH = amountUSDC * bRatio_ETH_USDC;

    //   // add liquidity in balance
    //   const ixs = await adminWeightedPoolContext.depositInstructions(
    //     vaultAddress,
    //     vaultContext.findVaultAuthorityAddress(vaultAddress),
    //     poolAddress,
    //     poolMintAddress,
    //     [amountSTB.toString(), amountETH.toString(), amountUSDC.toString()],
    //     [9, 8, 6],
    //     [mintSTB, mintETH, mintUSDC],
    //   );
    //   const tx = await adminWeightedPoolContext.newTX(ixs);
    //   await adminWeightedPoolContext.provider.sendAndConfirm!(tx);

    //   const { value: postBalance } = await provider.connection.getTokenAccountBalance(
    //     adminWeightedPoolContext.getAssociatedTokenAddress(poolMintAddress),
    //   );
    //   console.log("LP out:", postBalance.uiAmount! - balance.uiAmount!);
    // });

    // it("should remove liquidity in exact tokens given 222 LP", async () => {
    //   const { value: balanceSTB } = await provider.connection.getTokenAccountBalance(
    //     adminWeightedPoolContext.getAssociatedTokenAddress(mintSTB),
    //   );
    //   const { value: balanceETH } = await provider.connection.getTokenAccountBalance(
    //     adminWeightedPoolContext.getAssociatedTokenAddress(mintETH),
    //   );
    //   const { value: balanceUSDC } = await provider.connection.getTokenAccountBalance(
    //     adminWeightedPoolContext.getAssociatedTokenAddress(mintUSDC),
    //   );

    //   const ixs = await adminWeightedPoolContext.withdrawInstructions(
    //     vaultAddress,
    //     vaultContext.findVaultAuthorityAddress(vaultAddress),
    //     vaultContext.program.programId,
    //     poolAddress,
    //     poolMintAddress,
    //     "222",
    //     [mintSTB, mintETH, mintUSDC],
    //   );
    //   const tx = await adminWeightedPoolContext.newTX(ixs);
    //   await adminWeightedPoolContext.provider.sendAndConfirm!(tx);

    //   const { value: postBalanceSTB } = await provider.connection.getTokenAccountBalance(
    //     adminWeightedPoolContext.getAssociatedTokenAddress(mintSTB),
    //   );
    //   const { value: postBalanceETH } = await provider.connection.getTokenAccountBalance(
    //     adminWeightedPoolContext.getAssociatedTokenAddress(mintETH),
    //   );
    //   const { value: postBalanceUSDC } = await provider.connection.getTokenAccountBalance(
    //     adminWeightedPoolContext.getAssociatedTokenAddress(mintUSDC),
    //   );
    //   console.log("STB out:", postBalanceSTB.uiAmount! - balanceSTB.uiAmount!);
    //   console.log("ETH out:", postBalanceETH.uiAmount! - balanceETH.uiAmount!);
    //   console.log("USDC out:", postBalanceUSDC.uiAmount! - balanceUSDC.uiAmount!);
    // });

    // it("should add liquidity in USDC given 250 USDC", async () => {
    //   const { value: balance } = await provider.connection.getTokenAccountBalance(
    //     adminWeightedPoolContext.getAssociatedTokenAddress(poolMintAddress),
    //   );

    //   // add liquidity in balance
    //   const ixs = await adminWeightedPoolContext.depositInstructions(
    //     vaultAddress,
    //     vaultContext.findVaultAuthorityAddress(vaultAddress),
    //     poolAddress,
    //     poolMintAddress,
    //     ["250"], // 250 USDC
    //     [6],
    //     [mintUSDC],
    //   );
    //   const tx = await adminWeightedPoolContext.newTX(ixs);
    //   await adminWeightedPoolContext.provider.sendAndConfirm!(tx);

    //   const { value: postBalance } = await provider.connection.getTokenAccountBalance(
    //     adminWeightedPoolContext.getAssociatedTokenAddress(poolMintAddress),
    //   );
    //   console.log("LP out:", postBalance.uiAmount! - balance.uiAmount!);
    // });

    // it("should remove liquidity in USDC given 2310 LP", async () => {
    //   const { value: balance } = await provider.connection.getTokenAccountBalance(
    //     adminWeightedPoolContext.getAssociatedTokenAddress(mintUSDC),
    //   );

    //   const ixs = await adminWeightedPoolContext.withdrawInstructions(
    //     vaultAddress,
    //     vaultContext.findVaultAuthorityAddress(vaultAddress),
    //     vaultContext.program.programId,
    //     poolAddress,
    //     poolMintAddress,
    //     "2310",
    //     [mintUSDC],
    //   );
    //   const tx = await adminWeightedPoolContext.newTX(ixs);
    //   await adminWeightedPoolContext.provider.sendAndConfirm!(tx);

    //   const { value: postBalance } = await provider.connection.getTokenAccountBalance(
    //     adminWeightedPoolContext.getAssociatedTokenAddress(mintUSDC),
    //   );
    //   console.log("USDC out:", postBalance.uiAmount! - balance.uiAmount!);
    // });
  });

  describe("DAI-USDT-USDC", () => {
    it("should create stable pool", async () => {
      const { tx: createTX, address: poolAddress } = await sdk.createStablePoolAndAddress({
        vaultAddress: stableVaultKP.publicKey,
        mintAddresses: [daiMintKP.publicKey, usdtMintKP.publicKey, usdcMintKP.publicKey],
        amp: 2000,
        swapFee,
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
        ctxWeighted.getAssociatedTokenAddress(pool.mintAddress),
      );
      console.log("LP out:", balance.uiAmount!);
    });
  });
});
