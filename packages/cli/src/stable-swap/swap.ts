import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { StablePool } from "@stabbleorg/amm-sdk";
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
        const { vaultContext, stableSwap, altAccounts, simulate } = useContext();

        const data = await stableSwap.program.account.pool.fetch(poolK);
        const vault = await vaultContext.findOne(data.vault);
        const pool = new StablePool(vault, poolK, data);

        const amountOut = pool.getSwapAmountOut(mintInK, mintOutK, amount);

        for (const [index, balance] of pool.balances.entries()) {
          console.log("b[%d]: %f", index, balance);
        }
        console.log("Amplification:", pool.amplification);
        console.log("Price:", amountOut / amount);
        console.log("Estimation:", amountOut);

        if (simulate) return;

        const signature = await stableSwap.swap({
          pool,
          mintInAddress: mintInK,
          mintOutAddress: mintOutK,
          amountIn: amount,
          minimumAmountOut: amountOut * (1 - 0.0001), // slippage: 0.01%
          altAccounts,
        });

        console.log(signature);
      },
    );
}
