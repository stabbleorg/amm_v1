import { PublicKey } from "@solana/web3.js";
import { BasePool, PoolToken, PoolTokenData, BasePoolData } from "./pool-base";
import { TokenAmountUtil, WeightedMath } from "../utils";

export interface WeightedPoolToken extends PoolToken {
  weight: number;
}

export interface WeightedPoolTokenData extends PoolTokenData {
  weight: number; // u16
}

export interface WeightedPoolData extends BasePoolData {
  tokens: WeightedPoolTokenData[];
}

export class WeightedPool implements BasePool<WeightedPoolToken, WeightedPoolData> {
  static POOL_TOKEN_DECIMALS = 9;
  static POOL_TOKEN_SIZE = 32 + 1 + 4 + 4 + 8 + 2;

  constructor(
    readonly address: PublicKey,
    readonly data: WeightedPoolData,
  ) {}

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

  get tokens(): WeightedPoolToken[] {
    return this.data.tokens.map((token) => ({
      mintAddress: token.mint,
      decimals: token.decimals,
      balance: Number(TokenAmountUtil.toUiAmount(token.balance, WeightedPool.POOL_TOKEN_DECIMALS)),
      weight: token.weight / 1e4,
    }));
  }

  getSpotPrice(tokenInAddress: PublicKey, tokenOutAddress: PublicKey): number {
    const tokenIn = this.tokens.find((token) => token.mintAddress.equals(tokenInAddress));
    if (!tokenIn) return 0;
    const tokenOut = this.tokens.find((token) => token.mintAddress.equals(tokenOutAddress));
    if (!tokenOut) return 0;
    return WeightedMath.calcSpotPrice(tokenIn.balance, tokenIn.weight, tokenOut.balance, tokenOut.weight, this.swapFee);
  }

  getPostPrice(tokenInAddress: PublicKey, tokenOutAddress: PublicKey, amountIn: number): number {
    const tokenIn = this.tokens.find((token) => token.mintAddress.equals(tokenInAddress));
    if (!tokenIn) return 0;
    const tokenOut = this.tokens.find((token) => token.mintAddress.equals(tokenOutAddress));
    if (!tokenOut) return 0;
    return WeightedMath.calcPostPrice(
      tokenIn.balance,
      tokenIn.weight,
      tokenOut.balance,
      tokenOut.weight,
      amountIn,
      this.swapFee,
    );
  }

  getEstAmountOut(tokenInAddress: PublicKey, tokenOutAddress: PublicKey, amountIn: number): number {
    const tokenIn = this.tokens.find((token) => token.mintAddress.equals(tokenInAddress));
    if (!tokenIn) return 0;
    const tokenOut = this.tokens.find((token) => token.mintAddress.equals(tokenOutAddress));
    if (!tokenOut) return 0;
    return WeightedMath.calcOutGivenIn(
      tokenIn.balance,
      tokenIn.weight,
      tokenOut.balance,
      tokenOut.weight,
      amountIn,
      this.swapFee,
    );
  }
}
