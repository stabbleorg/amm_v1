import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { WeightedSwapContext } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function shutdown(program: Command) {
  program
    .command("weighted-shutdown")
    .description("shutdown weighted pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .action(async ({ poolK }: { poolK: PublicKey }) => {
      const { provider, priorityLevel, simulate } = useContext();

      const weightedSwap = new WeightedSwapContext(provider);
      const pool = await weightedSwap.loadPool(poolK);

      const signature = await weightedSwap.shutdown({ pool, priorityLevel, simulate });

      console.log(signature);
    });
}
