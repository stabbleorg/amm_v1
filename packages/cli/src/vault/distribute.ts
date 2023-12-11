import fs from "fs";
import type { Command } from "commander";
import {
  createAssociatedTokenAccountInstruction,
  createFreezeAccountInstruction,
  createMintToCheckedInstruction,
  createThawAccountInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { SafeNumber } from "@stabbleorg/solana-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

const BATCH_SIZE = 1;
type WhitelistItem = { address: string; amount: number };

export function distribute(program: Command) {
  program
    .command("iou-distribute")
    .description("distribute IOU tokens")
    .requiredOption("--iou-mint-k <string>", "iou mint key", parseKey)
    .requiredOption("--path <path>", "path")
    .action(async ({ iouMintK, path }: { iouMintK: PublicKey; path: string }) => {
      const { provider, sdk } = useContext();
      const { decimals } = await getMint(provider.connection, iouMintK);

      const items: WhitelistItem[] = JSON.parse(fs.readFileSync(path, { encoding: "utf8" }));

      let index = 1;
      let ixs: TransactionInstruction[] = [];
      for (const item of items) {
        console.log("Address:", item.address);
        const tokenAddress = getAssociatedTokenAddressSync(iouMintK, new PublicKey(item.address), true);
        ixs.push(
          createAssociatedTokenAccountInstruction(
            provider.publicKey,
            tokenAddress,
            new PublicKey(item.address),
            iouMintK,
          ),
          // createThawAccountInstruction(tokenAddress, iouMintK, provider.publicKey),
          createMintToCheckedInstruction(
            iouMintK,
            tokenAddress,
            provider.publicKey,
            BigInt(SafeNumber.toBigAmount(item.amount, decimals).toString()),
            decimals,
          ),
          createFreezeAccountInstruction(tokenAddress, iouMintK, provider.publicKey),
        );
        if (index % BATCH_SIZE === 0) {
          console.log("Batch #:", index / BATCH_SIZE);
          const tx = await sdk.ctxVault.newTX(ixs);
          const signature = await provider.sendAndConfirm(tx);
          console.log("Signature:", signature);
          ixs = [];
        }
        index++;
      }
    });
}
