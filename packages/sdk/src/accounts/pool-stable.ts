import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { BasePool, PoolToken, PoolTokenData, BasePoolData } from "./pool-base";
import { StableMath, SafeNumber, BasicMath } from "../utils";

export interface StablePoolToken extends PoolToken {}

export interface StablePoolTokenData extends PoolTokenData {}

export interface StablePoolData extends BasePoolData {
  amp: number;
  ampStart: number;
  ampStartTime: BN;
  ampEndTime: BN;
  ampDuration: number;
  tokens: StablePoolTokenData[];
}

export class StablePool implements BasePool<StablePoolToken, StablePoolData> {
  static POOL_TOKEN_DECIMALS = 9;
  static POOL_TOKEN_SIZE = 32 + 1 + 4 + 4 + 8 + 8;

  constructor(
    readonly address: PublicKey,
    readonly data: StablePoolData,
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

  get amplification(): number {
    return this.data.amp;
  }

  get swapFee(): number {
    return SafeNumber.toUiBps(this.data.swapFee);
  }

  get isActive(): boolean {
    return this.data.isActive;
  }

  get tokens(): PoolToken[] {
    return this.data.tokens.map((token) => ({
      mintAddress: token.mint,
      decimals: token.decimals,
      balance: SafeNumber.toUiAmount(token.balance, StablePool.POOL_TOKEN_DECIMALS),
    }));
  }

  getSpotPrice(tokenInAddress: PublicKey, tokenOutAddress: PublicKey): number {
    throw Error("Not Implemented");
  }

  getPostPrice(tokenInAddress: PublicKey, tokenOutAddress: PublicKey, amountIn: number): number {
    throw Error("Not Implemented");
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
      this.swapFee,
    );
    return Math.max(amountOut, 0);
  }

  getEstAmountsOut(amountIn: number, totalSupply: number = 1, tokenAddress?: PublicKey): number[] {
    if (tokenAddress) {
      return [0];
    }
    return BasicMath.calcProportionalAmountsOut(
      this.tokens.map((token) => token.balance),
      amountIn,
      totalSupply,
    );
  }
}
