import type { Command } from "commander";
import { program } from "commander";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import { setContext, useContext, processTX } from "./context";
// import { setupVaultProgram } from "./vault";
// import { setupWeightedPoolProgram } from "./weighted-swap";
// import { setupStablePoolProgram } from "./stable-swap";
import { setupTokenProgram } from "./token";
import { parseKeypair } from "./utils";
import { WalletContext } from "@stabbleorg/anchor-contrib";

program
  .version("1.3.1")
  .option("-k, --keypair <path>", "wallet keypair", parseKeypair)
  .option("-u, --url <string>", "RPC monk or url", "devnet")
  .option("-s, --simulate", "simulate transaction")
  .option("--helius-key <string>")
  .hook("preAction", async (cmd: Command) => {
    const { keypair, url, simulate } = cmd.opts();
    const payer = keypair || Keypair.generate();

    let rpcEndpoint: string;
    switch (url) {
      case "testnet":
      case "devnet":
      case "mainnet-beta":
        rpcEndpoint = clusterApiUrl(url);
        break;
      default:
        rpcEndpoint = url;
        break;
    }

    const provider = new AnchorProvider(new Connection(rpcEndpoint), new Wallet(payer), {
      commitment: "confirmed",
      maxRetries: 1,
      preflightCommitment: "confirmed",
      skipPreflight: true,
    });
    const walletContext = new WalletContext(provider);

    setContext({
      walletContext,
      provider,
      simulate: Boolean(simulate),
    });
  });

// setupVaultProgram(program);
// setupWeightedPoolProgram(program);
// setupStablePoolProgram(program);
setupTokenProgram(program);

program
  .parseAsync(process.argv)
  .then(async () => {
    const { tx } = useContext();
    if (tx) await processTX(tx);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
