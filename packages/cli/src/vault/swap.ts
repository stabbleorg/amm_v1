import type { Command } from "commander";
import { AnchorError, ProgramError } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Swap } from "@stabbleorg/amm-sdk";
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
        const { vaultContext, weightedSwap, stableSwap, altAccounts, simulate } = useContext();

        const vaults = await vaultContext.loadVaults();
        const weightedVault = vaults.find((vault) => vault.address.equals(weightedVaultK))!;
        const stableVault = vaults.find((vault) => vault.address.equals(stableVaultK))!;
        const pools = [...(await weightedSwap.loadPools(weightedVault)), ...(await stableSwap.loadPools(stableVault))];

        const amountIn = Number(amount);

        const { routes, amountOut } = Swap.searchRoutes({
          mintInAddress: mintInK,
          mintOutAddress: mintOutK,
          amountIn,
          pools,
        });

        console.log("Exchange rate:", amountOut / amountIn);
        console.log("Estimation:", amountOut);

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
          return;
        }

        const minimumAmountOut = amountOut * (1 - slippage);

        const signature = await Swap.batch({
          weightedSwap,
          stableSwap,
          routes,
          amountIn: amount,
          minimumAmountOut,
          altAccounts,
        });

        console.log(signature);
      },
    );
}
