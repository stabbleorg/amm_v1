import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { BasePool, PoolToken, PoolTokenData, BasePoolData } from "./pool-base";
import { SafeNumber, WeightedMath } from "../utils";

export interface WeightedPoolToken extends PoolToken {
  balanceT: number;
  tick: number;
  weight: number; // UI BPS
}

export interface WeightedPoolTokenData extends PoolTokenData {
  weight: number; // u16, BPS
}

export interface WeightedPoolData extends BasePoolData {
  tokens: WeightedPoolTokenData[];
}

export class WeightedPool implements BasePool<WeightedPoolToken, WeightedPoolData> {
  static POOL_TOKEN_DECIMALS = 9;
  static POOL_TOKEN_SIZE = 32 + 1 + 2 + 4 + 4 + 8 + 8;

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
    return SafeNumber.toUiBps(this.data.swapFee);
  }

  get isActive(): boolean {
    return this.data.isActive;
  }

  get tokens(): WeightedPoolToken[] {
    return this.data.tokens.map((token) => ({
      mintAddress: token.mint,
      decimals: token.decimals,
      balanceT: SafeNumber.toUiAmount(token.balance, WeightedPool.POOL_TOKEN_DECIMALS),
      balance: SafeNumber.toUiAmount(token.balance.mul(token.tick), WeightedPool.POOL_TOKEN_DECIMALS),
      tick: token.tick.toNumber(),
      weight: SafeNumber.toUiBps(token.weight),
    }));
  }

  getSpotPrice(tokenInAddress: PublicKey, tokenOutAddress: PublicKey): number {
    // const tokenIn = this.tokens.find((token) => token.mintAddress.equals(tokenInAddress));
    // if (!tokenIn) return 0;
    // const tokenOut = this.tokens.find((token) => token.mintAddress.equals(tokenOutAddress));
    // if (!tokenOut) return 0;
    // return WeightedMath.calcSpotPrice(tokenIn.balance, tokenIn.weight, tokenOut.balance, tokenOut.weight, this.swapFee);
    throw Error("Not Implemented");
  }

  getPostPrice(tokenInAddress: PublicKey, tokenOutAddress: PublicKey, amountIn: number): number {
    // const tokenIn = this.tokens.find((token) => token.mintAddress.equals(tokenInAddress));
    // if (!tokenIn) return 0;
    // const tokenOut = this.tokens.find((token) => token.mintAddress.equals(tokenOutAddress));
    // if (!tokenOut) return 0;
    // return WeightedMath.calcPostPrice(
    //   tokenIn.balance,
    //   tokenIn.weight,
    //   tokenOut.balance,
    //   tokenOut.weight,
    //   amountIn,
    //   this.swapFee,
    // );
    throw Error("Not Implemented");
  }

  getEstAmountOut(tokenInAddress: PublicKey, tokenOutAddress: PublicKey, amountIn: number): number {
    const tokenIn = this.tokens.find((token) => token.mintAddress.equals(tokenInAddress));
    if (!tokenIn) return 0;
    const tokenOut = this.tokens.find((token) => token.mintAddress.equals(tokenOutAddress));
    if (!tokenOut) return 0;
    return (
      WeightedMath.calcOutGivenIn(
        tokenIn.balanceT,
        tokenIn.weight,
        tokenOut.balanceT,
        tokenOut.weight,
        amountIn / tokenIn.tick,
        this.swapFee,
      ) * tokenOut.tick
    );
  }
}
