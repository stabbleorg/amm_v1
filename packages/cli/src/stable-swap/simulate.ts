import type { Command } from "commander";
import { table } from "table";
import { PublicKey } from "@solana/web3.js";
import { StableSwapContext } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";
import { SafeAmount } from "@stabbleorg/anchor-contrib";

export function simulate(program: Command) {
  program
    .command("stable-simulate")
    .description("simulate prices")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .action(async ({ poolK }: { poolK: PublicKey }) => {
      const { provider } = useContext();

      const stableSwap = new StableSwapContext(provider);
      const pool = await stableSwap.loadPool(poolK);

      const mintA = pool.tokens[0].mintAddress.toBase58();
      const mintB = pool.tokens[1].mintAddress.toBase58();

      console.log("AMP:", pool.amplification);
      console.log("\n");

      console.log("%s -> SOL", mintB.substring(0, 5));
      const t0_data = [["Amount In", "stabble Price", "Jupiter price", "Difference (%)"]];
      for (const amountIn of [0.01, 0.05, 0.1, 0.3, 0.5, 0.7, 1, 2]) {
        const quotURI = `https://api.jup.ag/swap/v1/quote?inputMint=${mintB}&outputMint=${mintA}&amount=${SafeAmount.toGiga(amountIn).toString()}`;
        const { outAmount } = (await (await fetch(quotURI)).json()) as any;
        const amountOutJupiter = SafeAmount.toNano(outAmount);

        const amountOut = pool.getSwapAmountOut(pool.tokens[1].mintAddress, pool.tokens[0].mintAddress, amountIn);

        t0_data.push([
          amountIn.toString(),
          (amountOut / amountIn).toFixed(9),
          (amountOutJupiter / amountIn).toFixed(9),
          ((amountOut / amountOutJupiter - 1) * 100).toFixed(4),
        ]);
      }
      console.log(table(t0_data));

      console.log("SOL -> %s", mintA.substring(0, 5));
      const t1_data = [["Amount In", "stabble Price", "Jupiter price", "Difference (%)"]];
      for (const amountIn of [0.01, 0.05, 0.1, 0.3, 0.5, 0.7, 1, 2]) {
        const quotURI = `https://api.jup.ag/swap/v1/quote?inputMint=${mintA}&outputMint=${mintB}&amount=${SafeAmount.toGiga(amountIn).toString()}`;
        const { outAmount } = (await (await fetch(quotURI)).json()) as any;
        const amountOutJupiter = SafeAmount.toNano(outAmount);

        const amountOut = pool.getSwapAmountOut(pool.tokens[0].mintAddress, pool.tokens[1].mintAddress, amountIn);

        t1_data.push([
          amountIn.toString(),
          (amountOut / amountIn).toFixed(9),
          (amountOutJupiter / amountIn).toFixed(9),
          ((amountOut / amountOutJupiter - 1) * 100).toFixed(4),
        ]);
      }
      console.log(table(t1_data));
    });
}
