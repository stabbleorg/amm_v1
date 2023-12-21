import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { useContext, submitTX } from "../context";
import { parseKey } from "../utils";

export function pause(program: Command) {
  program
    .command("pool-weighted-pause")
    .description("pause weighted pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .action(async ({ poolK }: { poolK: PublicKey }) => {
      const { sdk } = useContext();

      const tx = await sdk.ctxWeighted.newTX(await sdk.ctxWeighted.pauseInstructions(poolK));

      submitTX(tx);
    });
}
