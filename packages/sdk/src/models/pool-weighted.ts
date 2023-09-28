import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { TokenAmountUtil } from "../utils";

export type WeightedPoolTokenData = {
  mint: PublicKey;
  decimals: number; // u8
  multiplier: number; // u32
  scalingFactor: number; // u32
  balance: BN; // u64
  weight: number; // u16
};

export type WeightedPoolData = {
  owner: PublicKey;
  vault: PublicKey;
  mint: PublicKey;
  invariant: BN;
  swapFee: number;
  isActive: boolean;
  authorityBump: number;
  tokens: WeightedPoolTokenData[];
};

export type WeightedPoolToken = {
  mintAddress: PublicKey;
  decimals: number;
  balance: number;
  weight: number;
};

export class WeightedPool {
  static DECIMALS = 9;
  static POOL_TOKEN_SIZE = 32 + 1 + 4 + 4 + 8 + 2;

  constructor(
    readonly address: PublicKey,
    readonly data: WeightedPoolData,
  ) {}

  get tokens(): WeightedPoolToken[] {
    return this.data.tokens.map((token) => ({
      mintAddress: token.mint,
      decimals: token.decimals,
      balance: Number(TokenAmountUtil.toUiAmount(token.balance, WeightedPool.DECIMALS)),
      weight: token.weight / 1e4,
    }));
  }

  get ownerAddress(): PublicKey {
    return this.data.owner;
  }

  get mintAddress(): PublicKey {
    return this.data.mint;
  }

  get swapFee(): number {
    return this.data.swapFee / 1e4;
  }

  get isActive(): boolean {
    return this.data.isActive;
  }
}
