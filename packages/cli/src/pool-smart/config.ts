import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { useContext, submitTX } from "../context";
import { parseKey, parseKeypair } from "../utils";

export function close(program: Command) {
  program
    .command("smart-close")
    .description("close smart pool")
    .requiredOption("--vault-k <string>", "vault key", parseKey)
    .requiredOption("--pool-k <string>", "vault key", parseKey)
    .action(async ({ vaultK, poolK }: { vaultK: PublicKey; poolK: PublicKey }) => {
      const { smart } = useContext();

      const { tx } = await smart.ctxSmart.newTX(
        await smart.ctxSmart.closeInstructions({ poolAddress: poolK, vaultAddress: vaultK }),
      );

      submitTX(tx);
    });
}
