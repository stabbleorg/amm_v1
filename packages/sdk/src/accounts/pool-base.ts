import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";

export type PoolToken = {
  mintAddress: PublicKey;
  decimals: number;
  balance: number;
};

export type PoolTokenData = {
  mint: PublicKey;
  decimals: number; // u8
  multiplier: number; // u32
  scalingFactor: number; // u32
  balance: BN; // u64
};

export type BasePoolData = {
  owner: PublicKey;
  vault: PublicKey;
  mint: PublicKey;
  invariant: BN;
  swapFee: number;
  isActive: boolean;
  authorityBump: number;
};

export interface BasePool<T extends PoolToken> {
  get vaultAddress(): PublicKey;

  get ownerAddress(): PublicKey;

  get mintAddress(): PublicKey;

  get swapFee(): number;

  get isActive(): boolean;

  get tokens(): T[];

  getSpotPrice(tokenInAddress: PublicKey, tokenOutAddress: PublicKey): number;

  getPostPrice(tokenInAddress: PublicKey, tokenOutAddress: PublicKey, amountIn: number): number;

  getEstAmountOut(tokenInAddress: PublicKey, tokenOutAddress: PublicKey, amountIn: number): number;
}
