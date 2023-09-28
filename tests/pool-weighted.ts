import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createAssociatedTokenAccount, createMint, mintTo } from "@solana/spl-token";
import { TokenAmountUtil, VaultContext, WeightedMath, WeightedPoolContext } from "@stabbleorg/solana-sdk";
import {
  weightedVaultKP,
  weightedN3PoolKP,
  weightedN3PoolMintKP,
  adminKP,
  userKP,
  beneficiaryKP,
  swapFee,
} from "./consts";

describe("Weighted Pool", () => {
  const provider = AnchorProvider.env();
  const adminWeightedPoolContext = new WeightedPoolContext(
    new AnchorProvider(provider.connection, new Wallet(adminKP), {}),
  );
  const userWeightedPoolContext = new WeightedPoolContext(
    new AnchorProvider(provider.connection, new Wallet(userKP), {}),
  );
  const vaultContext = new VaultContext({ connection: provider.connection });
  const vaultAddress = weightedVaultKP.publicKey;
  const beneficiaryAddress = beneficiaryKP.publicKey;

  let mintSTB: PublicKey, mintETH: PublicKey, mintUSDC: PublicKey;

  describe("STB50-ETH30-USDC20", () => {
    const poolAddress = weightedN3PoolKP.publicKey;
    const poolMintAddress = weightedN3PoolMintKP.publicKey;

    before(async () => {
      await userWeightedPoolContext.confirmTX(
        await provider.connection.requestAirdrop(userWeightedPoolContext.walletAddress, LAMPORTS_PER_SOL),
      );

      mintSTB = await createMint(provider.connection, adminKP, adminKP.publicKey, null, 9);
      mintETH = await createMint(provider.connection, adminKP, adminKP.publicKey, null, 8);
      mintUSDC = await createMint(provider.connection, adminKP, adminKP.publicKey, null, 6);

      const adminSTBAddress = await createAssociatedTokenAccount(
        provider.connection,
        adminKP,
        mintSTB,
        adminKP.publicKey,
      );
      await mintTo(
        provider.connection,
        adminKP,
        mintSTB,
        adminSTBAddress,
        adminKP,
        BigInt(TokenAmountUtil.toBigAmount(100000000, 9).toString()),
      );

      const adminETHAddress = await createAssociatedTokenAccount(
        provider.connection,
        adminKP,
        mintETH,
        adminKP.publicKey,
      );
      await mintTo(
        provider.connection,
        adminKP,
        mintETH,
        adminETHAddress,
        adminKP,
        BigInt(TokenAmountUtil.toBigAmount(100000000, 8).toString()),
      );

      const adminUSDCAddress = await createAssociatedTokenAccount(
        provider.connection,
        adminKP,
        mintUSDC,
        adminKP.publicKey,
      );
      await mintTo(
        provider.connection,
        adminKP,
        mintUSDC,
        adminUSDCAddress,
        adminKP,
        BigInt(TokenAmountUtil.toBigAmount(100000000, 6).toString()),
      );
    });

    it("should initialize weighted pool", async () => {
      const bRatio_STB_USDC = WeightedMath.calcBalanceRatio(0.7, 0.0175, 0.3, 1);
      const bRatio_STB_USDT = WeightedMath.calcBalanceRatio(0.8, 0.0175, 0.2, 1);
      const bRatio_STB40_USDC25 = WeightedMath.calcBalanceRatio(0.4, 0.0175, 0.25, 1);
      const bRatio_PSOL35_USDC25 = WeightedMath.calcBalanceRatio(0.35, 0.1, 0.25, 1);
      console.log("STB70/USDC30", bRatio_STB_USDC);
      console.log("STB80/USDT20", bRatio_STB_USDT);
      console.log("STB40/USDC25", bRatio_STB40_USDC25);
      console.log("PSOL35/USDT25", bRatio_PSOL35_USDC25);

      const ixs = await adminWeightedPoolContext.initializeInstructions(
        vaultAddress,
        poolAddress,
        poolMintAddress,
        swapFee,
        ["0.5", "0.3", "0.2"],
        [mintSTB, mintETH, mintUSDC],
      );
      const tx = await adminWeightedPoolContext.newTX(ixs);
      tx.sign([weightedN3PoolMintKP, weightedN3PoolKP]);
      await adminWeightedPoolContext.provider.sendAndConfirm!(tx);
    });

    it("should add initial liquidity", async () => {
      // STB: $0.0175, ETH: $1592.12, USDC: $1
      const bRatio_STB_USDC = WeightedMath.calcBalanceRatio(0.5, 0.0175, 0.2, 1);
      const bRatio_ETH_USDC = WeightedMath.calcBalanceRatio(0.3, 1592.12, 0.2, 1);
      // Given 50,000 USDC
      const amountUSDC = 50000;
      const amountSTB = amountUSDC * bRatio_STB_USDC;
      const amountETH = amountUSDC * bRatio_ETH_USDC;

      // add initial liquidity
      const ixs = await adminWeightedPoolContext.depositInstructions(
        vaultAddress,
        vaultContext.findVaultAuthorityAddress(vaultAddress),
        poolAddress,
        poolMintAddress,
        [amountSTB.toString(), amountETH.toString(), amountUSDC.toString()],
        [9, 8, 6],
        [mintSTB, mintETH, mintUSDC],
      );
      const tx = await adminWeightedPoolContext.newTX(ixs);
      await adminWeightedPoolContext.provider.sendAndConfirm!(tx);

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        adminWeightedPoolContext.getAssociatedTokenAddress(poolMintAddress),
      );
      console.log("LP out:", balance.uiAmount!);
    });

    it("should swap 100 USDC for STB", async () => {
      const { value: balance } = await provider.connection.getTokenAccountBalance(
        adminWeightedPoolContext.getAssociatedTokenAddress(mintSTB),
      );

      // should be preloaded & up to date in real-time by event listener in dapp
      const pool = await adminWeightedPoolContext.loadPool(poolAddress);
      const tokenIn = pool.tokens.find((token) => token.mintAddress.equals(mintUSDC))!;
      const tokenOut = pool.tokens.find((token) => token.mintAddress.equals(mintSTB))!;

      // USDC/STB price impact
      const currentPrice = WeightedMath.calcSpotPrice(
        tokenIn.balance,
        tokenIn.weight,
        tokenOut.balance,
        tokenOut.weight,
        pool.swapFee,
      );
      const postPrice = WeightedMath.calcPostPrice(
        tokenIn.balance,
        tokenIn.weight,
        tokenOut.balance,
        tokenOut.weight,
        100,
        pool.swapFee,
      );
      // STB buy price
      console.log("STB buy price:", 1 / currentPrice);
      console.log("Post price:", 1 / postPrice);
      // price impact
      const priceImpactRatio = 1 - postPrice / currentPrice;
      console.log("Price impact ratio:", priceImpactRatio);

      // estimated amount out
      const amountOut = WeightedMath.calcOutGivenIn(
        tokenIn.balance,
        tokenIn.weight,
        tokenOut.balance,
        tokenOut.weight,
        100,
        pool.swapFee,
      );
      console.log("Est. amount out:", amountOut);
      // given slippage 0.1% (0.001)
      const minAmountOut = amountOut * (1 - 0.001);

      const ixs = await adminWeightedPoolContext.swapInstructions(
        vaultAddress,
        vaultContext.findVaultAuthorityAddress(vaultAddress),
        beneficiaryAddress,
        vaultContext.program.programId,
        poolAddress,
        mintUSDC,
        mintSTB,
        6,
        9,
        "100",
        minAmountOut,
      );
      const tx = await adminWeightedPoolContext.newTX(ixs);
      await adminWeightedPoolContext.provider.sendAndConfirm!(tx);

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        adminWeightedPoolContext.getAssociatedTokenAddress(mintSTB),
      );
      console.log("STB out:", postBalance.uiAmount! - balance.uiAmount!);
    });

    it("should swap 5650 STB for USDC", async () => {
      const { value: balance } = await provider.connection.getTokenAccountBalance(
        adminWeightedPoolContext.getAssociatedTokenAddress(mintUSDC),
      );

      // should be preloaded & up to date in real-time by event listener in dapp
      const pool = await adminWeightedPoolContext.loadPool(poolAddress);
      const tokenIn = pool.tokens.find((token) => token.mintAddress.equals(mintSTB))!;
      const tokenOut = pool.tokens.find((token) => token.mintAddress.equals(mintUSDC))!;

      // STB/USDC price impact
      const currentPrice = WeightedMath.calcSpotPrice(
        tokenIn.balance,
        tokenIn.weight,
        tokenOut.balance,
        tokenOut.weight,
        pool.swapFee,
      );
      const postPrice = WeightedMath.calcPostPrice(
        tokenIn.balance,
        tokenIn.weight,
        tokenOut.balance,
        tokenOut.weight,
        5000,
        pool.swapFee,
      );
      // STB sell price
      console.log("STB sell price:", currentPrice);
      console.log("Post price:", postPrice);
      // price impact
      const priceImpactRatio = 1 - postPrice / currentPrice;
      console.log("Price impact ratio:", priceImpactRatio);

      // estimated amount out
      const amountOut = WeightedMath.calcOutGivenIn(
        tokenIn.balance,
        tokenIn.weight,
        tokenOut.balance,
        tokenOut.weight,
        5650,
        pool.swapFee,
      );
      console.log("Est. amount out:", amountOut);
      // given slippage 0.1% (0.001)
      const minAmountOut = amountOut * (1 - 0.001);

      const ixs = await adminWeightedPoolContext.swapInstructions(
        vaultAddress,
        vaultContext.findVaultAuthorityAddress(vaultAddress),
        beneficiaryAddress,
        vaultContext.program.programId,
        poolAddress,
        mintSTB,
        mintUSDC,
        9,
        6,
        "5650",
        minAmountOut,
      );
      const tx = await adminWeightedPoolContext.newTX(ixs);
      await adminWeightedPoolContext.provider.sendAndConfirm!(tx);

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        adminWeightedPoolContext.getAssociatedTokenAddress(mintUSDC),
      );
      console.log("USDC out:", postBalance.uiAmount! - balance.uiAmount!);
    });

    it("should add liquidity in balance given 50 USDC", async () => {
      const { value: balance } = await provider.connection.getTokenAccountBalance(
        adminWeightedPoolContext.getAssociatedTokenAddress(poolMintAddress),
      );

      // should be preloaded & up to date in real-time by event listener in dapp
      const pool = await adminWeightedPoolContext.loadPool(poolAddress);

      // calculate balance ratios from spot price
      const price_STB_USDC = WeightedMath.calcSpotPrice(
        pool.tokens[0].balance,
        pool.tokens[0].weight,
        pool.tokens[2].balance,
        pool.tokens[2].weight,
      );
      console.log("STB/USDC:", price_STB_USDC);
      const price_ETH_USDC = WeightedMath.calcSpotPrice(
        pool.tokens[1].balance,
        pool.tokens[1].weight,
        pool.tokens[2].balance,
        pool.tokens[2].weight,
      );
      console.log("ETH/USDC:", price_ETH_USDC);
      const bRatio_STB_USDC = WeightedMath.calcBalanceRatio(
        pool.tokens[0].weight,
        price_STB_USDC,
        pool.tokens[2].weight,
        1,
      );
      const bRatio_ETH_USDC = WeightedMath.calcBalanceRatio(
        pool.tokens[1].weight,
        price_ETH_USDC,
        pool.tokens[2].weight,
        1,
      );
      // Given 50 USDC
      const amountUSDC = 50;
      const amountSTB = amountUSDC * bRatio_STB_USDC;
      const amountETH = amountUSDC * bRatio_ETH_USDC;

      // add liquidity in balance
      const ixs = await adminWeightedPoolContext.depositInstructions(
        vaultAddress,
        vaultContext.findVaultAuthorityAddress(vaultAddress),
        poolAddress,
        poolMintAddress,
        [amountSTB.toString(), amountETH.toString(), amountUSDC.toString()],
        [9, 8, 6],
        [mintSTB, mintETH, mintUSDC],
      );
      const tx = await adminWeightedPoolContext.newTX(ixs);
      await adminWeightedPoolContext.provider.sendAndConfirm!(tx);

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        adminWeightedPoolContext.getAssociatedTokenAddress(poolMintAddress),
      );
      console.log("LP out:", postBalance.uiAmount! - balance.uiAmount!);
    });

    it("should remove liquidity in exact tokens given 222 LP", async () => {
      const { value: balanceSTB } = await provider.connection.getTokenAccountBalance(
        adminWeightedPoolContext.getAssociatedTokenAddress(mintSTB),
      );
      const { value: balanceETH } = await provider.connection.getTokenAccountBalance(
        adminWeightedPoolContext.getAssociatedTokenAddress(mintETH),
      );
      const { value: balanceUSDC } = await provider.connection.getTokenAccountBalance(
        adminWeightedPoolContext.getAssociatedTokenAddress(mintUSDC),
      );

      const ixs = await adminWeightedPoolContext.withdrawInstructions(
        vaultAddress,
        vaultContext.findVaultAuthorityAddress(vaultAddress),
        vaultContext.program.programId,
        poolAddress,
        poolMintAddress,
        "222",
        [mintSTB, mintETH, mintUSDC],
      );
      const tx = await adminWeightedPoolContext.newTX(ixs);
      await adminWeightedPoolContext.provider.sendAndConfirm!(tx);

      const { value: postBalanceSTB } = await provider.connection.getTokenAccountBalance(
        adminWeightedPoolContext.getAssociatedTokenAddress(mintSTB),
      );
      const { value: postBalanceETH } = await provider.connection.getTokenAccountBalance(
        adminWeightedPoolContext.getAssociatedTokenAddress(mintETH),
      );
      const { value: postBalanceUSDC } = await provider.connection.getTokenAccountBalance(
        adminWeightedPoolContext.getAssociatedTokenAddress(mintUSDC),
      );
      console.log("STB out:", postBalanceSTB.uiAmount! - balanceSTB.uiAmount!);
      console.log("ETH out:", postBalanceETH.uiAmount! - balanceETH.uiAmount!);
      console.log("UDSC out:", postBalanceUSDC.uiAmount! - balanceUSDC.uiAmount!);
    });

    it("should add liquidity in USDC given 250 USDC", async () => {
      const { value: balance } = await provider.connection.getTokenAccountBalance(
        adminWeightedPoolContext.getAssociatedTokenAddress(poolMintAddress),
      );

      // add liquidity in balance
      const ixs = await adminWeightedPoolContext.depositInstructions(
        vaultAddress,
        vaultContext.findVaultAuthorityAddress(vaultAddress),
        poolAddress,
        poolMintAddress,
        ["250"], // 250 USDC
        [6],
        [mintUSDC],
      );
      const tx = await adminWeightedPoolContext.newTX(ixs);
      await adminWeightedPoolContext.provider.sendAndConfirm!(tx);

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        adminWeightedPoolContext.getAssociatedTokenAddress(poolMintAddress),
      );
      console.log("LP out:", postBalance.uiAmount! - balance.uiAmount!);
    });

    it("should remove liquidity in USDC given 2310 LP", async () => {
      const { value: balance } = await provider.connection.getTokenAccountBalance(
        adminWeightedPoolContext.getAssociatedTokenAddress(mintUSDC),
      );

      const ixs = await adminWeightedPoolContext.withdrawInstructions(
        vaultAddress,
        vaultContext.findVaultAuthorityAddress(vaultAddress),
        vaultContext.program.programId,
        poolAddress,
        poolMintAddress,
        "2310",
        [mintUSDC],
      );
      const tx = await adminWeightedPoolContext.newTX(ixs);
      await adminWeightedPoolContext.provider.sendAndConfirm!(tx);

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        adminWeightedPoolContext.getAssociatedTokenAddress(mintUSDC),
      );
      console.log("USDC out:", postBalance.uiAmount! - balance.uiAmount!);
    });
  });
});
