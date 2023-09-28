import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { program } from "commander";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { VaultContext, WeightedPoolContext, StablePoolContext } from "@stabbleorg/solana-sdk";
import { setContext, useContext, handleTX } from "./context";
import { parseKey, parseKeypair } from "./utils";
import { setupVaultProgram } from "./vault";
import { setupWeightedPoolProgram } from "./pool-weighted";

program
  .version("0.1.0")
  .option("-k, --keypair <path>", "wallet keypair", parseKeypair)
  .option("-p, --program-id <path>", "program id", parseKey)
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
      vaultContext: new VaultContext(provider, programId),
      weightedPoolContext: new WeightedPoolContext(provider, programId),
      stablePoolContext: new StablePoolContext(provider, programId),
      provider,
      simulate: Boolean(simulate),
    });
  });

setupVaultProgram(program);
setupWeightedPoolProgram(program);

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
