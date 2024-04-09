import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { createAssociatedTokenAccount, createMint, mintTo } from "@solana/spl-token";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  VaultContext,
  WeightedPoolContext,
  StablePoolContext,
  SmartPoolContext,
  Amm,
  Smart,
} from "@stabbleorg/solana-sdk";
import {
  weightedVaultKP,
  stableVaultKP,
  adminKP,
  beneficiaryKP,
  usdcMintKP,
  usdtMintKP,
  daiMintKP,
  stbMintKP,
  sbrMintKP,
  bonkMintKP,
  smartVaultKP,
} from "./consts";

describe("Vault", () => {
  const provider = AnchorProvider.env();
  const ctxVault = new VaultContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const ctxWeighted = new WeightedPoolContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const ctxStable = new StablePoolContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const ctxSmart = new SmartPoolContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));

  const amm = new Amm({
    vault: ctxVault,
    weighted: ctxWeighted,
    stable: ctxStable,
  });
  const smart = new Smart({
    vault: ctxVault,
    smart: ctxSmart,
  });

  before(async () => {
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(ctxVault.walletAddress, LAMPORTS_PER_SOL),
    );

    await createMint(provider.connection, adminKP, adminKP.publicKey, null, 6, usdcMintKP);
    await mintTo(
      provider.connection,
      adminKP,
      usdcMintKP.publicKey,
      await createAssociatedTokenAccount(provider.connection, adminKP, usdcMintKP.publicKey, adminKP.publicKey),
      adminKP,
      BigInt("5000000000000"), // 5M
    );

    await createMint(provider.connection, adminKP, adminKP.publicKey, null, 6, usdtMintKP);
    await mintTo(
      provider.connection,
      adminKP,
      usdtMintKP.publicKey,
      await createAssociatedTokenAccount(provider.connection, adminKP, usdtMintKP.publicKey, adminKP.publicKey),
      adminKP,
      BigInt("5000000000000"), // 5M
    );

    await createMint(provider.connection, adminKP, adminKP.publicKey, null, 8, daiMintKP);
    await mintTo(
      provider.connection,
      adminKP,
      daiMintKP.publicKey,
      await createAssociatedTokenAccount(provider.connection, adminKP, daiMintKP.publicKey, adminKP.publicKey),
      adminKP,
      BigInt("500000000000000"), // 5M
    );

    await createMint(provider.connection, adminKP, adminKP.publicKey, null, 9, stbMintKP);
    await mintTo(
      provider.connection,
      adminKP,
      stbMintKP.publicKey,
      await createAssociatedTokenAccount(provider.connection, adminKP, stbMintKP.publicKey, adminKP.publicKey),
      adminKP,
      BigInt("500000000000000000"), // 500M
    );

    await createMint(provider.connection, adminKP, adminKP.publicKey, null, 6, sbrMintKP);
    await mintTo(
      provider.connection,
      adminKP,
      sbrMintKP.publicKey,
      await createAssociatedTokenAccount(provider.connection, adminKP, sbrMintKP.publicKey, adminKP.publicKey),
      adminKP,
      BigInt("2000000000000000"), // 2B
    );

    await createMint(provider.connection, adminKP, adminKP.publicKey, null, 5, bonkMintKP);
    await mintTo(
      provider.connection,
      adminKP,
      bonkMintKP.publicKey,
      await createAssociatedTokenAccount(provider.connection, adminKP, bonkMintKP.publicKey, adminKP.publicKey),
      adminKP,
      BigInt("10000000000000000000"), // 200T
    );
  });

  it("should create vault for weighted pool", async () => {
    const { tx } = await amm.createVaultAndAddress({
      beneficiaryAddress: beneficiaryKP.publicKey,
      beneficiaryFee: 0.22,
      poolKind: "weighted",
      vaultKP: weightedVaultKP,
    });
    await amm.ctxVault.provider.sendAndConfirm!(tx);
  });

  it("should create vault for stable pool", async () => {
    const { tx } = await amm.createVaultAndAddress({
      beneficiaryAddress: beneficiaryKP.publicKey,
      beneficiaryFee: "0.22",
      poolKind: "stable",
      vaultKP: stableVaultKP,
    });
    await amm.ctxVault.provider.sendAndConfirm!(tx);
  });

  // it("should create vault for smart pool", async () => {
  //   const { tx } = await smart.createVaultAndAddress({
  //     beneficiaryAddress: beneficiaryKP.publicKey,
  //     beneficiaryFee: 0.14,
  //     vaultKP: smartVaultKP,
  //   });
  //   await amm.ctxVault.provider.sendAndConfirm!(tx);
  // });
});
