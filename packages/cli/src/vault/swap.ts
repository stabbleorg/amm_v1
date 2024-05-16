import type { Command } from "commander";
import { Swap } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { PublicKey } from "@metaplex-foundation/js";
import { AddressLookupTableAccount } from "@solana/web3.js";

export function swap(program: Command) {
  program
    .command("swap")
    .description("multi-hop swap given static routes")
    .action(async () => {
      const { vaultContext, weightedSwap, stableSwap } = useContext();
      const vaults = await vaultContext.findAll();
      const vaultW = vaults.find(
        (vault) => vault.address.toBase58() === "w8edo9a9TDw52c1rBmVbP6dNakaAuFiPjDd52ZJwwVi",
      )!;
      const vaultS = vaults.find(
        (vault) => vault.address.toBase58() === "stab1io8dHvK26KoHmTwwHyYmHRbUWbyEJx6CdrGabC",
      )!;

      const pools = [...(await weightedSwap.findByVault(vaultW)), ...(await stableSwap.findByVault(vaultS))];
      const { value: altAccount } = await vaultContext.provider.connection.getAddressLookupTable(
        new PublicKey("DS8qxhzgB7H1oknHkUHrNa7esmbL4QDzxJwyxiHyryzc"),
      );

      const pool_WBTC_SOL = pools.find(
        (pool) => pool.address.toBase58() === "EaZ1hz4q4aVzeaEcwZasLuXmDNBkitSauCiUczCEjFQy",
      )!;
      const pool_WBTC_USDC = pools.find(
        (pool) => pool.address.toBase58() === "2wvr84azf3wcwo2vMcKrTgT7PgiXxDKzwC2E5rmCimiX",
      )!;
      const pool_USDT_USDC = pools.find(
        (pool) => pool.address.toBase58() === "3h5TeTeWZZbwW8WhuQZtCTVjTGVf3XMPLhzFcz7WmQct",
      )!;

      try {
        const signature = await Swap.batch({
          weightedSwap,
          stableSwap,
          // SOL -> WBTC -> USDC -> USDT
          routes: [
            {
              pool: pool_WBTC_SOL,
              mintInAddress: new PublicKey("So11111111111111111111111111111111111111112"),
              mintOutAddress: new PublicKey("CY2Gb1YDyN7fdhhshzTy27tcnDb6Qt2y2s5iwSfJaxk2"),
            },
            {
              pool: pool_WBTC_USDC,
              mintInAddress: new PublicKey("CY2Gb1YDyN7fdhhshzTy27tcnDb6Qt2y2s5iwSfJaxk2"),
              mintOutAddress: new PublicKey("9TQr5ZSz3h3nvAFPkZyMXbLRn2VxJpVSn6sW5FH1Uiir"),
            },
            {
              pool: pool_USDT_USDC,
              mintInAddress: new PublicKey("9TQr5ZSz3h3nvAFPkZyMXbLRn2VxJpVSn6sW5FH1Uiir"),
              mintOutAddress: new PublicKey("8zL6cUxfgXdWyM7N7nePEKsdKb6WNZdsuXboHvuU8EfV"),
            },
          ],
          amountIn: 0.123456789,
          // USDT -> USDC -> WBTC -> SOL
          // routes: [
          //   {
          //     pool: pool_USDT_USDC,
          //     mintInAddress: new PublicKey("8zL6cUxfgXdWyM7N7nePEKsdKb6WNZdsuXboHvuU8EfV"),
          //     mintOutAddress: new PublicKey("9TQr5ZSz3h3nvAFPkZyMXbLRn2VxJpVSn6sW5FH1Uiir"),
          //   },
          //   {
          //     pool: pool_WBTC_USDC,
          //     mintInAddress: new PublicKey("9TQr5ZSz3h3nvAFPkZyMXbLRn2VxJpVSn6sW5FH1Uiir"),
          //     mintOutAddress: new PublicKey("CY2Gb1YDyN7fdhhshzTy27tcnDb6Qt2y2s5iwSfJaxk2"),
          //   },
          //   {
          //     pool: pool_WBTC_SOL,
          //     mintInAddress: new PublicKey("CY2Gb1YDyN7fdhhshzTy27tcnDb6Qt2y2s5iwSfJaxk2"),
          //     mintOutAddress: new PublicKey("So11111111111111111111111111111111111111112"),
          //   },
          // ],
          // amountIn: 123.456789,
          minimumAmountOut: 0, // ignore slippage
          altAccounts: [altAccount!],
        });

        console.log("Signature:", signature);
      } catch (err) {
        process.stderr.write(Buffer.from(JSON.stringify(err)));
      }
    });
}
