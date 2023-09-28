import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { submitTX, useContext } from "../context";
import { parseKey, parseKeypair, parseNumber } from "../utils";

export function initialize(program: Command) {
  program
    .command("pool-stable-init")
    .description("initialize a stable pool")
    .option("--pool-k-p <string>", "pool keypair", parseKeypair)
    .option("--mint-k-p <string>", "pool mint keypair", parseKeypair)
    .requiredOption("--vault-k <string>", "vault key", parseKey)
    .requiredOption("--swap-fee <string>", "wap fee")
    .requiredOption("--amp <number>", "amp", parseNumber)
    .requiredOption("--mints <string[]>", "mint keys")
    .action(
      async ({
        poolKP = Keypair.generate(),
        mintKP = Keypair.generate(),
        vaultK,
        swapFee,
        amp,
        mints,
      }: {
        poolKP?: Keypair;
        mintKP?: Keypair;
        vaultK: PublicKey;
        swapFee: string;
        amp: number;
        mints: string;
      }) => {
        const { stablePoolContext } = useContext();

        const ixs = await stablePoolContext.initializeInstructions(
          vaultK,
          poolKP.publicKey,
          mintKP.publicKey,
          swapFee,
          amp,
          mints.split(",").map((mint) => new PublicKey(mint)),
        );
        const tx = await stablePoolContext.newTX(ixs);
        tx.sign([poolKP, mintKP]);
        submitTX(tx);

        console.log("Pool:", poolKP.publicKey.toBase58());
        console.log("Mint:", mintKP.publicKey.toBase58());
      },
    );
}
