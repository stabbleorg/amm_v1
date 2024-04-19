import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";

export interface PoolToken {
  mintAddress: PublicKey;
  decimals: number;
  balance: number;
}
export interface PoolTokenData {
  mint: PublicKey;
  decimals: number;
  scalingFactor: BN; // u64
  balance: BN; // u64
}
export interface BasePoolData {
  owner: PublicKey;
  vault: PublicKey;
  mint: PublicKey;
  authorityBump: number;
  isActive: boolean;
  swapFee: BN;
  pendingOwner: PublicKey | null;
}

export interface StablePoolToken extends PoolToken {}
export interface StablePoolTokenData extends PoolTokenData {}
export interface StablePoolData extends BasePoolData {
  ampInitialFactor: number;
  ampTargetFactor: number;
  rampStartTs: BN;
  rampStopTs: BN;
  tokens: StablePoolTokenData[];
}

export interface WeightedPoolToken extends PoolToken {
  weight: number; // percentage
}
export interface WeightedPoolTokenData extends PoolTokenData {
  weight: BN;
}
export interface WeightedPoolData extends BasePoolData {
  invariant: BN;
  tokens: WeightedPoolTokenData[];
}

export type AmmPoolToken = StablePoolToken | WeightedPoolToken;
export type AmmPoolData = StablePoolData | WeightedPoolData;

export interface AmmPool<T extends PoolToken = AmmPoolToken, D extends BasePoolData = AmmPoolData> {
  readonly address: PublicKey;
  readonly data: D;

  get vaultAddress(): PublicKey;

  get ownerAddress(): PublicKey;

  get mintAddress(): PublicKey;

  get swapFee(): number;

  get isActive(): boolean;

  get tokens(): T[];

  getEstAmountOut(tokenInAddress: PublicKey, tokenOutAddress: PublicKey, amountIn: number): number;

  getEstAmountsOut(amountIn: number, totalSupply: number, tokenAddress?: PublicKey): number[];
}
