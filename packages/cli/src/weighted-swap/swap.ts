import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { WeightedPool } from "@stabbleorg/amm-sdk";
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
    .action(
      async ({
        poolK,
        mintInK,
        mintOutK,
        amount,
      }: {
        poolK: PublicKey;
        mintInK: PublicKey;
        mintOutK: PublicKey;
        amount: number;
      }) => {
        const { vaultContext, weightedSwap, altAccounts, simulate } = useContext();

        const data = await weightedSwap.program.account.pool.fetch(poolK);
        const vault = await vaultContext.findOne(data.vault);
        const pool = new WeightedPool(vault, poolK, data);

        const amountOut = pool.getSwapAmountOut(mintInK, mintOutK, amount);
        // console.log("Balances:");
        // console.log(pool.balances.join("\n"));
        console.log("Price:", amountOut / amount);
        console.log("Estimation:", amountOut);

        if (simulate) return;

        const signature = await weightedSwap.swap({
          pool,
          mintInAddress: mintInK,
          mintOutAddress: mintOutK,
          amountIn: amount,
          minimumAmountOut: amountOut * (1 - 0.0005), // slippage: 0.05%
          altAccounts,
        });

        console.log(signature);
      },
    );
}
