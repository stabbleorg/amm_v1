import type { VersionedTransaction } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { VaultContext, WeightedPoolContext, StablePoolContext } from "@stabbleorg/solana-sdk";

export interface Context {
  vaultContext: VaultContext<AnchorProvider>;
  weightedPoolContext: WeightedPoolContext<AnchorProvider>;
  stablePoolContext: StablePoolContext<AnchorProvider>;
  provider: AnchorProvider;
  simulate: boolean;
  tx?: VersionedTransaction;
}

let context: Context;

export const setContext = (ctx: Context) => {
  context = ctx;
};

export const submitTX = (tx: VersionedTransaction) => {
  context.tx = tx;
};

export const useContext = () => {
  return context;
};

export const handleTX = async (tx: VersionedTransaction) => {
  const { provider, simulate } = useContext();

  if (simulate) {
    const { value } = await provider.connection.simulateTransaction(tx);
    console.log(value.logs?.join("\n"));
  } else {
    try {
      const signature = await provider.sendAndConfirm!(tx);
      console.log(signature);
    } catch (err) {
      console.error(err);
    }
  }
};
