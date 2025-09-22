import type { Command } from "commander";
import { parseKey } from "../utils";
import { PublicKey } from "@solana/web3.js";
import { useContext } from "../context";
import { StableSwapContext } from "@stabbleorg/amm-sdk";

export function fetchPool(program: Command) {
  program
    .command("fetch-pool")
    .description("change max supply of LP token")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .action(async ({ poolK }: { poolK: PublicKey; maxSupply: string }) => {
      const { provider,  } = useContext();

      const stableSwap = new StableSwapContext(provider);
      const pool = await stableSwap.loadPool(poolK);

      console.log("Pool:", {
        ...pool,
        data: {
          ...pool.data,
          maxSupply: pool.data.maxSupply.toString(),
          rampStartTs: pool.data.rampStartTs.toString(),
          rampStopTs: pool.data.rampStopTs.toString(),
          tokens: JSON.stringify(pool.data.tokens.map(t => ({
            ...t,
          })), null, 2),
        },
      });
    })
}