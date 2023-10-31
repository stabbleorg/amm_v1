import { BN } from "bn.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  SlrContext,
  VaultContext,
  WeightedPoolContext,
  StablePoolContext,
  SDKWrapper,
  TokenAmountUtil,
} from "@stabbleorg/solana-sdk";
import { adminKP, usdcMintKP, usdcPoolKP } from "./consts";

describe("SLR", () => {
  const provider = AnchorProvider.env();
  const ctxSlr = new SlrContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const ctxVault = new VaultContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const ctxWeighted = new WeightedPoolContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const ctxStable = new StablePoolContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const sdk = new SDKWrapper({
    slr: ctxSlr,
    vault: ctxVault,
    weighted: ctxWeighted,
    stable: ctxStable,
  });

  it("should create SLR pool", async () => {
    const { tx } = await sdk.createSlrPoolAndAddress({
      underlyingMintAddress: usdcMintKP.publicKey,
      maxLiquidity: 100000,
      poolKP: usdcPoolKP,
    });
    await sdk.ctxSlr.provider.sendAndConfirm!(tx);
  });

  it("should deposit", async () => {
    const pool = await sdk.ctxSlr.findOne(usdcPoolKP.publicKey);

    const tx = await sdk.deposit({
      pool,
      amount: 1000,
    });
    await sdk.ctxSlr.provider.sendAndConfirm!(tx);

    const { value: balance } = await provider.connection.getTokenAccountBalance(
      ctxWeighted.getAssociatedTokenAddress(pool.mintAddress),
    );
    console.log("LP out:", balance.uiAmountString);
  });

  it("should withdraw", async () => {
    const pool = await sdk.ctxSlr.findOne(usdcPoolKP.publicKey);

    const { value: balance } = await provider.connection.getTokenAccountBalance(
      ctxWeighted.getAssociatedTokenAddress(pool.underlyingMintAddress),
    );

    const tx = await sdk.withdraw({
      pool,
      amount: 1000,
    });
    await sdk.ctxSlr.provider.sendAndConfirm!(tx);

    const { value: postBalance } = await provider.connection.getTokenAccountBalance(
      ctxWeighted.getAssociatedTokenAddress(pool.underlyingMintAddress),
    );
    console.log(
      "USDC out:",
      TokenAmountUtil.toUiAmountString(new BN(postBalance.amount).sub(new BN(balance.amount)), postBalance.decimals),
    );
  });
});
