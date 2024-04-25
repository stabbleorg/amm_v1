import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { Pool, PoolData, PoolToken, PoolTokenData } from "./basePool";
import { Vault } from "./vault";
import { BasicMath, SafeNumber, StableMath } from "../utils";

export const STABLE_SWAP_ID: PublicKey = new PublicKey("swapNyd8XiQwJ6ianp9snpu4brUqFxadzvHebnAXjJZ");

export type StablePoolTokenData = PoolTokenData;

export type StablePoolData = PoolData & {
  ampInitialFactor: number; // u16
  ampTargetFactor: number; // u16
  rampStartTs: BN; // i64
  rampStopTs: BN; // i64
  tokens: StablePoolTokenData[];
};

export class StablePool implements Pool<StablePoolData> {
  static POOL_TOKEN_DECIMALS = 9;
  static POOL_TOKEN_SIZE = 32 + 1 + 1 + 8 + 8;

  constructor(
    readonly vault: Vault,
    readonly address: PublicKey,
    readonly data: StablePoolData,
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
    return StablePool.getAuthorityAddress(this.address);
  }

  get amplification(): number {
    const currentTs = new Date().getTime() / 1000;

    if (currentTs <= this.data.rampStartTs.toNumber()) return this.data.ampInitialFactor;
    if (currentTs >= this.data.rampStopTs.toNumber()) return this.data.ampTargetFactor;

    const rampElapsed = currentTs - this.data.rampStartTs.toNumber();
    const rampDuration = this.data.rampStopTs.toNumber() - this.data.rampStartTs.toNumber();
    if (this.data.ampInitialFactor <= this.data.ampTargetFactor) {
      const ampOffset = ((this.data.ampTargetFactor - this.data.ampInitialFactor) * rampElapsed) / rampDuration;
      return this.data.ampInitialFactor + ampOffset;
    } else {
      const ampOffset = ((this.data.ampInitialFactor - this.data.ampTargetFactor) * rampElapsed) / rampDuration;
      return this.data.ampInitialFactor - ampOffset;
    }
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

  getSwapAmountOut(tokenInAddress: PublicKey, tokenOutAddress: PublicKey, amountIn: number): number {
    const tokenInIndex = this.tokens.findIndex((token) => token.mintAddress.equals(tokenInAddress));
    if (tokenInIndex === -1) return 0;
    const tokenOutIndex = this.tokens.findIndex((token) => token.mintAddress.equals(tokenOutAddress));
    if (tokenOutIndex === -1) return 0;

    const amountOut = StableMath.calcOutGivenIn(
      this.balances,
      this.amplification,
      tokenInIndex,
      tokenOutIndex,
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
    return PublicKey.findProgramAddressSync([Buffer.from("pool_authority"), poolAddress.toBuffer()], STABLE_SWAP_ID)[0];
  }

  static getWithdrawAuthorityAddress(vaultAddress: PublicKey): PublicKey {
    return StablePool.getWithdrawAuthorityAddressAndBump(vaultAddress)[0];
  }

  static getWithdrawAuthorityAddressAndBump(vaultAddress: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("withdraw_authority"), vaultAddress.toBuffer()],
      STABLE_SWAP_ID,
    );
  }
}
