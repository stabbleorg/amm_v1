import BN from "bn.js";
import { PublicKey, TokenAmount } from "@solana/web3.js";
import { Vault } from "./vault";

export type PoolTokenData = {
  mint: PublicKey;
  decimals: number; // u8
  scalingUp: boolean;
  scalingFactor: BN; // u64
  balance: BN; // u64
};

export type PoolData = {
  owner: PublicKey;
  vault: PublicKey;
  mint: PublicKey;
  authorityBump: number; // u8
  isActive: boolean;
  swapFee: BN; // u64
  pendingOwner: PublicKey | null;
};

export type PoolToken = {
  mintAddress: PublicKey;
  balance: TokenAmount;
};

export interface Pool<T> {
  readonly address: PublicKey;

  readonly vault: Vault;

  data: T;

  get vaultAddress(): PublicKey;

  get ownerAddress(): PublicKey;

  get mintAddress(): PublicKey;

  get authorityAddress(): PublicKey;

  get swapFee(): number;

  get isActive(): boolean;

  get tokens(): PoolToken[];

  get balances(): number[];

  refreshData(updatedData: Partial<T>): void;

  /**
   * Get estimated swap amount out given amount in
   *
   * @param tokenInAddress token mint address being sold
   * @param tokenOutAddress token mint address being bought
   * @param amountIn token amount being sold
   */
  getSwapAmountOut(tokenInAddress: PublicKey, tokenOutAddress: PublicKey, amountIn: number): number;

  /**
   * Get estimated withdrawal amounts given LP amount
   *
   * @param amountIn LP token amount being burnt
   * @param totalSupply LP token supply
   * @param tokenAddress Optional token mint address for single sided withdraw
   */
  getWithdrawalAmountsOut(amountIn: number, totalSupply: number, tokenAddress?: PublicKey): number[];
}
