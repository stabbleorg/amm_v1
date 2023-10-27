import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { useContext, submitTX } from "../context";
import { parseKey } from "../utils";

export function deposit(program: Command) {
  program
    .command("pool-weighted-deposit")
    .description("add liquidity to weighted pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--amounts <numbers...>", "amounts")
    .requiredOption("--mints <strings...>", "mint keys")
    .action(async ({ poolK, amounts, mints }: { poolK: PublicKey; amounts: number[]; mints: string[] }) => {
      const { sdk } = useContext();

      const pool = await sdk.ctxWeighted.findOne(poolK);

      const tx = await sdk.addLiquidity({
        pool,
        amounts,
        mintAddresses: mints.map((pubkey) => new PublicKey(pubkey)),
      });

      submitTX(tx);
    });
}
