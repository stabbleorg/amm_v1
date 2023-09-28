import { assert, expect } from "chai";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createAssociatedTokenAccount, createMint, mintTo } from "@solana/spl-token";
import { TokenAmountUtil, VaultContext, StablePoolContext } from "@stabbleorg/solana-sdk";
import { stableVaultKP, stableN3PoolKP, stableN3PoolMintKP, adminKP, userKP, swapFee } from "./consts";

describe("Stable Pool", () => {
  const provider = AnchorProvider.env();
  const adminStablePoolContext = new StablePoolContext(
    new AnchorProvider(provider.connection, new Wallet(adminKP), {}),
  );
  const userStablePoolContext = new StablePoolContext(new AnchorProvider(provider.connection, new Wallet(userKP), {}));
  const vaultContext = new VaultContext({ connection: provider.connection });
  const vaultAddress = stableVaultKP.publicKey;

  let mintUSDH: PublicKey, mintUSDT: PublicKey, mintUSDC: PublicKey;

  describe("USDH-USDT-USDC", () => {
    const poolAddress = stableN3PoolKP.publicKey;
    const poolMintAddress = stableN3PoolMintKP.publicKey;

    before(async () => {
      await userStablePoolContext.confirmTX(
        await provider.connection.requestAirdrop(userStablePoolContext.walletAddress, LAMPORTS_PER_SOL),
      );

      mintUSDH = await createMint(provider.connection, adminKP, adminKP.publicKey, null, 6);
      mintUSDT = await createMint(provider.connection, adminKP, adminKP.publicKey, null, 6);
      mintUSDC = await createMint(provider.connection, adminKP, adminKP.publicKey, null, 6);

      const adminSTBAddress = await createAssociatedTokenAccount(
        provider.connection,
        adminKP,
        mintUSDH,
        adminKP.publicKey,
      );
      await mintTo(
        provider.connection,
        adminKP,
        mintUSDH,
        adminSTBAddress,
        adminKP,
        BigInt(TokenAmountUtil.toBigAmount(100000000, 6).toString()),
      );

      const adminETHAddress = await createAssociatedTokenAccount(
        provider.connection,
        adminKP,
        mintUSDT,
        adminKP.publicKey,
      );
      await mintTo(
        provider.connection,
        adminKP,
        mintUSDT,
        adminETHAddress,
        adminKP,
        BigInt(TokenAmountUtil.toBigAmount(100000000, 6).toString()),
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

    it("should initialize stable pool", async () => {
      const ixs = await adminStablePoolContext.initializeInstructions(
        vaultAddress,
        poolAddress,
        poolMintAddress,
        swapFee,
        500,
        [mintUSDH, mintUSDT, mintUSDC],
      );
      const tx = await adminStablePoolContext.newTX(ixs);
      tx.sign([stableN3PoolMintKP, stableN3PoolKP]);
      try {
        await adminStablePoolContext.provider.sendAndConfirm!(tx);
      } catch (err) {
        console.error(err);
      }
    });

    it("should add initial liquidity", async () => {
      const ixs = await adminStablePoolContext.depositInstructions(
        vaultAddress,
        vaultContext.findVaultAuthorityAddress(vaultAddress),
        poolAddress,
        poolMintAddress,
        ["500000", "250000", "250000"],
        [6, 6, 6],
        [mintUSDH, mintUSDT, mintUSDC],
      );
      const tx = await adminStablePoolContext.newTX(ixs);
      await adminStablePoolContext.provider.sendAndConfirm!(tx);

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        adminStablePoolContext.getAssociatedTokenAddress(poolMintAddress),
      );
      console.log("LP out:", balance.uiAmount!);
    });
  });
});
