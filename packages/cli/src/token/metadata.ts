import type { Command } from "commander";
import { Metaplex } from "@metaplex-foundation/js";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";
import { Keypair, PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { useContext } from "../context";
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
        const { stableSwap, simulate } = useContext();

        const metadataK = stableSwap.metaplex.nfts().pdas().metadata({ mint: mintK });
        const authorityK = authorityKP?.publicKey || stableSwap.walletAddress;

        console.log("Mint:", mintK.toBase58());
        console.log("Name:", metadataName);
        console.log("Symbol:", metadataSymbol);
        console.log("Metadata URI:", metadataUri);
        console.log("Metadata:", metadataK.toBase58());

        if (simulate) return;

        const instructions: TransactionInstruction[] = [
          createCreateMetadataAccountV3Instruction(
            {
              payer: stableSwap.walletAddress,
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

        const signature = await stableSwap.sendSmartTransaction(instructions);

        console.log(signature);
      },
    );
}
