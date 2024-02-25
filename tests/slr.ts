import { BN } from "bn.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  VaultContext,
  WeightedPoolContext,
  StablePoolContext,
  SmartPoolContext,
  SDKWrapper,
  SafeNumber,
} from "@stabbleorg/solana-sdk";
import { adminKP, usdcMintKP, usdcPoolKP } from "./consts";

describe("SLR", () => {
  const provider = AnchorProvider.env();
  const ctxVault = new VaultContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const ctxWeighted = new WeightedPoolContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const ctxStable = new StablePoolContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const ctxSmart = new SmartPoolContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const sdk = new SDKWrapper({
    vault: ctxVault,
    weighted: ctxWeighted,
    stable: ctxStable,
    smart: ctxSmart,
  });

  it("should create SLR pool", async () => {
    const { tx } = await sdk.createSmartPoolAndAddress({
      underlyingMintAddress: usdcMintKP.publicKey,
      maxLiquidity: 100000,
      poolKP: usdcPoolKP,
    });
    await sdk.ctxSmart.provider.sendAndConfirm!(tx);
  });

  it("should deposit", async () => {
    const pool = await sdk.ctxSmart.findOne(usdcPoolKP.publicKey);

    const tx = await sdk.deposit({
      pool,
      amount: 1000,
    });
    await sdk.ctxSmart.provider.sendAndConfirm!(tx);

    const { value: balance } = await provider.connection.getTokenAccountBalance(
      ctxWeighted.getAssociatedTokenAddress(pool.mintAddress),
    );
    console.log("LP out:", balance.uiAmountString);
  });

  it("should withdraw", async () => {
    const pool = await sdk.ctxSmart.findOne(usdcPoolKP.publicKey);

    const { value: balance } = await provider.connection.getTokenAccountBalance(
      ctxWeighted.getAssociatedTokenAddress(pool.underlyingMintAddress),
    );

    const tx = await sdk.withdraw({
      pool,
      amount: 1000,
    });
    await sdk.ctxSmart.provider.sendAndConfirm!(tx);

    const { value: postBalance } = await provider.connection.getTokenAccountBalance(
      ctxWeighted.getAssociatedTokenAddress(pool.underlyingMintAddress),
    );
    console.log(
      "USDC out:",
      SafeNumber.toUiAmountString(new BN(postBalance.amount).sub(new BN(balance.amount)), postBalance.decimals),
    );
  });
});
