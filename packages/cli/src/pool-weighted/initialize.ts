import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { submitTX, useContext } from "../context";
import { parseKey, parseKeypair } from "../utils";

export function initialize(program: Command) {
  program
    .command("pool-weighted-init")
    .description("initialize a weighted pool")
    .option("--pool-k-p <string>", "pool keypair", parseKeypair)
    .option("--mint-k-p <string>", "pool mint keypair", parseKeypair)
    .requiredOption("--vault-k <string>", "vault key", parseKey)
    .requiredOption("--swap-fee <string>", "wap fee")
    .requiredOption("--weights <string[]>", "weights")
    .requiredOption("--mints <string[]>", "mint keys")
    .action(
      async ({
        poolKP = Keypair.generate(),
        mintKP = Keypair.generate(),
        vaultK,
        swapFee,
        weights,
        mints,
      }: {
        poolKP?: Keypair;
        mintKP?: Keypair;
        vaultK: PublicKey;
        swapFee: string;
        weights: string;
        mints: string;
      }) => {
        const { weightedPoolContext } = useContext();

        const ixs = await weightedPoolContext.initializeInstructions(
          vaultK,
          poolKP.publicKey,
          mintKP.publicKey,
          swapFee,
          weights.split(","),
          mints.split(",").map((mint) => new PublicKey(mint)),
        );
        const tx = await weightedPoolContext.newTX(ixs);
        tx.sign([poolKP, mintKP]);
        submitTX(tx);

        console.log("Pool:", poolKP.publicKey.toBase58());
        console.log("Mint:", mintKP.publicKey.toBase58());
      },
    );
}
