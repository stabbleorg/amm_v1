import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { useContext, submitTX } from "../context";
import { parseKey, parseKeypair } from "../utils";

export function initialize(program: Command) {
  program
    .command("pool-weighted-init")
    .description("initialize a weighted pool")
    .requiredOption("--vault-k <string>", "vault key", parseKey)
    .requiredOption("--mints <strings...>", "mint keys")
    .requiredOption("--weights <strings...>", "weights")
    .requiredOption("--swap-fee <string>", "swap fee")
    .option("--ticks <string...>", "tick sizes")
    .option("--pool-k-p <string>", "pool keypair", parseKeypair)
    .option("--pool-mint-k-p <string>", "pool mint keypair", parseKeypair)
    .action(
      async ({
        vaultK,
        mints,
        weights,
        swapFee,
        ticks,
        poolKP,
        poolMintKP,
      }: {
        vaultK: PublicKey;
        mints: string[];
        weights: string[];
        swapFee: string;
        ticks: string[];
        poolKP?: Keypair;
        poolMintKP?: Keypair;
      }) => {
        const { sdk } = useContext();

        const { tx, address } = await sdk.createWeightedPoolAndAddress({
          vaultAddress: vaultK,
          swapFee,
          weights,
          mintAddresses: mints.map((pubkey) => new PublicKey(pubkey)),
          ticks,
          poolKP,
          poolMintKP,
        });

        submitTX(tx);
        console.log("Pool:", address.toBase58());
      },
    );
}
