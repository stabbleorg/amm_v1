import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { StablePool } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function shutdown(program: Command) {
  program
    .command("stable-shutdown")
    .description("shutdown stable pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .action(async ({ poolK }: { poolK: PublicKey }) => {
      const { vaultContext, stableSwap } = useContext();

      const data = await stableSwap.program.account.pool.fetch(poolK);
      const vault = await vaultContext.findOne(data.vault);
      const pool = new StablePool(vault, poolK, data);

      const signature = await stableSwap.shutdown({ pool });

      console.log(signature);
    });
}
