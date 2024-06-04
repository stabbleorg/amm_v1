import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { VaultContext, WeightedSwapContext } from "@stabbleorg/amm-sdk";
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
        const { provider } = useContext();

        const vaultContext = new VaultContext(provider);
        const weightedSwap = new WeightedSwapContext(provider);
        const vault = await vaultContext.loadVault(vaultK);

        const mintAddresses = mints.map((mint) => new PublicKey(mint));

        const { address, signature } = await weightedSwap.initialize({
          vault,
          mintAddresses,
          maxCaps,
          weights,
          swapFee,
          poolMintKP,
          keypair: poolKP,
        });

        await vaultContext.createMissingTokenAccounts({ vault, mintAddresses });

        console.log("Pool:", address.toBase58());
        console.log(signature);
      },
    );
}
