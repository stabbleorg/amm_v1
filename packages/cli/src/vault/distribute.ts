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
import { SafeNumber } from "@stabbleorg/solana-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

const BATCH_SIZE = 9;
type WhitelistItem = { address: string; amount: number };

export function distribute(program: Command) {
  program
    .command("iou-distribute")
    .description("distribute IOU tokens")
    .requiredOption("--iou-mint-k <string>", "iou mint key", parseKey)
    .requiredOption("--path <path>", "path")
    .action(async ({ iouMintK, path }: { iouMintK: PublicKey; path: string }) => {
      const { provider, sdk } = useContext();

      const items: WhitelistItem[] = JSON.parse(fs.readFileSync(path, { encoding: "utf8" }));

      const { decimals } = await getMint(provider.connection, iouMintK);

      let index = 1;
      let ixs: TransactionInstruction[] = [];
      for (const item of items) {
        // console.log("Address:", item.address);
        const tokenAddress = getAssociatedTokenAddressSync(iouMintK, new PublicKey(item.address), true);
        try {
          await getAccount(provider.connection, tokenAddress);
          // thaw associated token account
          ixs.push(createThawAccountInstruction(tokenAddress, iouMintK, provider.publicKey));
        } catch {
          // create associated token account
          ixs.push(
            createAssociatedTokenAccountInstruction(
              provider.publicKey,
              tokenAddress,
              new PublicKey(item.address),
              iouMintK,
            ),
          );
        }
        ixs.push(
          createMintToCheckedInstruction(
            iouMintK,
            tokenAddress,
            provider.publicKey,
            BigInt(SafeNumber.toBigAmount(item.amount, decimals).toString()),
            decimals,
          ),
          createFreezeAccountInstruction(tokenAddress, iouMintK, provider.publicKey),
        );
        if (index % BATCH_SIZE === 0 || index === items.length) {
          console.log("Batch #:", Math.ceil(index / BATCH_SIZE));
          const tx = await sdk.ctxVault.newTX(ixs);
          const signature = await provider.sendAndConfirm(tx);
          console.log("Signature:", signature);
          ixs = [];
        }
        index++;
      }
    });
}
