import type { Command } from "commander";
import fs from "fs";
import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { VaultContext, WeightedSwapContext, StableSwapContext } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";

export function check(program: Command) {
  program
    .command("vault-check")
    .description("check vault balances")
    .action(async () => {
      const { provider } = useContext();

      const vaultContext = new VaultContext(provider);
      const weightedSwap = new WeightedSwapContext(provider);
      const stableSwap = new StableSwapContext(provider);

      const headers = ["mint_address", "vault_balance", "vault_raw_balance", "total_raw_amount", "epsilion_raw_amount"];
      const vaults = await vaultContext.loadVaults();

      {
        const vault = vaults.find((vault) =>
          vault.address.equals(new PublicKey("w8edo9a9TDw52c1rBmVbP6dNakaAuFiPjDd52ZJwwVi")),
        );

        if (vault) {
          const lines = [headers.join(",")];
          const pools = await weightedSwap.loadPools(vault);

          const balances = pools.reduce(
            (result, pool) => {
              for (const token of pool.tokens) {
                const id = token.mintAddress.toBase58();
                if (result[id] === undefined) {
                  result[id] = new BN(token.balance.amount);
                } else {
                  result[id] = result[id].add(new BN(token.balance.amount));
                }
              }
              return result;
            },
            {} as Record<string, BN>,
          );

          for (const address of Object.keys(balances)) {
            const { value: balance } = await weightedSwap.provider.connection.getTokenAccountBalance(
              vault.getAuthorityTokenAddress(new PublicKey(address)),
            );
            lines.push(
              [
                address,
                balance.uiAmountString,
                balance.amount,
                balances[address].toString(),
                new BN(balance.amount).sub(balances[address]).toString(),
              ].join(","),
            );
          }

          fs.writeFileSync("weighted_vault.csv", lines.join("\n"), { encoding: "utf-8" });
        }
      }

      {
        const vault = vaults.find((vault) =>
          vault.address.equals(new PublicKey("stab1io8dHvK26KoHmTwwHyYmHRbUWbyEJx6CdrGabC")),
        );

        if (vault) {
          const lines = [headers.join(",")];
          const pools = await stableSwap.loadPools(vault);

          const balances = pools.reduce(
            (result, pool) => {
              for (const token of pool.tokens) {
                const id = token.mintAddress.toBase58();
                if (result[id] === undefined) {
                  result[id] = new BN(token.balance.amount);
                } else {
                  result[id] = result[id].add(new BN(token.balance.amount));
                }
              }
              return result;
            },
            {} as Record<string, BN>,
          );

          for (const address of Object.keys(balances)) {
            const { value: balance } = await weightedSwap.provider.connection.getTokenAccountBalance(
              vault.getAuthorityTokenAddress(new PublicKey(address)),
            );
            lines.push(
              [
                address,
                balance.uiAmountString,
                balance.amount,
                balances[address].toString(),
                new BN(balance.amount).sub(balances[address]).toString(),
              ].join(","),
            );
          }

          fs.writeFileSync("stable_vault.csv", lines.join("\n"), { encoding: "utf-8" });
        }
      }
    });
}
