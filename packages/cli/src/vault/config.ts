import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { VaultContext } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function changeBeneficiary(program: Command) {
  program
    .command("vault-beneficiary")
    .description("change beneficiary address")
    .requiredOption("--vault-k <string>", "vault key", parseKey)
    .requiredOption("--beneficiary-k <string>", "new beneficiary key", parseKey)
    .action(async ({ vaultK, beneficiaryK }: { vaultK: PublicKey; beneficiaryK: PublicKey }) => {
      const { provider, simulate } = useContext();

      const vaultContext = new VaultContext(provider);
      const vault = await vaultContext.loadVault(vaultK);

      if (simulate) return;

      const signature = await vaultContext.changeBeneficiary({
        vault,
        beneficiaryAddress: beneficiaryK,
      });

      console.log(signature);
    });
}

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
