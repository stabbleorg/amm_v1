import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { VaultContext, WeightedSwapContext, StableSwapContext, Swap } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function swap(program: Command) {
  program
    .command("swap")
    .requiredOption("--weighted-vault-k <string>", "weighted vault key", parseKey)
    .requiredOption("--stable-vault-k <string>", "stable vault key", parseKey)
    .requiredOption("--mint-in-k <string>", "mint in key", parseKey)
    .requiredOption("--mint-out-k <string>", "mint out key", parseKey)
    .requiredOption("--amount <number>", "swap amount")
    .option("--slippage <number>", "slippage tolerance", Number)
    .description("multi-hop swap with SOR")
    .action(
      async ({
        weightedVaultK,
        stableVaultK,
        mintInK,
        mintOutK,
        amount,
        slippage = 0.01, // 1%
      }: {
        weightedVaultK: PublicKey;
        stableVaultK: PublicKey;
        mintInK: PublicKey;
        mintOutK: PublicKey;
        amount: string;
        slippage?: number;
      }) => {
        const { provider, altAccounts, priorityLevel, simulate } = useContext();

        const vaultContext = new VaultContext(provider);
        const weightedSwap = new WeightedSwapContext(provider);
        const stableSwap = new StableSwapContext(provider);

        const vaults = await vaultContext.loadVaults();
        const weightedVault = vaults.find((vault) => vault.address.equals(weightedVaultK))!;
        const stableVault = vaults.find((vault) => vault.address.equals(stableVaultK))!;
        const pools = [...(await weightedSwap.loadPools(weightedVault)), ...(await stableSwap.loadPools(stableVault))];

        const amountIn = Number(amount);

        const { routes, amountOut, spotPrice } = Swap.searchRoutes({
          mintInAddress: mintInK,
          mintOutAddress: mintOutK,
          amountIn,
          pools,
        });

        const exchangeRate = amountOut / amountIn;
        const minimumAmountOut = amountOut * (1 - slippage);

        console.log("Estimation:", amountOut);
        console.log("Spot price:", spotPrice);
        console.log("Price impact:", Math.abs(1 - exchangeRate / spotPrice));
        console.log("Minimum received:", minimumAmountOut);
        console.log("Exchange rate:", exchangeRate);

        if (simulate) {
          console.log("Routes:");
          console.log(
            routes
              .map(
                (r) =>
                  r.pool.address.toBase58() + ": " + r.mintInAddress.toBase58() + " --> " + r.mintOutAddress.toBase58(),
              )
              .join("\n"),
          );
        }

        const signature = await Swap.batch({
          weightedSwap,
          stableSwap,
          routes,
          amountIn: amount,
          minimumAmountOut,
          altAccounts,
          priorityLevel,
          simulate,
        });

        console.log(signature);
      },
    );
}
