import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { PoolKind } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey, parseKeypair } from "../utils";

export function initialize(program: Command) {
  program
    .command("vault-init")
    .description("initialize vault")
    .option("--k-p <string>", "vault keypair", parseKeypair)
    .requiredOption("--kind <string>", "pool kind")
    .requiredOption("--beneficiary-k <string>", "beneficiary key", parseKey)
    .requiredOption("--beneficiary-fee <string>", "beneficiary fee")
    .action(
      async ({
        keypair,
        kind,
        beneficiaryK,
        beneficiaryFee,
      }: {
        keypair?: Keypair;
        kind: PoolKind;
        beneficiaryK: PublicKey;
        beneficiaryFee: string;
      }) => {
        const { vaultContext } = useContext();

        const signature = await vaultContext.initialize({
          keypair,
          beneficiaryAddress: beneficiaryK,
          beneficiaryFee,
          kind,
        });

        console.log("Signature:", signature);
      },
    );
}
