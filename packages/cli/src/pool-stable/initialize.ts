import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { submitTX, useContext } from "../context";
import { parseKey, parseKeypair } from "../utils";

export function initialize(program: Command) {
  program
    .command("pool-stable-init")
    .description("initialize a stable pool")
    .requiredOption("--vault-k <string>", "vault key", parseKey)
    .requiredOption("--mints <strings...>", "mint keys")
    .requiredOption("--amp <number>", "amplification")
    .requiredOption("--swap-fee <string>", "swap fee")
    .option("--pool-k-p <string>", "pool keypair", parseKeypair)
    .option("--pool-mint-k-p <string>", "pool mint keypair", parseKeypair)
    .action(
      async ({
        vaultK,
        mints,
        amp,
        swapFee,
        poolKP,
        poolMintKP,
      }: {
        vaultK: PublicKey;
        mints: string[];
        amp: number;
        swapFee: string;
        poolKP?: Keypair;
        poolMintKP?: Keypair;
      }) => {
        const { sdk } = useContext();

        const { tx, address } = await sdk.createStablePoolAndAddress({
          vaultAddress: vaultK,
          swapFee,
          amp,
          mintAddresses: mints.map((pubkey) => new PublicKey(pubkey)),
          poolKP,
          poolMintKP,
        });

        submitTX(tx);
        console.log("Pool:", address.toBase58());
      },
    );
}
