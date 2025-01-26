import type { Command } from "commander";
import { getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { StableSwapContext } from "@stabbleorg/amm-sdk";
import { SafeAmount } from "@stabbleorg/anchor-contrib";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function withdraw(program: Command) {
  program
    .command("stable-withdraw")
    .description("add liquidity to stable pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--mints <strings...>", "mint keys")
    .requiredOption("--amount <number>", "amount", Number)
    .action(async ({ poolK, mints, amount }: { poolK: PublicKey; mints: string[]; amount: number }) => {
      const { provider, priorityLevel, simulate } = useContext();

      const stableSwap = new StableSwapContext(provider);
      const pool = await stableSwap.loadPool(poolK);

      const mint = await getMint(provider.connection, pool.mintAddress);
      const supply = SafeAmount.toUiAmount(mint.supply.toString(), mint.decimals);
      const balances = await stableSwap.getTokenBalances();

      console.log("Total LP:", supply);
      console.log("My LP:", balances.find((balance) => balance.address.equals(pool.mintAddress))?.uiAmount);

      const mintAddresses = mints.map((mint) => new PublicKey(mint));

      if (mints.length === 1) {
        const [amountOut] = pool.getWithdrawalAmountsOut(amount, supply, mintAddresses[0]);
        console.log("Estimation:", amountOut);
      } else {
        const amountsOut = pool.getWithdrawalAmountsOut(amount, supply);
        console.log("Estimation:", amountsOut.join(", "));
      }

      if (simulate) return;

      const signature = await stableSwap.withdraw({
        pool,
        mintAddresses,
        amount,
        priorityLevel,
      });

      console.log(signature);
    });
}
