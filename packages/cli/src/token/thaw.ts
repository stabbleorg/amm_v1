import type { Command } from "commander";
import { createThawAccountInstruction } from "@solana/spl-token";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { WalletContext } from "@stabbleorg/anchor-contrib";
import { Helius } from "helius-sdk";
import { useContext } from "../context";

const BATCH_SIZE = 25;

export function thaw(program: Command) {
  program
    .command("token-thaw")
    .description("thaw token accounts")
    .requiredOption("--mint-k <string>", "mint key")
    .action(async ({ mintK }: { mintK: string }) => {
      const { provider } = useContext();

      const helius = new Helius("", "mainnet-beta", "", provider.connection.rpcEndpoint);
      const { token_accounts: accounts } = await helius.rpc.getTokenAccounts({ mint: mintK });
      if (!accounts) throw new Error("No holders");

      const walletContext = new WalletContext(provider);

      let index = 1;
      let instructions: TransactionInstruction[] = [];
      for (const account of accounts) {
        if (account.frozen) {
          instructions.push(
            createThawAccountInstruction(
              new PublicKey(account.address!),
              new PublicKey(mintK),
              walletContext.walletAddress,
            ),
          );
          index++;
        }

        if (index % BATCH_SIZE === 0 || account.address === accounts.at(-1)?.address) {
          console.log("Batch #:", Math.ceil(index / BATCH_SIZE));
          const signature = await walletContext.sendSmartTransaction(instructions);
          console.log("Signature:", signature);
          instructions = [];
        }
      }
    });
}
