import type { Command } from "commander";
import { useContext } from "../context";
import { parseKey } from "../utils";
import { VaultContext } from "@stabbleorg/amm-sdk";
import { PublicKey } from "@solana/web3.js";

export function fetch(program: Command) {
  program
    .command("vault-fetch")
    .description("check vault balances")
    .requiredOption("--vault-k <string>", "vault key", parseKey)
    .action(async ({ vaultK }: { vaultK: PublicKey; }) => {
      const { provider } = useContext();
      console.log(provider.publicKey.toBase58());

      const vaultContext = new VaultContext(provider);
      const vault = await vaultContext.loadVault(vaultK);
      console.log({
        ...vault,
        data: {
          ...vault.data,
          beneficiaryFee: vault.data.beneficiaryFee.toString(),
        }
      });
    })
};