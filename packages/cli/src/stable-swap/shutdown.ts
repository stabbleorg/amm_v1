import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function shutdown(program: Command) {
  program
    .command("stable-shutdown")
    .description("shutdown stable pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .action(async ({ poolK }: { poolK: PublicKey }) => {
      const { stableSwap } = useContext();

      const pool = await stableSwap.loadPool(poolK);

      const signature = await stableSwap.shutdown({ pool });

      console.log(signature);
    });
}
