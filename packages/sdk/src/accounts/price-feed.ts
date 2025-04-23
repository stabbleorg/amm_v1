import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SafeAmount } from "@stabbleorg/anchor-contrib";
import { AMM_VAULT_PROGRAM_ID } from "../programs";

export type PriceFeedData = {
  vault: PublicKey;
  mint: PublicKey;
  priceUpdate: PublicKey;
  feedId: number[];
};

export class PriceFeed {
  data: PriceFeedData;

  constructor(
    readonly address: PublicKey,
    data: PriceFeedData,
  ) {
    this.data = data;
  }

  get mintAddress(): PublicKey {
    return this.data.mint;
  }

  get priceAddress(): PublicKey {
    return this.data.priceUpdate;
  }
}
