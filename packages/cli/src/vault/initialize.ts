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
        poolKind: "weighted" | "stable";
        beneficiaryK: PublicKey;
        beneficiaryFee: string;
      }) => {
        const { sdk } = useContext();

        const { tx, address } = await sdk.createVaultAndAddress({
          beneficiaryAddress: beneficiaryK,
          beneficiaryFee,
          poolKind,
          vaultKP,
        });

        submitTX(tx);
        console.log("Vault:", address.toBase58());
      },
    );
}
