import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function deposit(program: Command) {
  program
    .command("weighted-deposit")
    .description("add liquidity to weighted pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--mints <strings...>", "mint keys")
    .requiredOption("--amounts <numbers...>", "amounts")
    .action(async ({ poolK, mints, amounts }: { poolK: PublicKey; mints: string[]; amounts: string[] }) => {
      const { weightedSwap } = useContext();

      const mintAddresses = mints.map((mint) => new PublicKey(mint));

      const pool = await weightedSwap.loadPool(poolK);

      const signature = await weightedSwap.deposit({
        pool,
        mintAddresses,
        amounts,
      });

      console.log(signature);
    });
}
