import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { Pool, PoolData, PoolToken, PoolTokenData } from "./basePool";
import { Vault } from "./vault";
import { BasicMath, SafeNumber, WeightedMath } from "../utils";

export const WEIGHTED_SWAP_ID: PublicKey = new PublicKey("swapFpHZwjELNnjvThjajtiVmkz3yPQEHjLtka2fwHW");

export type WeightedPoolTokenData = PoolTokenData & {
  weight: BN; // u64
};

export type WeightedPoolData = PoolData & {
  tokens: WeightedPoolTokenData[];
};

export class WeightedPool implements Pool<WeightedPoolData> {
  static POOL_TOKEN_DECIMALS = 9;
  static POOL_TOKEN_SIZE = 32 + 1 + 1 + 8 + 8 + 8;

  constructor(
    readonly vault: Vault,
    readonly address: PublicKey,
    readonly data: WeightedPoolData,
  ) {
    if (!vault.address.equals(data.vault)) throw Error("Vault address does not match");
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

  get authorityAddress(): PublicKey {
    return WeightedPool.getAuthorityAddress(this.address);
  }

  get swapFee(): number {
    return SafeNumber.toPercentage(this.data.swapFee);
  }

  get isActive(): boolean {
    return this.data.isActive;
  }

  get tokens(): PoolToken[] {
    return this.data.tokens.map((token) => ({
      mintAddress: token.mint,
      balance: SafeNumber.toUiAmount(
        token.scalingUp ? token.balance.div(token.scalingFactor) : token.balance.mul(token.scalingFactor),
        token.decimals,
      ),
    }));
  }

  get balances(): number[] {
    return this.tokens.map((token) => token.balance);
  }

  get weights(): number[] {
    return this.data.tokens.map((data) => SafeNumber.toPercentage(data.weight));
  }

  getSwapAmountOut(tokenInAddress: PublicKey, tokenOutAddress: PublicKey, amountIn: number): number {
    const tokenInIndex = this.tokens.findIndex((token) => token.mintAddress.equals(tokenInAddress));
    if (tokenInIndex === -1) return 0;
    const tokenOutIndex = this.tokens.findIndex((token) => token.mintAddress.equals(tokenOutAddress));
    if (tokenOutIndex === -1) return 0;

    const amountOut = WeightedMath.calcOutGivenIn(
      this.balances[tokenInIndex],
      this.weights[tokenInIndex],
      this.balances[tokenOutIndex],
      this.weights[tokenOutIndex],
      amountIn,
      this.swapFee,
    );

    return Math.max(amountOut, 0);
  }

  getWithdrawalAmountsOut(amountIn: number, totalSupply: number, tokenAddress?: PublicKey): number[] {
    if (tokenAddress) {
      return [0];
    }

    return BasicMath.calcProportionalAmountsOut(this.balances, amountIn, totalSupply);
  }

  static getAuthorityAddress(poolAddress: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("pool_authority"), poolAddress.toBuffer()],
      WEIGHTED_SWAP_ID,
    )[0];
  }

  static getWithdrawAuthorityAddress(vaultAddress: PublicKey): PublicKey {
    return WeightedPool.getWithdrawAuthorityAddressAndBump(vaultAddress)[0];
  }

  static getWithdrawAuthorityAddressAndBump(vaultAddress: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("withdraw_authority"), vaultAddress.toBuffer()],
      WEIGHTED_SWAP_ID,
    );
  }
}
