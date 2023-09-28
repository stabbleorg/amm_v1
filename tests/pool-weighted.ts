import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createAssociatedTokenAccount, createMint, mintTo } from "@solana/spl-token";
import { TokenAmountUtil, VaultContext, WeightedMath, WeightedPoolContext } from "@stabbleorg/solana-sdk";
import { weightedVaultKP, weightedN3PoolKP, weightedN3PoolMintKP, adminKP, userKP, swapFee } from "./consts";

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
      const balanceRatio_STB_USDC = WeightedMath.calcBalanceRatio(0.5, 0.0175, 0.2, 1);
      const balanceRatio_ETH_USDC = WeightedMath.calcBalanceRatio(0.3, 1592.12, 0.2, 1);
      // Given 50,000 USDC
      const amountUSDC = 50000;
      const amountSTB = amountUSDC * balanceRatio_STB_USDC;
      const amountETH = amountUSDC * balanceRatio_ETH_USDC;

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

    it("should add liquidity", async () => {
      const { value: balance } = await provider.connection.getTokenAccountBalance(
        adminWeightedPoolContext.getAssociatedTokenAddress(poolMintAddress),
      );
      const pool = await adminWeightedPoolContext.loadPool(poolAddress);

      // calculate balance ratios from spot price
      const price_STB_USDC = WeightedMath.calcSpotPrice(
        pool.tokens[0].balance,
        pool.tokens[0].weight,
        pool.tokens[2].balance,
        pool.tokens[2].weight,
      );
      const price_ETH_USDC = WeightedMath.calcSpotPrice(
        pool.tokens[1].balance,
        pool.tokens[1].weight,
        pool.tokens[2].balance,
        pool.tokens[2].weight,
      );
      const balanceRatio_STB_USDC = WeightedMath.calcBalanceRatio(
        pool.tokens[0].weight,
        price_STB_USDC,
        pool.tokens[2].weight,
        1,
      );
      const balanceRatio_ETH_USDC = WeightedMath.calcBalanceRatio(
        pool.tokens[1].weight,
        price_ETH_USDC,
        pool.tokens[2].weight,
        1,
      );
      // Given 50 USDC
      const amountUSDC = 50;
      const amountSTB = amountUSDC * balanceRatio_STB_USDC;
      const amountETH = amountUSDC * balanceRatio_ETH_USDC;

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

    it("should add liquidity in USDC", async () => {
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

    it("should remove liquidity in USDC", async () => {
      const { value: balance } = await provider.connection.getTokenAccountBalance(
        adminWeightedPoolContext.getAssociatedTokenAddress(mintUSDC),
      );

      const ixs = await adminWeightedPoolContext.withdrawInstructions(
        vaultAddress,
        vaultContext.findVaultAuthorityAddress(vaultAddress),
        vaultContext.program.programId,
        poolAddress,
        poolMintAddress,
        "220.597154521",
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
