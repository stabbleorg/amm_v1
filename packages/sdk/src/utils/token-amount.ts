import BN from "bn.js";

export class TokenAmountUtil {
  static toBigAmount(uiAmount: number | string, decimals: number): BN {
    if (!decimals) return new BN(uiAmount);
    const [l, r] = uiAmount.toString().split(".");
    return new BN(l.padEnd(l.length + decimals, "0")).add(
      new BN((r || "0").substring(0, decimals).padEnd(decimals, "0")),
    );
  }

  static toUiAmount(amount: BN | string, decimals: number): string {
    let amountString = amount.toString();
    if (!decimals) return amountString;
    if (amountString.length < decimals) amountString = amountString.padStart(decimals, "0");
    const l = amountString.substring(0, amountString.length - decimals) || "0";
    const r = amountString.substring(amountString.length - decimals, amountString.length);
    return l + "." + r;
  }
}
