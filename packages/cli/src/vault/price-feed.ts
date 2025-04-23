import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { VaultContext } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function createPriceFeed(program: Command) {
  program
    .command("vault-price-feed")
    .description("create price feed")
    .requiredOption("--vault-k <string>", "vault key", parseKey)
    .requiredOption("--mint-k <string>", "mint key", parseKey)
    .requiredOption("--price-k <string>", "Pyth price key", parseKey)
    .requiredOption("--feed-id <string>", "Pyth feed ID")
    .action(
      async ({
        vaultK,
        mintK,
        priceK,
        feedId,
      }: {
        vaultK: PublicKey;
        mintK: PublicKey;
        priceK: PublicKey;
        feedId: string;
      }) => {
        const { provider, priorityLevel, simulate } = useContext();

        const vaultContext = new VaultContext(provider);
        const vault = await vaultContext.loadVault(vaultK);

        const { address, signature } = await vaultContext.createPriceFeed({
          vault,
          mintAddress: mintK,
          pythPriceAddress: priceK,
          pythPriceFeedId: feedId,
          priorityLevel,
          simulate,
        });

        console.log("Price feed:", address.toBase58());
        console.log(signature);
      },
    );
}
