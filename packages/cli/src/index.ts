import type { Command } from "commander";
import { program } from "commander";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import { WalletContext } from "@stabbleorg/anchor-contrib";
import { VaultContext, WeightedSwapContext, StableSwapContext } from "@stabbleorg/amm-sdk";
import { Helius } from "helius-sdk";
import { setContext, useContext, processTX } from "./context";
// import { setupVaultProgram } from "./vault";
// import { setupWeightedPoolProgram } from "./weighted-swap";
// import { setupStablePoolProgram } from "./stable-swap";
import { setupTokenProgram } from "./token";
import { parseKeypair } from "./utils";

program
  .version("0.5.0")
  .option("-k, --keypair <path>", "wallet keypair", parseKeypair)
  .option("-u, --url <string>", "RPC monk or url", "devnet")
  .option("--helius-key <string>")
  .option("-s, --simulate", "simulate transaction")
  .hook("preAction", async (cmd: Command) => {
    const { keypair, url, heliusKey, simulate } = cmd.opts();
    const payer = keypair || Keypair.generate();

    let rpcEndpoint: string;
    let helius;
    switch (url) {
      case "testnet":
      case "devnet":
      case "mainnet-beta":
        if (heliusKey) {
          helius = new Helius(heliusKey, url, "stabble-amm-cli");
          rpcEndpoint = helius.endpoint;
        } else {
          rpcEndpoint = clusterApiUrl(url);
        }
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
    const vaultContext = new VaultContext(provider);
    const weightedSwap = new WeightedSwapContext(provider);
    const stableSwap = new StableSwapContext(provider);

    setContext({
      vaultContext,
      weightedSwap,
      stableSwap,
      provider,
      helius,
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
