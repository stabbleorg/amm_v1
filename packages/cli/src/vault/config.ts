import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { VaultContext } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function transferAdmin(program: Command) {
  program
    .command("vault-transfer-admin")
    .description("transfer admin authority")
    .requiredOption("--vault-k <string>", "vault key", parseKey)
    .requiredOption("--admin-k <string>", "new admin key", parseKey)
    .action(async ({ vaultK, adminK }: { vaultK: PublicKey; adminK: PublicKey }) => {
      const { provider, simulate } = useContext();

      const vaultContext = new VaultContext(provider);
      const vault = await vaultContext.loadVault(vaultK);

      if (simulate) return;

      const signature = await vaultContext.transferAdmin({
        vault,
        adminAddress: adminK,
      });

      console.log(signature);
    });
}
