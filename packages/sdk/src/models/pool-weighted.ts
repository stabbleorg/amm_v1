import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { TokenAmountUtil, WeightedMath } from "../utils";
import { PriceInfo } from "../consts";

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

  get vaultAddress(): PublicKey {
    return this.data.vault;
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

  getPriceInfo(tokenInAddress: PublicKey, tokenOutAddress: PublicKey, amountIn: number): PriceInfo | null {
    const tokenIn = this.tokens.find((token) => token.mintAddress.equals(tokenInAddress));
    if (!tokenIn) return null;
    const tokenOut = this.tokens.find((token) => token.mintAddress.equals(tokenOutAddress));
    if (!tokenOut) return null;
    const currentPrice = WeightedMath.calcSpotPrice(
      tokenIn.balance,
      tokenIn.weight,
      tokenOut.balance,
      tokenOut.weight,
      this.swapFee,
    );
    const postPrice = WeightedMath.calcPostPrice(
      tokenIn.balance,
      tokenIn.weight,
      tokenOut.balance,
      tokenOut.weight,
      amountIn,
      this.swapFee,
    );
    const priceImpactRatio = 1 - postPrice / currentPrice;
    const amountOut = WeightedMath.calcOutGivenIn(
      tokenIn.balance,
      tokenIn.weight,
      tokenOut.balance,
      tokenOut.weight,
      amountIn,
      this.swapFee,
    );
    return {
      currentPrice,
      postPrice,
      priceImpactRatio,
      amountOut,
    };
  }

  getEstAmountOut(tokenInAddress: PublicKey, tokenOutAddress: PublicKey, amountIn: number): number {
    const tokenIn = this.tokens.find((token) => token.mintAddress.equals(tokenInAddress));
    if (!tokenIn) return 0;
    const tokenOut = this.tokens.find((token) => token.mintAddress.equals(tokenOutAddress));
    if (!tokenOut) return 0;
    const amountOut = WeightedMath.calcOutGivenIn(
      tokenIn.balance,
      tokenIn.weight,
      tokenOut.balance,
      tokenOut.weight,
      amountIn,
      this.swapFee,
    );
    return Math.max(amountOut, 0);
  }
}
