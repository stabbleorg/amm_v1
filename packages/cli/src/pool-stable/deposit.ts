import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { useContext, submitTX } from "../context";
import { parseKey } from "../utils";

export function deposit(program: Command) {
  program
    .command("stable-deposit")
    .description("add liquidity to stable pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--amounts <numbers...>", "amounts")
    .requiredOption("--mints <strings...>", "mint keys")
    .action(async ({ poolK, amounts, mints }: { poolK: PublicKey; amounts: number[]; mints: string[] }) => {
      const { amm } = useContext();

      const pool = await amm.ctxStable.findOne(poolK);

      const { tx } = await amm.deposit({
        pool,
        amounts,
        mintAddresses: mints.map((pubkey) => new PublicKey(pubkey)),
      });

      submitTX(tx);
    });
}
