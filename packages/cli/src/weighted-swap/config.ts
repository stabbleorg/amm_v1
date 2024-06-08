import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { WeightedSwapContext } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function changeSwapFee(program: Command) {
  program
    .command("weighted-swap-fee")
    .description("change swap fee")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--swap-fee <string>", "new swap fee")
    .action(async ({ poolK, swapFee }: { poolK: PublicKey; swapFee: string }) => {
      const { provider, simulate } = useContext();

      const weightedSwap = new WeightedSwapContext(provider);
      const pool = await weightedSwap.loadPool(poolK);

      console.log("Current swap fee:", pool.swapFee);

      if (simulate) return;

      const signature = await weightedSwap.changeSwapFee({
        pool,
        swapFee,
      });

      console.log(signature);
    });
}
