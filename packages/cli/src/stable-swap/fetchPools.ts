import type { Command } from "commander";
import { parseKey } from "../utils";
import { PublicKey } from "@solana/web3.js";
import { useContext } from "../context";
import { StableSwapContext, VaultContext } from "@stabbleorg/amm-sdk";

export function fetchPools(program: Command) {
  program
    .command("fetch-pools")
    .description("fetch pool accounts for a vault, optionally at a specific slot")
    .requiredOption("--vault-k <string>", "vault key", parseKey)
    .option("--slot <number>", "slot/block number to fetch accounts at", (val) => parseInt(val, 10))
    .action(async ({ vaultK, slot }: { vaultK: PublicKey; slot?: number }) => {
      const { provider } = useContext();

      const stableSwap = new StableSwapContext(provider);
      const vaultContext = new VaultContext(provider);
      const vault = await vaultContext.loadVault(vaultK);
      
      // First, get all pool addresses
      const pools = await stableSwap.program.account.pool.all([
        {
          memcmp: {
            offset: 40, // 8 + 32
            bytes: vault.address.toBase58(),
          },
        },
      ]);

      const poolAddresses = pools.map(p => p.publicKey);

      // Fetch account info at specific slot if provided
      let poolDataList;
      if (slot !== undefined) {
        // Fetch accounts at specific slot
        const accountInfos = await provider.connection.getMultipleAccountsInfo(
          poolAddresses,
          { commitment: "confirmed", minContextSlot: slot }
        );

        poolDataList = accountInfos.map((accountInfo, index) => {
          if (!accountInfo) {
            return null;
          }
          // Decode the account data using the program's coder
          const decoded = stableSwap.program.coder.accounts.decode("pool", accountInfo.data);
          return {
            publicKey: poolAddresses[index],
            account: decoded,
          };
        }).filter((item): item is { publicKey: PublicKey; account: any } => item !== null);
      } else {
        // Use the already fetched pools
        poolDataList = pools.map(p => ({
          publicKey: p.publicKey,
          account: p.account,
        }));
      }

      if (poolDataList.length === 0) {
        console.log("No pools found for this vault.");
        if (slot !== undefined) {
          console.log(`Note: Accounts may not exist at slot ${slot}.`);
        }
        return;
      }

      // Format data for console.table
      const tableData = poolDataList.map(({ publicKey, account }) => {
        const tokens = account.tokens || [];
        const poolAddress = publicKey.toBase58();
        
        return {
          "Pool": poolAddress,
          "Owner": account.owner.toBase58().slice(0, 8) + "...",
          "Mint": account.mint.toBase58().slice(0, 8) + "...",
          "Active": account.isActive ? "Yes" : "No",
          "Swap Fee": account.swapFee.toString(),
          "Max Supply": account.maxSupply.toString(),
          "Amp Init": account.ampInitialFactor?.toString() || "N/A",
          "Amp Target": account.ampTargetFactor?.toString() || "N/A",
          "Tokens": tokens.length,
          "Token Mints": tokens.map((t: any) => t.mint.toBase58().slice(0, 4) + "...").join(", "),
        };
      });

      if (slot !== undefined) {
        console.log(`\nPools at slot ${slot} (${poolDataList.length} found):`);
      } else {
        console.log(`\nCurrent pools (${poolDataList.length} found):`);
      }
      console.table(tableData);
    })
}