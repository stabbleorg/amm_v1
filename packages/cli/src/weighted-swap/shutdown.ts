import type { Command } from "commander";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { VaultContext, WeightedSwapContext } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function shutdown(program: Command) {
  program
    .command("weighted-shutdown")
    .description("shutdown weighted pool")
    .option("--vault-k <string>", "vault key", parseKey)
    .option("--pool-k <string>", "pool key", parseKey)
    .action(async ({ vaultK, poolK }: { vaultK?: PublicKey; poolK?: PublicKey }) => {
      const { provider, priorityLevel, simulate } = useContext();

      const weightedSwap = new WeightedSwapContext(provider);

      if (vaultK) {
        const vaultContext = new VaultContext(provider);
        const vault = await vaultContext.loadVault(vaultK);

        const pools = await weightedSwap.loadPools(vault);
        if (!pools.length) return;

        const emptyPools = pools.filter(
          (pool) => pool.tokens.reduce((total, token) => token.balance.uiAmount! + total, 0) === 0,
        );
        if (!emptyPools.length) return;

        const instructions: TransactionInstruction[] = [];
        for (const pool of emptyPools) {
          instructions.push(
            await weightedSwap.program.methods
              .shutdown()
              .accountsStrict({
                owner: pool.ownerAddress,
                pool: pool.address,
              })
              .instruction(),
          );
        }

        const signature = await weightedSwap.sendSmartTransaction(instructions, [], [], priorityLevel);

        console.log(signature);
      }

      if (poolK) {
        const pool = await weightedSwap.loadPool(poolK);

        const total = pool.tokens.reduce((total, token) => token.balance.uiAmount! + total, 0);

        let priceFeeds;
        if (total > 0) {
          const vaultContext = new VaultContext(provider);
          priceFeeds = await vaultContext.loadPriceFeeds(pool.vaultAddress);
        }

        const signature = await weightedSwap.shutdown({ pool, priceFeeds, priorityLevel, simulate });

        console.log(signature);
      }
    });
}
