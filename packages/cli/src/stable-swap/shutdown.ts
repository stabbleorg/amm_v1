import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { VaultContext, StableSwapContext } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function shutdown(program: Command) {
  program
    .command("stable-shutdown")
    .description("shutdown stable pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .action(async ({ poolK }: { poolK: PublicKey }) => {
      const { provider, priorityLevel, simulate } = useContext();

      const stableSwap = new StableSwapContext(provider);
      const pool = await stableSwap.loadPool(poolK);

      const total = pool.tokens.reduce((total, token) => token.balance.uiAmount! + total, 0);

      let priceFeeds;
      if (total > 0) {
        const vaultContext = new VaultContext(provider);
        priceFeeds = await vaultContext.loadPriceFeeds(pool.vaultAddress);
      }

      const signature = await stableSwap.shutdown({ pool, priceFeeds, priorityLevel, simulate });

      console.log(signature);
    });
}
