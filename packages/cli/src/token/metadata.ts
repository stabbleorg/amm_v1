import type { Command } from "commander";
import { Metaplex } from "@metaplex-foundation/js";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";
import { Keypair, PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram } from "@solana/web3.js";
import { useContext, submit } from "../context";
import { parseKey, parseKeypair } from "../utils";

export function createMetadata(program: Command) {
  program
    .command("metadata-create")
    .description("create SPL token")
    .requiredOption("--mint-k <string>", "mint key", parseKey)
    .option("--authority-k-p <string>", "authority keypair", parseKeypair)
    .requiredOption("--metadata-name <string>", "metadata name")
    .requiredOption("--metadata-symbol <string>", "metadata symbol")
    .requiredOption("--metadata-uri <string>", "metadata uri")
    .action(
      async ({
        mintK,
        authorityKP,
        metadataName,
        metadataSymbol,
        metadataUri,
      }: {
        mintK: PublicKey;
        authorityKP?: Keypair;
        metadataName: string;
        metadataSymbol: string;
        metadataUri: string;
      }) => {
        const { provider, vaultContext } = useContext();

        console.log("Mint:", mintK.toBase58());
        console.log("Name:", metadataName);
        console.log("Symbol:", metadataSymbol);
        console.log("Metadata URI:", metadataUri);

        const metadataK = Metaplex.make(provider.connection).nfts().pdas().metadata({ mint: mintK });
        const authorityK = authorityKP?.publicKey || provider.publicKey;

        const ixs = [
          createCreateMetadataAccountV3Instruction(
            {
              payer: provider.publicKey,
              metadata: metadataK,
              mint: mintK,
              mintAuthority: authorityK,
              updateAuthority: authorityK,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY,
            },
            {
              createMetadataAccountArgsV3: {
                collectionDetails: null,
                isMutable: true,
                data: {
                  name: metadataName,
                  symbol: metadataSymbol,
                  uri: metadataUri,
                  creators: null,
                  sellerFeeBasisPoints: 0,
                  collection: null,
                  uses: null,
                },
              },
            },
          ),
        ];

        const pending = await vaultContext.createTransaction(ixs);
      },
    );
}
