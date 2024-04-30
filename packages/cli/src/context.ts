import { AnchorProvider } from "@coral-xyz/anchor";
import { AddressLookupTableAccount } from "@solana/web3.js";
import { VaultContext, WeightedSwapContext, StableSwapContext } from "@stabbleorg/amm-sdk";
import { TransactionWithRecentBlockAndSlot } from "@stabbleorg/anchor-contrib";
import { Helius } from "helius-sdk";

export interface Context {
  vaultContext: VaultContext<AnchorProvider>;
  weightedSwap: WeightedSwapContext<AnchorProvider>;
  stableSwap: StableSwapContext<AnchorProvider>;
  provider: AnchorProvider;
  helius?: Helius;
  altAccounts?: AddressLookupTableAccount[];
  pending?: TransactionWithRecentBlockAndSlot;
  simulate: boolean;
}

let context: Context;

export const setContext = (ctx: Context) => {
  context = ctx;
};

export const useContext = () => {
  return context;
};

export const submit = (pending: TransactionWithRecentBlockAndSlot) => {
  context.pending = pending;
};

export const run = async () => {
  const { provider, simulate, pending } = useContext();

  if (!pending) return;

  try {
    if (simulate) {
      const { value: sim } = await provider.connection.simulateTransaction(pending.transaction, {
        minContextSlot: pending.slot,
      });
      console.log(sim.logs?.join("\n"));
    } else {
      const signature = await provider.sendAndConfirm(pending.transaction, [], { minContextSlot: pending.slot });
      console.log(signature);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
