import type { Command } from "commander";
import { ProgramError } from "@coral-xyz/anchor";
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
        const { vaultContext, weightedSwap, stableSwap, simulate } = useContext();

        const vaults = await vaultContext.findAll();
        const weightedVault = vaults.find((vault) => vault.address.equals(weightedVaultK))!;
        const stableVault = vaults.find((vault) => vault.address.equals(stableVaultK))!;
        const pools = [
          ...(await weightedSwap.findByVault(weightedVault)),
          ...(await stableSwap.findByVault(stableVault)),
        ];

        const { value: altAccount } = await vaultContext.provider.connection.getAddressLookupTable(
          new PublicKey("DS8qxhzgB7H1oknHkUHrNa7esmbL4QDzxJwyxiHyryzc"),
        );

        try {
          const amountIn = Number(amount);

          const { routes, amountOut } = Swap.searchRoutes({
            mintInAddress: mintInK,
            mintOutAddress: mintOutK,
            amountIn,
            pools,
          });

          console.log("Price:", amountOut / amountIn);
          console.log("Estimation:", amountOut);

          if (simulate) {
            console.log("Routes:");
            console.log(
              routes
                .map(
                  (r) =>
                    r.pool.address.toBase58() +
                    ": " +
                    r.mintInAddress.toBase58() +
                    " --> " +
                    r.mintOutAddress.toBase58(),
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
            altAccounts: altAccount ? [altAccount] : undefined,
          });

          console.log("Signature:", signature);
        } catch (err) {
          const error = ProgramError.parse(
            err,
            vaultContext.program.idl.errors.reduce((idlErrors, error) => {
              idlErrors.set(error.code, error.msg);
              return idlErrors;
            }, new Map<number, string>()),
          );
          console.log(error?.msg);
        }
      },
    );
}
