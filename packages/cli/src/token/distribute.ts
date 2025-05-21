import fs from "fs";
import type { Command } from "commander";
import {
  createAssociatedTokenAccountInstruction,
  createFreezeAccountInstruction,
  createMintToCheckedInstruction,
  createThawAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { SafeAmount, WalletContext } from "@stabbleorg/anchor-contrib";
import { useContext } from "../context";
import { parseKey } from "../utils";

const BATCH_SIZE = 8;
type WhitelistItem = { address: string; amount: number };

export function distribute(program: Command) {
  program
    .command("token-distribute")
    .description("transfer and freeze tokens")
    .requiredOption("--mint-k <string>", "mint key", parseKey)
    .requiredOption("--path <path>", "path")
    .action(async ({ mintK, path }: { mintK: PublicKey; path: string }) => {
      const { provider } = useContext();

      const walletContext = new WalletContext(provider);

      const items: WhitelistItem[] = JSON.parse(fs.readFileSync(path, { encoding: "utf8" }));

      const { decimals } = await getMint(provider.connection, mintK);

      let index = 1;
      let instructions: TransactionInstruction[] = [];
      for (const item of items) {
        // console.log("Address:", item.address);
        const tokenAddress = getAssociatedTokenAddressSync(mintK, new PublicKey(item.address), true);
        try {
          await getAccount(provider.connection, tokenAddress);
          // thaw associated token account
          instructions.push(createThawAccountInstruction(tokenAddress, mintK, provider.publicKey));
        } catch {
          // create associated token account
          instructions.push(
            createAssociatedTokenAccountInstruction(
              provider.publicKey,
              tokenAddress,
              new PublicKey(item.address),
              mintK,
            ),
          );
        }
        instructions.push(
          createMintToCheckedInstruction(
            mintK,
            tokenAddress,
            provider.publicKey,
            BigInt(SafeAmount.toU64Amount(item.amount, decimals).toString()),
            decimals,
          ),
          createFreezeAccountInstruction(tokenAddress, mintK, provider.publicKey),
        );
        if (index % BATCH_SIZE === 0 || index === items.length) {
          console.log("Batch #:", Math.ceil(index / BATCH_SIZE));
          const signature = await walletContext.sendSmartTransaction(instructions);
          console.log("Signature:", signature);
          instructions = [];
        }
        index++;
      }
    });
}
