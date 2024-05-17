import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { WeightedPool } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function shutdown(program: Command) {
  program
    .command("weighted-shutdown")
    .description("shutdown weighted pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .action(async ({ poolK }: { poolK: PublicKey }) => {
      const { vaultContext, weightedSwap } = useContext();

      const data = await weightedSwap.program.account.pool.fetch(poolK);
      const vault = await vaultContext.findOne(data.vault);
      const pool = new WeightedPool(vault, poolK, data);

      const signature = await weightedSwap.shutdown({ pool });

      console.log(signature);
    });
}
