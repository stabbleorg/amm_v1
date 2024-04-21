import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { useContext, submitTX } from "../context";
import { parseKey, parseKeypair } from "../utils";

export function initialize(program: Command) {
  program
    .command("vault-init")
    .description("initialize vault")
    .option("--vault-k-p <string>", "vault keypair", parseKeypair)
    .requiredOption("--pool-kind <string>", "pool kind")
    .requiredOption("--beneficiary-k <string>", "beneficiary key", parseKey)
    .requiredOption("--beneficiary-fee <string>", "beneficiary fee")
    .action(
      async ({
        vaultKP,
        poolKind,
        beneficiaryK,
        beneficiaryFee,
      }: {
        vaultKP?: Keypair;
        poolKind: "weighted" | "stable" | "smart";
        beneficiaryK: PublicKey;
        beneficiaryFee: string;
      }) => {
        const { amm, smart } = useContext();

        if (poolKind === "smart") {
          const { transaction, address } = await smart.createVaultAndAddress({
            beneficiaryAddress: beneficiaryK,
            beneficiaryFee,
            vaultKP,
          });

          submitTX(transaction);
          console.log("Vault:", address.toBase58());
        } else {
          const { transaction, address } = await amm.createVaultAndAddress({
            beneficiaryAddress: beneficiaryK,
            beneficiaryFee,
            poolKind,
            vaultKP,
          });

          submitTX(transaction);
          console.log("Vault:", address.toBase58());
        }
      },
    );
}
