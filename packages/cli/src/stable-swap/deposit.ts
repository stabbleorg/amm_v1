import type { Command } from "commander";
import { getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { StableSwapContext } from "@stabbleorg/amm-sdk";
import { SafeAmount } from "@stabbleorg/anchor-contrib";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function deposit(program: Command) {
  program
    .command("stable-deposit")
    .description("add liquidity to stable pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--mints <strings...>", "mint keys")
    .requiredOption("--amounts <numbers...>", "amounts")
    .action(async ({ poolK, mints, amounts }: { poolK: PublicKey; mints: string[]; amounts: string[] }) => {
      const { provider, priorityLevel, simulate } = useContext();

      const stableSwap = new StableSwapContext(provider);
      const pool = await stableSwap.loadPool(poolK);

      const mint = await getMint(provider.connection, pool.mintAddress);
      const supply = SafeAmount.toUiAmount(mint.supply.toString(), mint.decimals);

      const mintAddresses = mints.map((mint) => new PublicKey(mint));
      const amountsIn = amounts.map((amount) => Number(amount));

      if (mints.length === 1) {
        const amountOut = pool.getPoolTokenAmountOut(amountsIn, supply, mintAddresses[0]);
        console.log("Estimation:", amountOut);
      } else {
        const amountOut = pool.getPoolTokenAmountOut(amountsIn, supply);
        console.log("Estimation:", amountOut);
      }

      if (simulate) return;

      const signature = await stableSwap.deposit({
        pool,
        mintAddresses,
        amounts,
        priorityLevel,
      });

      console.log(signature);
    });
}
