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
        const { provider, altAccounts, simulate } = useContext();

        const stableSwap = new StableSwapContext(provider);
        const pool = await stableSwap.loadPool(poolK);

        const amountOut = pool.getSwapAmountOut(mintInK, mintOutK, amount);

        for (const [index, balance] of pool.balances.entries()) {
          console.log("Balance[%d]: %f", index, balance);
        }
        console.log("Amplification:", pool.amplification);
        console.log("Exchange rate:", amountOut / amount);
        console.log("Estimation:", amountOut);

        if (simulate) return;

        const signature = await stableSwap.swap({
          pool,
          mintInAddress: mintInK,
          mintOutAddress: mintOutK,
          amountIn: amount,
          minimumAmountOut: amountOut * (1 - slippage),
          altAccounts,
        });

        console.log(signature);
      },
    );
}
