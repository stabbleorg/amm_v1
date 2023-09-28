import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { VaultContext, WeightedPoolContext, StablePoolContext } from "@stabbleorg/solana-sdk";
import { weightedVaultKP, stableVaultKP, adminKP, beneficiaryKP, beneficiaryFee } from "./consts";

describe("Vault", () => {
  const provider = AnchorProvider.env();
  const adminVaultContext = new VaultContext(new AnchorProvider(provider.connection, new Wallet(adminKP), {}));
  const weightedPoolContext = new WeightedPoolContext({ connection: provider.connection });
  const stablePoolContext = new StablePoolContext({ connection: provider.connection });

  before(async () => {
    await adminVaultContext.confirmTX(
      await provider.connection.requestAirdrop(adminVaultContext.walletAddress, LAMPORTS_PER_SOL),
    );
  });

  it("should initialize vault for pool-weighted program", async () => {
    const vaultAddress = weightedVaultKP.publicKey;
    const [withdrawAuthorityAddress, withdrawAuthorityBump] =
      weightedPoolContext.findWithdrawAuthorityAddressAndBump(vaultAddress);
    const ixs = await adminVaultContext.initializeInstructions(
      vaultAddress,
      withdrawAuthorityAddress,
      withdrawAuthorityBump,
      beneficiaryKP.publicKey,
      beneficiaryFee,
    );
    const tx = await adminVaultContext.newTX(ixs);
    tx.sign([weightedVaultKP]);
    await adminVaultContext.provider.sendAndConfirm!(tx);
  });

  it("should initialize vault for pool-stable program", async () => {
    const vaultAddress = stableVaultKP.publicKey;
    const [withdrawAuthorityAddress, withdrawAuthorityBump] =
      stablePoolContext.findWithdrawAuthorityAddressAndBump(vaultAddress);
    const ixs = await adminVaultContext.initializeInstructions(
      vaultAddress,
      withdrawAuthorityAddress,
      withdrawAuthorityBump,
      beneficiaryKP.publicKey,
      beneficiaryFee,
    );
    const tx = await adminVaultContext.newTX(ixs);
    tx.sign([stableVaultKP]);
    await adminVaultContext.provider.sendAndConfirm!(tx);
  });
});
