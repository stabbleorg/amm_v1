import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { submitTX, useContext } from "../context";
import { parseKey, parseKeypair } from "../utils";

export function initialize(program: Command) {
  program
    .command("vault-init")
    .description("initialize vaults")
    .option("--weighted-vault-k-p <string>", "weighted vault keypair", parseKeypair)
    .option("--stable-vault-k-p <string>", "stable vault keypair", parseKeypair)
    .requiredOption("--beneficiary-k <string>", "beneficiary key", parseKey)
    .requiredOption("--beneficiary-fee <string>", "beneficiary fee")
    .action(
      async ({
        weightedVaultKP = Keypair.generate(),
        stableVaultKP = Keypair.generate(),
        beneficiaryK,
        beneficiaryFee,
      }: {
        weightedVaultKP?: Keypair;
        stableVaultKP?: Keypair;
        beneficiaryK: PublicKey;
        beneficiaryFee: string;
      }) => {
        const { vaultContext, weightedPoolContext, stablePoolContext } = useContext();

        const [weightedWithdrawAuthorityAddress, weightedWithdrawAuthorityBump] =
          weightedPoolContext.findWithdrawAuthorityAddressAndBump(weightedVaultKP.publicKey);
        const weightedIXs = await vaultContext.initializeInstructions(
          weightedVaultKP.publicKey,
          weightedWithdrawAuthorityAddress,
          weightedWithdrawAuthorityBump,
          beneficiaryK,
          beneficiaryFee,
        );

        const [stableWithdrawAuthorityAddress, stableWithdrawAuthorityBump] =
          stablePoolContext.findWithdrawAuthorityAddressAndBump(stableVaultKP.publicKey);
        const stableIXs = await vaultContext.initializeInstructions(
          stableVaultKP.publicKey,
          stableWithdrawAuthorityAddress,
          stableWithdrawAuthorityBump,
          beneficiaryK,
          beneficiaryFee,
        );

        const tx = await vaultContext.newTX([...weightedIXs, ...stableIXs]);
        tx.sign([weightedVaultKP, stableVaultKP]);
        submitTX(tx);

        console.log("Weighted Vault:", weightedVaultKP.publicKey.toBase58());
        console.log("Stable Vault:", stableVaultKP.publicKey.toBase58());
      },
    );
}
