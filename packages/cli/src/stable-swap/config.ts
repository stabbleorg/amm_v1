import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { StablePool } from "@stabbleorg/amm-sdk";
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
        const { vaultContext, stableSwap, simulate } = useContext();

        const data = await stableSwap.program.account.pool.fetch(poolK);
        const vault = await vaultContext.findOne(data.vault);
        const pool = new StablePool(vault, poolK, data);

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
