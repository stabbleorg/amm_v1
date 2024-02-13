import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";

export interface PoolToken {
  mintAddress: PublicKey;
  decimals: number;
  balance: number;
}

export interface PoolTokenData {
  mint: PublicKey;
  decimals: number; // u8
  multiplier: number; // u32
  scalingFactor: number; // u32
  tick: BN; // u64
  balance: BN; // u64
}

export interface BasePoolData {
  owner: PublicKey;
  vault: PublicKey;
  mint: PublicKey;
  invariant: BN;
  swapFee: number;
  isActive: boolean;
  authorityBump: number;
}

export interface BasePool<T extends PoolToken, D extends BasePoolData> {
  readonly address: PublicKey;
  readonly data: D;

  get vaultAddress(): PublicKey;

  get ownerAddress(): PublicKey;

  get mintAddress(): PublicKey;

  get swapFee(): number;

  get isActive(): boolean;

  get tokens(): T[];

  getSpotPrice(tokenInAddress: PublicKey, tokenOutAddress: PublicKey): number;

  getPostPrice(tokenInAddress: PublicKey, tokenOutAddress: PublicKey, amountIn: number): number;

  getEstAmountOut(tokenInAddress: PublicKey, tokenOutAddress: PublicKey, amountIn: number): number;

  getEstAmountsOut(amountIn: number, totalSupply: number, tokenAddress?: PublicKey): number[];
}
