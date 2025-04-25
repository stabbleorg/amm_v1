import { PublicKey } from "@solana/web3.js";

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

  get id(): string {
    return "0x" + Buffer.from(new Uint8Array(this.data.feedId)).toString("hex");
  }
}
