import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { VaultContext, StableSwapContext } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey, parseKeypair } from "../utils";

export function initialize(program: Command) {
  program
    .command("stable-init")
    .description("initialize a stable pool")
    .requiredOption("--vault-k <string>", "vault key", parseKey)
    .requiredOption("--mints <strings...>", "mint keys")
    .option("--max-caps <numbers...>", "max caps")
    .requiredOption("--amp-factor <number>", "weights", Number)
    .requiredOption("--swap-fee <number>", "swap fee")
    .option("--pool-k-p <path>", "pool keypair", parseKeypair)
    .option("--pool-mint-k-p <path>", "pool mint keypair", parseKeypair)
    .action(
      async ({
        vaultK,
        mints,
        maxCaps,
        ampFactor,
        swapFee,
        poolKP,
        poolMintKP,
      }: {
        vaultK: PublicKey;
        mints: string[];
        maxCaps: string[];
        ampFactor: number;
        swapFee: string;
        poolKP?: Keypair;
        poolMintKP?: Keypair;
      }) => {
        const { provider } = useContext();

        const vaultContext = new VaultContext(provider);
        const stableSwap = new StableSwapContext(provider);
        const vault = await vaultContext.loadVault(vaultK);

        const mintAddresses = mints.map((mint) => new PublicKey(mint));

        const { address, signature } = await stableSwap.initialize({
          vault,
          mintAddresses,
          maxCaps,
          ampFactor,
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
