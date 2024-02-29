import { PublicKey } from "@solana/web3.js";

export const SIMULATED_SIGNATURE = "1111111111111111111111111111111111111111111111111111111111111111";

export interface DataUpdatedEvent<T> {
  pubkey: PublicKey;
  data: T;
}
