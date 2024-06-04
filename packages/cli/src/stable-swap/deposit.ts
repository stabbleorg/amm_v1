import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { StableSwapContext } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function deposit(program: Command) {
  program
    .command("stable-deposit")
    .description("add liquidity to stable pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--mints <strings...>", "mint keys")
    .requiredOption("--amounts <numbers...>", "amounts")
    .action(async ({ poolK, mints, amounts }: { poolK: PublicKey; mints: string[]; amounts: string[] }) => {
      const { provider } = useContext();

      const stableSwap = new StableSwapContext(provider);
      const pool = await stableSwap.loadPool(poolK);

      const mintAddresses = mints.map((mint) => new PublicKey(mint));

      const signature = await stableSwap.deposit({
        pool,
        mintAddresses,
        amounts,
      });

      console.log(signature);
    });
}
