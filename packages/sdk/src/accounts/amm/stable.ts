import { PublicKey } from "@solana/web3.js";
import { AmmPool, PoolToken, StablePoolData, StablePoolToken } from "./base";
import { StableMath, SafeNumber, BasicMath } from "../../utils";

export class StablePool implements AmmPool<StablePoolToken, StablePoolData> {
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
    if (this.data.ampInitialFactor >= this.data.ampTargetFactor) return this.data.ampInitialFactor;

    const currentTs = new Date().getTime() / 1000;

    if (currentTs >= this.data.rampStopTs.toNumber()) return this.data.ampTargetFactor;

    const rampElapsed = currentTs - this.data.rampStartTs.toNumber();
    const rampDuration = this.data.rampStopTs.toNumber() - this.data.rampStartTs.toNumber();
    const ampOffset = ((this.data.ampTargetFactor - this.data.ampInitialFactor) * rampElapsed) / rampDuration;
    return this.data.ampInitialFactor + ampOffset;
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
      decimals: token.decimals,
      balance: SafeNumber.toUiAmount(token.balance, StablePool.POOL_TOKEN_DECIMALS),
    }));
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
