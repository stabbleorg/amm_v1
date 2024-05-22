import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { useContext } from "../context";
import { parseKey, parseKeypair } from "../utils";

export function initialize(program: Command) {
  program
    .command("weighted-init")
    .description("initialize a weighted pool")
    .requiredOption("--vault-k <string>", "vault key", parseKey)
    .requiredOption("--mints <strings...>", "mint keys")
    .requiredOption("--weights <numbers...>", "weights")
    .option("--max-caps <numbers...>", "max caps")
    .requiredOption("--swap-fee <number>", "swap fee")
    .option("--pool-k-p <path>", "pool keypair", parseKeypair)
    .option("--pool-mint-k-p <path>", "pool mint keypair", parseKeypair)
    .action(
      async ({
        vaultK,
        mints,
        weights,
        maxCaps,
        swapFee,
        poolKP,
        poolMintKP,
      }: {
        vaultK: PublicKey;
        mints: string[];
        weights: string[];
        maxCaps?: string[];
        swapFee: string;
        poolKP?: Keypair;
        poolMintKP?: Keypair;
      }) => {
        const { vaultContext, weightedSwap } = useContext();

        const mintAddresses = mints.map((mint) => new PublicKey(mint));

        const vault = await vaultContext.findOne(vaultK);

        const { pool } = await weightedSwap.initialize({
          vault,
          mintAddresses,
          maxCaps,
          weights,
          swapFee,
          poolMintKP,
          keypair: poolKP,
        });

        await vaultContext.createMissingTokenAccounts({ vault, mintAddresses });

        console.log("Pool:", pool.address.toBase58());
      },
    );
}
