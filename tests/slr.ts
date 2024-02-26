import { BN } from "bn.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { VaultContext, SmartPoolContext, Smart, SafeNumber } from "@stabbleorg/solana-sdk";
import { adminKP, smartVaultKP, usdcMintKP, usdcPoolKP } from "./consts";

describe("SLR", () => {
  const provider = AnchorProvider.env();
  const ctxVault = new VaultContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const ctxSmart = new SmartPoolContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const sdk = new Smart({
    vault: ctxVault,
    smart: ctxSmart,
  });

  it("should create SLR pool", async () => {
    const { tx } = await sdk.createSmartPoolAndAddress({
      vaultAddress: smartVaultKP.publicKey,
      quoteMintAddress: usdcMintKP.publicKey,
      maxLiquidity: 100000,
      poolKP: usdcPoolKP,
    });
    await sdk.ctxSmart.provider.sendAndConfirm!(tx);
  });

  it("should deposit", async () => {
    const pool = await sdk.ctxSmart.findOne(usdcPoolKP.publicKey);

    const { tx } = await sdk.deposit({
      pool,
      amount: 1000,
    });
    await sdk.ctxSmart.provider.sendAndConfirm!(tx);

    const { value: balance } = await provider.connection.getTokenAccountBalance(
      sdk.ctxSmart.getAssociatedTokenAddress(pool.mintAddress),
    );
    console.log("LP out:", balance.uiAmountString);
  });

  it("should withdraw", async () => {
    const pool = await sdk.ctxSmart.findOne(usdcPoolKP.publicKey);

    const { value: balance } = await provider.connection.getTokenAccountBalance(
      sdk.ctxSmart.getAssociatedTokenAddress(pool.quoteMintAddress),
    );

    const { tx } = await sdk.withdraw({
      pool,
      amount: 1000,
    });
    try {
      await sdk.ctxSmart.provider.sendAndConfirm!(tx);
    } catch (err) {
      console.error(err);
    }

    const { value: postBalance } = await provider.connection.getTokenAccountBalance(
      sdk.ctxSmart.getAssociatedTokenAddress(pool.quoteMintAddress),
    );
    console.log(
      "USDC out:",
      SafeNumber.toUiAmountString(new BN(postBalance.amount).sub(new BN(balance.amount)), postBalance.decimals),
    );
  });
});
