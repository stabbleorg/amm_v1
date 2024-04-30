import type { Command } from "commander";
import { program } from "commander";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import { VaultContext, WeightedSwapContext, StableSwapContext } from "@stabbleorg/amm-sdk";
import { Helius } from "helius-sdk";
import { setupVaultProgram } from "./vault";
import { setupWeightedSwapProgram } from "./weighted-swap";
import { setupStableSwapProgram } from "./stable-swap";
import { setupTokenProgram } from "./token";
import { setContext, run } from "./context";
import { parseKey, parseKeypair } from "./utils";

program
  .version("0.7.2")
  .option("-k, --keypair <path>", "wallet keypair", parseKeypair)
  .option("-u, --url <string>", "RPC monk or url", "devnet")
  .option("-p, --helius-key <string>", "Helius API key")
  .option("-a, --alt-key <string>", "Address Lookup Table key", parseKey)
  .option("-s, --simulate", "simulate transaction")
  .hook("preAction", async (cmd: Command) => {
    const { keypair, url, heliusKey, altKey, simulate } = cmd.opts();

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

    const connection = new Connection(rpcEndpoint, "confirmed");
    const provider = new AnchorProvider(connection, new Wallet(keypair || Keypair.generate()), {
      commitment: "confirmed",
      maxRetries: 1,
      preflightCommitment: "confirmed",
      skipPreflight: true,
    });
    const vaultContext = new VaultContext(provider);
    const weightedSwap = new WeightedSwapContext(provider);
    const stableSwap = new StableSwapContext(provider);

    let altAccounts;
    if (altKey) {
      const { value } = await connection.getAddressLookupTable(altKey);
      if (value) altAccounts = [value];
    }

    setContext({
      vaultContext,
      weightedSwap,
      stableSwap,
      provider,
      helius,
      altAccounts,
      simulate: Boolean(simulate),
    });
  });

setupVaultProgram(program);
setupWeightedSwapProgram(program);
setupStableSwapProgram(program);
setupTokenProgram(program);

program.parseAsync(process.argv).then(run);
