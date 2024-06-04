import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { WeightedSwapContext } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function swap(program: Command) {
  program
    .command("weighted-swap")
    .description("simple swap given a weighted pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--mint-in-k <string>", "mint in key", parseKey)
    .requiredOption("--mint-out-k <string>", "mint out key", parseKey)
    .requiredOption("--amount <number>", "amount to sell", Number)
    .option("--slippage <number>", "slippage", Number)
    .action(
      async ({
        poolK,
        mintInK,
        mintOutK,
        amount,
        slippage = 0.005,
      }: {
        poolK: PublicKey;
        mintInK: PublicKey;
        mintOutK: PublicKey;
        amount: number;
        slippage: number;
      }) => {
        const { provider, altAccounts, simulate } = useContext();

        const weightedSwap = new WeightedSwapContext(provider);
        const pool = await weightedSwap.loadPool(poolK);

        const amountOut = pool.getSwapAmountOut(mintInK, mintOutK, amount);
        for (const [index, balance] of pool.balances.entries()) {
          console.log("b[%d]: %f", index, balance);
        }
        console.log("Invariant:", pool.invariant);
        console.log("Exchange rate:", amountOut / amount);
        console.log("Estimation:", amountOut);

        if (simulate) return;

        const signature = await weightedSwap.swap({
          pool,
          mintInAddress: mintInK,
          mintOutAddress: mintOutK,
          amountIn: amount,
          minimumAmountOut: amountOut * (1 - slippage), // slippage: 0.05%
          altAccounts,
        });

        console.log(signature);
      },
    );
}
