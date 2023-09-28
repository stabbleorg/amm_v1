import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { TokenAmountUtil } from "../utils";

export type StablePoolTokenData = {
  mint: PublicKey;
  decimals: number; // u8
  multiplier: number; // u32
  scalingFactor: number; // u32
  balance: BN; // u64
};

export type StablePoolData = {
  owner: PublicKey;
  vault: PublicKey;
  mint: PublicKey;
  invariant: BN;
  swapFee: number;
  amp: number;
  ampStart: number;
  ampStartTime: BN;
  ampEndTime: BN;
  ampDuration: number;
  isActive: boolean;
  authorityBump: number;
  tokens: StablePoolTokenData[];
};

export type StablePoolToken = {
  mintAddress: PublicKey;
  decimals: number;
  balance: string;
};

export class StablePool {
  static DECIMALS = 9;
  static POOL_TOKEN_SIZE = 32 + 1 + 4 + 4 + 8;

  constructor(
    readonly address: PublicKey,
    readonly data: StablePoolData,
  ) {}

  get tokens(): StablePoolToken[] {
    return this.data.tokens.map((token) => ({
      mintAddress: token.mint,
      decimals: token.decimals,
      balance: TokenAmountUtil.toUiAmount(token.balance, StablePool.DECIMALS),
    }));
  }

  get vaultAddress(): PublicKey {
    return this.data.vault;
  }

  get ownerAddress(): PublicKey {
    return this.data.owner;
  }

  get mintAddress(): PublicKey {
    return this.data.mint;
  }

  get amplification(): number {
    return this.data.amp;
  }

  get swapFee(): number {
    return this.data.swapFee / 1e4;
  }

  get isActive(): boolean {
    return this.data.isActive;
  }
}
