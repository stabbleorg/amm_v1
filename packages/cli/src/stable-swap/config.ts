import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function changeAmpFactor(program: Command) {
  program
    .command("stable-amp-factor")
    .description("change amplification factor")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--amp-factor <number>", "new amplification factor", Number)
    .requiredOption("--ramp-duration <number>", "ramp duration", Number)
    .action(
      async ({ poolK, ampFactor, rampDuration }: { poolK: PublicKey; ampFactor: number; rampDuration: number }) => {
        const { stableSwap, simulate } = useContext();

        const pool = await stableSwap.loadPool(poolK);

        console.log("Current amplification:", pool.amplification);

        if (simulate) return;

        const signature = await stableSwap.changeAmpFactor({
          pool,
          ampFactor,
          rampDuration,
        });

        console.log(signature);
      },
    );
}
