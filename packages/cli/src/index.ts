import type { Command } from "commander";
import { Keypair } from "@solana/web3.js";
import { program } from "commander";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { VaultContext, WeightedPoolContext, StablePoolContext } from "@stabbleorg/solana-sdk";
import { setContext, useContext, handleTX } from "./context";
import { setupVaultProgram } from "./vault";
import { setupWeightedPoolProgram } from "./pool-weighted";
import { setupStablePoolProgram } from "./pool-stable";
import { parseKeypair } from "./utils";

program
  .version("0.1.3")
  .option("-k, --keypair <path>", "wallet keypair", parseKeypair)
  .option("-u, --url <string>", "RPC monk or url", "devnet")
  .option("-s, --simulate", "simulate transaction")
  .hook("preAction", async (cmd: Command) => {
    const { keypair, programId, url, simulate } = cmd.opts();
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
    const provider = new AnchorProvider(new Connection(rpcEndpoint), new Wallet(payer), {});

    setContext({
      vaultContext: new VaultContext(provider),
      weightedPoolContext: new WeightedPoolContext(provider),
      stablePoolContext: new StablePoolContext(provider),
      provider,
      simulate: Boolean(simulate),
    });
  });

setupVaultProgram(program);
setupWeightedPoolProgram(program);
setupStablePoolProgram(program);

program
  .parseAsync(process.argv)
  .then(async () => {
    const { tx } = useContext();
    if (tx) await handleTX(tx);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
