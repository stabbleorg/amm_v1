import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { useContext, submitTX } from "../context";
import { parseKey, parseKeypair } from "../utils";

export function initialize(program: Command) {
  program
    .command("slr-init")
    .description("initialize slr")
    .option("--pool-k-p <string>", "pool keypair", parseKeypair)
    .requiredOption("--underlying-mint-k <string>", "underlying mint key", parseKey)
    .requiredOption("--max-liquidity <number>", "max liquidity")
    .action(
      async ({
        poolKP,
        underlyingMintK,
        maxLiquidity,
      }: {
        poolKP?: Keypair;
        underlyingMintK: PublicKey;
        maxLiquidity: string;
      }) => {
        const { sdk } = useContext();

        const { tx, address } = await sdk.createSlrPoolAndAddress({
          poolKP,
          underlyingMintAddress: underlyingMintK,
          maxLiquidity,
        });

        submitTX(tx);
        console.log("SLR:", address.toBase58());
      },
    );
}
