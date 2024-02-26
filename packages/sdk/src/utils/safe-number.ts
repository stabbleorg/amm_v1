import BN from "bn.js";

export type FloatLike = number | string;
export type IntegerLike = BN | number | string;

export class SafeNumber {
  static toBigAmount(uiAmount: FloatLike, decimals: number): BN {
    if (!decimals) return new BN(uiAmount);
    if (!uiAmount) return new BN(0);
    const uiAmountString = typeof uiAmount === "number" ? parseFloat(uiAmount.toString()).toFixed(decimals) : uiAmount;
    const [l, r] = uiAmountString.split(".");
    return new BN(l + (r || "0").substring(0, decimals).padEnd(decimals, "0"));
  }

  static toUiAmountString(amount: IntegerLike, decimals: number): string {
    let amountString = amount.toString();
    if (!decimals) return amountString;
    if (amountString.length < decimals) amountString = amountString.padStart(decimals, "0");
    const l = amountString.substring(0, amountString.length - decimals) || "0";
    const r = amountString.substring(amountString.length - decimals, amountString.length);
    return l + "." + r;
  }

  static toUiAmount(amount: IntegerLike, decimals: number): number {
    return Number(this.toUiAmountString(amount, decimals));
  }

  static toBasisPoints(pct: FloatLike): number {
    return this.toBigAmount(pct, 4).toNumber();
  }

  static toPercentage(bps: IntegerLike): number {
    return this.toUiAmount(bps, 4);
  }

  /**
   * @deprecated use `toBasisPoints` instead
   */
  static toBps(uiBps: FloatLike): number {
    return this.toBasisPoints(uiBps);
  }

  /**
   * @deprecated use `toPercentage` instead
   */
  static toUiBps(bps: IntegerLike): number {
    return this.toPercentage(bps);
  }
}
