import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { submitTX, useContext } from "../context";
import { parseKey } from "../utils";

export function deposit(program: Command) {
  program
    .command("pool-stable-deposit")
    .description("add liquidity to stable pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--amounts <number[]>", "amounts")
    .requiredOption("--mints <string[]>", "mint keys")
    .action(async ({ poolK, amounts, mints }: { poolK: PublicKey; amounts: string; mints: string }) => {
      const { vaultContext, stablePoolContext } = useContext();

      const pool = await stablePoolContext.loadPool(poolK);

      const ixs = await stablePoolContext.depositInstructions(
        pool.vaultAddress,
        vaultContext.findVaultAuthorityAddress(pool.vaultAddress),
        pool.address,
        pool.mintAddress,
        amounts.split(","),
        mints.split(",").map((mint) => pool.tokens.find((token) => token.mintAddress.toBase58() === mint)!.decimals),
        mints.split(",").map((mint) => new PublicKey(mint)),
      );
      const tx = await stablePoolContext.newTX(ixs);
      submitTX(tx);
    });
}
