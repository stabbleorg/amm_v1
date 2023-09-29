import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { StableMath, TokenAmountUtil } from "../utils";
import { PriceInfo } from "../consts";

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
  balance: number;
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
      balance: Number(TokenAmountUtil.toUiAmount(token.balance, StablePool.DECIMALS)),
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

  getEstAmountOut(tokenInAddress: PublicKey, tokenOutAddress: PublicKey, amountIn: number): number {
    const tokenInIndex = this.tokens.findIndex((token) => token.mintAddress.equals(tokenInAddress));
    if (tokenInIndex === -1) return 0;
    const tokenOutIndex = this.tokens.findIndex((token) => token.mintAddress.equals(tokenOutAddress));
    if (tokenOutIndex === -1) return 0;
    const amountOut = StableMath.calcOutGivenIn(
      [...this.tokens.map((token) => token.balance)],
      this.amplification,
      tokenInIndex,
      tokenOutIndex,
      amountIn,
    );
    return Math.max(amountOut, 0);
  }
}
