import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { submitTX, useContext } from "../context";
import { parseKey } from "../utils";

export function deposit(program: Command) {
  program
    .command("pool-weighted-deposit")
    .description("add liquidity to weighted pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--amounts <number[]>", "amounts")
    .requiredOption("--mints <string[]>", "mint keys")
    .action(async ({ poolK, amounts, mints }: { poolK: PublicKey; amounts: string; mints: string }) => {
      const { vaultContext, weightedPoolContext } = useContext();

      const pool = await weightedPoolContext.loadPool(poolK);

      const ixs = await weightedPoolContext.depositInstructions(
        pool.vaultAddress,
        vaultContext.findVaultAuthorityAddress(pool.vaultAddress),
        pool.address,
        pool.mintAddress,
        amounts.split(","),
        mints.split(",").map((mint) => pool.tokens.find((token) => token.mintAddress.toBase58() === mint)!.decimals),
        mints.split(",").map((mint) => new PublicKey(mint)),
      );
      const tx = await weightedPoolContext.newTX(ixs);
      submitTX(tx);
    });
}
