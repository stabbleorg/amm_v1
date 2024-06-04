import { AnchorProvider } from "@coral-xyz/anchor";
import { AddressLookupTableAccount } from "@solana/web3.js";

export interface Context {
  provider: AnchorProvider;
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
