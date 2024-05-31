import { AnchorProvider } from "@coral-xyz/anchor";
import { AddressLookupTableAccount } from "@solana/web3.js";
import { VaultContext, WeightedSwapContext, StableSwapContext } from "@stabbleorg/amm-sdk";
import { Helius } from "helius-sdk";

export interface Context {
  vaultContext: VaultContext<AnchorProvider>;
  weightedSwap: WeightedSwapContext<AnchorProvider>;
  stableSwap: StableSwapContext<AnchorProvider>;
  provider: AnchorProvider;
  helius?: Helius;
  altAccounts?: AddressLookupTableAccount[];
  simulate: boolean;
}

let context: Context;

export const setContext = (ctx: Context) => {
  context = ctx;
};

export const useContext = () => {
  return context;
};
