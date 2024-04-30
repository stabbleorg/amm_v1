import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { PoolKind } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey, parseKeypair } from "../utils";

export function initialize(program: Command) {
  program
    .command("vault-init")
    .description("initialize vault")
    .requiredOption("--kind <string>", "pool kind")
    .requiredOption("--beneficiary-fee <number>", "beneficiary fee")
    .requiredOption("--beneficiary-k <string>", "beneficiary key", parseKey)
    .option("--vault-k-p <path>", "vault keypair", parseKeypair)
    .action(
      async ({
        kind,
        beneficiaryFee,
        beneficiaryK,
        vaultKP,
      }: {
        kind: PoolKind;
        beneficiaryFee: string;
        beneficiaryK: PublicKey;
        vaultKP?: Keypair;
      }) => {
        const { vaultContext } = useContext();

        const signature = await vaultContext.initialize({
          keypair: vaultKP,
          beneficiaryAddress: beneficiaryK,
          beneficiaryFee,
          kind,
        });

        console.log("Signature:", signature);
      },
    );
}
