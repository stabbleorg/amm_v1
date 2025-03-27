import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { StableSwapContext } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function swap(program: Command) {
  program
    .command("stable-swap")
    .description("simple swap given a stable pool")
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
        slippage = 0.0001,
      }: {
        poolK: PublicKey;
        mintInK: PublicKey;
        mintOutK: PublicKey;
        amount: number;
        slippage: number;
      }) => {
        const { provider, altAccounts, priorityLevel, simulate } = useContext();

        const stableSwap = new StableSwapContext(provider);
        const pool = await stableSwap.loadPool(poolK);

        const amountOut = pool.getSwapAmountOut(mintInK, mintOutK, amount);

        let index = 0;
        for (const balance of pool.balances) {
          console.log("Balance[%d]: %f", index, balance);
          console.log(
            "Tick[%d]: %f, %s",
            index,
            pool.data.tokens[index].scalingFactor,
            pool.data.tokens[index].scalingUp,
          );
          index++;
        }
        console.log("Amplification:", pool.amplification);
        console.log("Exchange rate:", amountOut / amount);
        console.log("Estimation:", amountOut);

        const signature = await stableSwap.swap({
          pool,
          mintInAddress: mintInK,
          mintOutAddress: mintOutK,
          amountIn: amount,
          minimumAmountOut: amountOut * (1 - slippage),
          altAccounts,
          priorityLevel,
          simulate,
        });

        console.log(signature);
      },
    );
}
