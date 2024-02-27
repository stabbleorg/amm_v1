import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { useContext, submitTX } from "../context";
import { parseKey, parseKeypair } from "../utils";

export function initialize(program: Command) {
  program
    .command("smart-init")
    .description("initialize smart pool")
    .requiredOption("--vault-k <string>", "vault key", parseKey)
    .requiredOption("--quote-mint-k <string>", "quote mint key", parseKey)
    .requiredOption("--max-liquidity <number>", "max liquidity")
    .option("--pool-k-p <string>", "pool keypair", parseKeypair)
    .action(
      async ({
        vaultK,
        quoteMintK,
        maxLiquidity,
        poolKP,
      }: {
        vaultK: PublicKey;
        quoteMintK: PublicKey;
        maxLiquidity: string;
        poolKP?: Keypair;
      }) => {
        const { smart } = useContext();

        const { tx, address } = await smart.createSmartPoolAndAddress({
          vaultAddress: vaultK,
          poolKP,
          quoteMintAddress: quoteMintK,
          maxLiquidity,
        });

        submitTX(tx);
        console.log("Pool:", address.toBase58());
      },
    );
}
