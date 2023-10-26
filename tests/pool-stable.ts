import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { VaultContext, WeightedPoolContext, StablePoolContext, SDKWrapper } from "@stabbleorg/solana-sdk";
import { stableVaultKP, stableN3PoolKP, adminKP, swapFee, usdcMintKP, usdtMintKP, daiMintKP } from "./consts";

describe("Stable Pool", () => {
  const provider = AnchorProvider.env();
  const ctxVault = new VaultContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const ctxWeighted = new WeightedPoolContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const ctxStable = new StablePoolContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const sdk = new SDKWrapper({
    vault: ctxVault,
    weighted: ctxWeighted,
    stable: ctxStable,
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

    // it("should add initial liquidity", async () => {
    //   const ixs = await adminStablePoolContext.depositInstructions(
    //     vaultAddress,
    //     vaultContext.findVaultAuthorityAddress(vaultAddress),
    //     poolAddress,
    //     poolMintAddress,
    //     ["500000", "250000", "250000"],
    //     [6, 6, 6],
    //     [mintUSDH, mintUSDT, mintUSDC],
    //   );
    //   const tx = await adminStablePoolContext.newTX(ixs);
    //   await adminStablePoolContext.provider.sendAndConfirm!(tx);

    //   const { value: balance } = await provider.connection.getTokenAccountBalance(
    //     adminStablePoolContext.getAssociatedTokenAddress(poolMintAddress),
    //   );
    //   console.log("LP out:", balance.uiAmount!);
    // });

    // it("should remove liquidity in exact tokens given 1000 LP", async () => {
    //   const { value: balanceUSDH } = await provider.connection.getTokenAccountBalance(
    //     adminStablePoolContext.getAssociatedTokenAddress(mintUSDH),
    //   );
    //   const { value: balanceUSDT } = await provider.connection.getTokenAccountBalance(
    //     adminStablePoolContext.getAssociatedTokenAddress(mintUSDT),
    //   );
    //   const { value: balanceUSDC } = await provider.connection.getTokenAccountBalance(
    //     adminStablePoolContext.getAssociatedTokenAddress(mintUSDC),
    //   );

    //   const ixs = await adminStablePoolContext.withdrawInstructions(
    //     vaultAddress,
    //     vaultContext.findVaultAuthorityAddress(vaultAddress),
    //     vaultContext.program.programId,
    //     poolAddress,
    //     poolMintAddress,
    //     "1000",
    //     [mintUSDH, mintUSDT, mintUSDC],
    //   );
    //   const tx = await adminStablePoolContext.newTX(ixs);
    //   await adminStablePoolContext.provider.sendAndConfirm!(tx);

    //   const { value: postBalanceUSDH } = await provider.connection.getTokenAccountBalance(
    //     adminStablePoolContext.getAssociatedTokenAddress(mintUSDH),
    //   );
    //   const { value: postBalanceUSDT } = await provider.connection.getTokenAccountBalance(
    //     adminStablePoolContext.getAssociatedTokenAddress(mintUSDT),
    //   );
    //   const { value: postBalanceUSDC } = await provider.connection.getTokenAccountBalance(
    //     adminStablePoolContext.getAssociatedTokenAddress(mintUSDC),
    //   );
    //   console.log("USDH out:", postBalanceUSDH.uiAmount! - balanceUSDH.uiAmount!);
    //   console.log("USDT out:", postBalanceUSDT.uiAmount! - balanceUSDT.uiAmount!);
    //   console.log("USDC out:", postBalanceUSDC.uiAmount! - balanceUSDC.uiAmount!);
    // });

    // it("should remove liquidity in USDC given 1000 LP", async () => {
    //   const { value: balanceUSDC } = await provider.connection.getTokenAccountBalance(
    //     adminStablePoolContext.getAssociatedTokenAddress(mintUSDC),
    //   );

    //   const ixs = await adminStablePoolContext.withdrawInstructions(
    //     vaultAddress,
    //     vaultContext.findVaultAuthorityAddress(vaultAddress),
    //     vaultContext.program.programId,
    //     poolAddress,
    //     poolMintAddress,
    //     "1000",
    //     [mintUSDC],
    //   );
    //   const tx = await adminStablePoolContext.newTX(ixs);
    //   await adminStablePoolContext.provider.sendAndConfirm!(tx);

    //   const { value: postBalanceUSDC } = await provider.connection.getTokenAccountBalance(
    //     adminStablePoolContext.getAssociatedTokenAddress(mintUSDC),
    //   );
    //   console.log("USDC out:", postBalanceUSDC.uiAmount! - balanceUSDC.uiAmount!);
    // });

    // it("should add liquidity in USDC given 1000 USDC", async () => {
    //   const { value: balance } = await provider.connection.getTokenAccountBalance(
    //     adminStablePoolContext.getAssociatedTokenAddress(poolMintAddress),
    //   );

    //   const ixs = await adminStablePoolContext.depositInstructions(
    //     vaultAddress,
    //     vaultContext.findVaultAuthorityAddress(vaultAddress),
    //     poolAddress,
    //     poolMintAddress,
    //     ["1000"],
    //     [6],
    //     [mintUSDC],
    //   );
    //   const tx = await adminStablePoolContext.newTX(ixs);
    //   try {
    //     await adminStablePoolContext.provider.sendAndConfirm!(tx);
    //   } catch (err) {
    //     console.error(err);
    //   }

    //   const { value: postBalance } = await provider.connection.getTokenAccountBalance(
    //     adminStablePoolContext.getAssociatedTokenAddress(poolMintAddress),
    //   );
    //   console.log("LP out:", postBalance.uiAmount! - balance.uiAmount!);
    // });

    // it("should add liquidity", async () => {
    //   const { value: balance } = await provider.connection.getTokenAccountBalance(
    //     adminStablePoolContext.getAssociatedTokenAddress(poolMintAddress),
    //   );

    //   const ixs = await adminStablePoolContext.depositInstructions(
    //     vaultAddress,
    //     vaultContext.findVaultAuthorityAddress(vaultAddress),
    //     poolAddress,
    //     poolMintAddress,
    //     ["500", "250", "250"],
    //     [6, 6, 6],
    //     [mintUSDH, mintUSDT, mintUSDC],
    //   );
    //   const tx = await adminStablePoolContext.newTX(ixs);
    //   await adminStablePoolContext.provider.sendAndConfirm!(tx);

    //   const { value: postBalance } = await provider.connection.getTokenAccountBalance(
    //     adminStablePoolContext.getAssociatedTokenAddress(poolMintAddress),
    //   );
    //   console.log("LP out:", postBalance.uiAmount! - balance.uiAmount!);
    // });

    // it("should swap 100 USDH for USDC", async () => {
    //   const { value: balance } = await provider.connection.getTokenAccountBalance(
    //     adminStablePoolContext.getAssociatedTokenAddress(mintUSDC),
    //   );

    //   // should be preloaded & up to date in real-time by event listener in dapp
    //   const pools = await adminStablePoolContext.loadPoolsByVault(vaultAddress);
    //   // pick the best pool
    //   const pool = pools
    //     .filter((pool) => pool.isActive)
    //     .sort((a, b) => b.getEstAmountOut(mintUSDH, mintUSDC, 100) - a.getEstAmountOut(mintUSDH, mintUSDC, 100))[0];
    //   if (!pool) assert.fail();

    //   // price info
    //   const amountOut = pool.getEstAmountOut(mintUSDH, mintUSDC, 100);
    //   // estimated amount out
    //   console.log("Est. amount out:", amountOut);
    //   // given slippage 0.1% (0.001)
    //   const minAmountOut = amountOut * (1 - 0.001);

    //   const ixs = await adminStablePoolContext.swapInstructions(
    //     vaultAddress,
    //     vaultContext.findVaultAuthorityAddress(vaultAddress),
    //     beneficiaryAddress,
    //     vaultContext.program.programId,
    //     poolAddress,
    //     mintUSDH,
    //     mintUSDC,
    //     6,
    //     6,
    //     "100",
    //     minAmountOut,
    //   );
    //   const tx = await adminStablePoolContext.newTX(ixs);
    //   await adminStablePoolContext.provider.sendAndConfirm!(tx);

    //   const { value: postBalance } = await provider.connection.getTokenAccountBalance(
    //     adminStablePoolContext.getAssociatedTokenAddress(mintUSDC),
    //   );
    //   console.log("USDC out:", postBalance.uiAmount! - balance.uiAmount!);
    // });

    // it("should swap 100 USDT for USDH", async () => {
    //   const { value: balance } = await provider.connection.getTokenAccountBalance(
    //     adminStablePoolContext.getAssociatedTokenAddress(mintUSDH),
    //   );

    //   // should be preloaded & up to date in real-time by event listener in dapp
    //   const pools = await adminStablePoolContext.loadPoolsByVault(vaultAddress);
    //   // pick the best pool
    //   const pool = pools
    //     .filter((pool) => pool.isActive)
    //     .sort((a, b) => b.getEstAmountOut(mintUSDT, mintUSDH, 100) - a.getEstAmountOut(mintUSDT, mintUSDH, 100))[0];
    //   if (!pool) assert.fail();

    //   // price info
    //   const amountOut = pool.getEstAmountOut(mintUSDT, mintUSDH, 100);
    //   // estimated amount out
    //   console.log("Est. amount out:", amountOut);
    //   // given slippage 0.1% (0.001)
    //   const minAmountOut = amountOut * (1 - 0.001);

    //   const ixs = await adminStablePoolContext.swapInstructions(
    //     vaultAddress,
    //     vaultContext.findVaultAuthorityAddress(vaultAddress),
    //     beneficiaryAddress,
    //     vaultContext.program.programId,
    //     poolAddress,
    //     mintUSDT,
    //     mintUSDH,
    //     6,
    //     6,
    //     "100",
    //     minAmountOut,
    //   );
    //   const tx = await adminStablePoolContext.newTX(ixs);
    //   await adminStablePoolContext.provider.sendAndConfirm!(tx);

    //   const { value: postBalance } = await provider.connection.getTokenAccountBalance(
    //     adminStablePoolContext.getAssociatedTokenAddress(mintUSDH),
    //   );
    //   console.log("USDH out:", postBalance.uiAmount! - balance.uiAmount!);
    // });
  });
});
