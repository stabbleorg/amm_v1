import BN from "bn.js";
import { Decimal } from "decimal.js";

export type FloatLike = number | string;
export type IntegerLike = BN | number | string;

export class SafeNumber {
  static toBigAmount(uiAmount: FloatLike, decimals: number): BN {
    return new BN(new Decimal(uiAmount).mul(new Decimal(10).pow(decimals)).toDP(0, Decimal.ROUND_UP).toString());
  }

  static toUiAmountString(amount: IntegerLike, decimals: number): string {
    return new Decimal(amount.toString()).div(new Decimal(10).pow(decimals)).toString();
  }

  static toUiAmount(amount: IntegerLike, decimals: number): number {
    return new Decimal(amount.toString()).div(new Decimal(10).pow(decimals)).toNumber();
  }

  static toBasisPoints(pct: FloatLike): BN {
    return this.toBigAmount(pct, 9);
  }

  static toPercentage(bps: IntegerLike): number {
    return this.toUiAmount(bps, 9);
  }
}
