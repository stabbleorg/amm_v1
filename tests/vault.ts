import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { createAssociatedTokenAccount, createMint, mintTo } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { VaultContext } from "@stabbleorg/amm-sdk";
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

describe("Vault", () => {
  const provider = AnchorProvider.env();
  provider.opts.commitment = "confirmed";
  provider.opts.maxRetries = 1;
  provider.opts.preflightCommitment = "confirmed";
  provider.opts.skipPreflight = true;

  const vaultCtx = new VaultContext(provider);

  before(async () => {
    await provider.connection.confirmTransaction({
      ...(await provider.connection.getLatestBlockhash()),
      signature: await provider.connection.requestAirdrop(MINT_AUTH_KP.publicKey, LAMPORTS_PER_SOL),
    });

    await createMint(provider.connection, MINT_AUTH_KP, MINT_AUTH_KP.publicKey, null, 6, USDC_MINT_KP);
    await mintTo(
      provider.connection,
      MINT_AUTH_KP,
      USDC_MINT_KP.publicKey,
      await createAssociatedTokenAccount(provider.connection, MINT_AUTH_KP, USDC_MINT_KP.publicKey, provider.publicKey),
      MINT_AUTH_KP,
      BigInt("2700000000000000"), // 2.7B
    );

    await createMint(provider.connection, MINT_AUTH_KP, MINT_AUTH_KP.publicKey, null, 6, USDT_MINT_KP);
    await mintTo(
      provider.connection,
      MINT_AUTH_KP,
      USDT_MINT_KP.publicKey,
      await createAssociatedTokenAccount(provider.connection, MINT_AUTH_KP, USDT_MINT_KP.publicKey, provider.publicKey),
      MINT_AUTH_KP,
      BigInt("1800000000000000"), // 1.8B
    );

    await createMint(provider.connection, MINT_AUTH_KP, MINT_AUTH_KP.publicKey, null, 8, DAI_MINT_KP);
    await mintTo(
      provider.connection,
      MINT_AUTH_KP,
      DAI_MINT_KP.publicKey,
      await createAssociatedTokenAccount(provider.connection, MINT_AUTH_KP, DAI_MINT_KP.publicKey, provider.publicKey),
      MINT_AUTH_KP,
      BigInt("70000000000000"), // 700K
    );

    await createMint(provider.connection, MINT_AUTH_KP, MINT_AUTH_KP.publicKey, null, 9, STB_MINT_KP);
    await mintTo(
      provider.connection,
      MINT_AUTH_KP,
      STB_MINT_KP.publicKey,
      await createAssociatedTokenAccount(provider.connection, MINT_AUTH_KP, STB_MINT_KP.publicKey, provider.publicKey),
      MINT_AUTH_KP,
      BigInt("500000000000000000"), // 500M
    );

    await createMint(provider.connection, MINT_AUTH_KP, MINT_AUTH_KP.publicKey, null, 5, BONK_MINT_KP);
    await mintTo(
      provider.connection,
      MINT_AUTH_KP,
      BONK_MINT_KP.publicKey,
      await createAssociatedTokenAccount(provider.connection, MINT_AUTH_KP, BONK_MINT_KP.publicKey, provider.publicKey),
      MINT_AUTH_KP,
      BigInt("10000000000000000000"), // 100T
    );
  });

  it("should create vault for weighted swap", async () => {
    await vaultCtx.initialize({
      keypair: WEIGHTED_VAULT_KP,
      beneficiaryAddress: Keypair.generate().publicKey,
      beneficiaryFee: 0.17,
      kind: "weighted_swap",
    });
  });

  it("should create vault for stable swap", async () => {
    await vaultCtx.initialize({
      keypair: STABLE_VAULT_KP,
      beneficiaryAddress: Keypair.generate().publicKey,
      beneficiaryFee: 0.17,
      kind: "stable_swap",
    });
  });
});
