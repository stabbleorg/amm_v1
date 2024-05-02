import type { Command } from "commander";
import { getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { StablePool } from "@stabbleorg/amm-sdk";
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
      const { vaultContext, stableSwap, provider, simulate } = useContext();

      const mintAddresses = mints.map((mint) => new PublicKey(mint));

      const data = await stableSwap.program.account.pool.fetch(poolK);
      const vault = await vaultContext.findOne(data.vault);
      const pool = new StablePool(vault, poolK, data);

      const mint = await getMint(provider.connection, pool.mintAddress);
      const supply = SafeAmount.toUiAmount(mint.supply.toString(), mint.decimals);
      const balances = await stableSwap.getTokenBalances();

      console.log("Total LP:", supply);
      console.log("My LP:", balances.find((balance) => balance.address.equals(pool.mintAddress))?.uiAmount);

      if (mints.length === 1) {
        const amountOut = pool.getWithdrawalAmountsOut(amount, supply, mintAddresses[0]);
        console.log("Estimation:", amountOut[0]);
      } else {
        const amountsOut = pool.getWithdrawalAmountsOut(amount, supply);
        console.log("Estimation:", amountsOut.join(", "));
      }

      if (simulate) return;

      const signature = await stableSwap.withdraw({
        pool,
        mintAddresses,
        amount,
      });

      console.log(signature);
    });
}
