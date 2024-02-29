import { Connection, PublicKey } from "@solana/web3.js";

export interface Provider {
  readonly connection: Connection;
  readonly publicKey?: PublicKey | null;
}
