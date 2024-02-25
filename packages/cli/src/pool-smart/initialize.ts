import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { useContext, submitTX } from "../context";
import { parseKey, parseKeypair } from "../utils";

export function initialize(program: Command) {
  program
    .command("smart-init")
    .description("initialize smart pool")
    .option("--pool-k-p <string>", "pool keypair", parseKeypair)
    .requiredOption("--quote-mint-k <string>", "quote mint key", parseKey)
    .requiredOption("--max-liquidity <number>", "max liquidity")
    .action(
      async ({
        poolKP,
        quoteMintK,
        maxLiquidity,
      }: {
        poolKP?: Keypair;
        quoteMintK: PublicKey;
        maxLiquidity: string;
      }) => {
        const { sdk } = useContext();

        const { tx, address } = await sdk.createSmartPoolAndAddress({
          poolKP,
          quoteMintAddress: quoteMintK,
          maxLiquidity,
        });

        submitTX(tx);
        console.log("Pool:", address.toBase58());
      },
    );
}
