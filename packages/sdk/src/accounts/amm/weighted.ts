import { PublicKey } from "@solana/web3.js";
import { AmmPool, WeightedPoolToken, WeightedPoolData } from "./base";
import { BasicMath, SafeNumber, WeightedMath } from "../../utils";

export class WeightedPool implements AmmPool<WeightedPoolToken, WeightedPoolData> {
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
    return SafeNumber.toPercentage(this.data.swapFee);
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
      weight: SafeNumber.toPercentage(token.weight),
    }));
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

  getEstAmountsOut(amountIn: number, totalSupply: number = 1, tokenAddress?: PublicKey): number[] {
    if (tokenAddress) {
      return [0];
    }
    return BasicMath.calcProportionalAmountsOut(
      this.tokens.map((token) => token.balanceT),
      amountIn,
      totalSupply,
    ).map((ticks, index) => ticks * this.tokens[index].tick);
  }
}
