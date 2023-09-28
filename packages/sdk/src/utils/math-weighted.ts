export class WeightedMath {
  static calcOutGivenIn(
    balanceIn: number,
    weightIn: number,
    balanceOut: number,
    weightOut: number,
    amountIn: number,
    swapFee: number = 0,
  ): number {
    return balanceOut * (1 - (balanceIn / (balanceIn + amountIn)) ** (weightIn / weightOut)) * (1 - swapFee);
  }

  static calcSpotPrice(
    balanceIn: number,
    weightIn: number,
    balanceOut: number,
    weightOut: number,
    swapFee: number = 0,
  ): number {
    return ((balanceOut * weightIn) / (balanceIn * weightOut)) * (1 - swapFee);
  }

  static calcPostPrice(
    balanceIn: number,
    weightIn: number,
    balanceOut: number,
    weightOut: number,
    amountIn: number,
    swapFee: number = 0,
  ): number {
    const amountOut = this.calcOutGivenIn(balanceIn, weightIn, balanceOut, weightOut, amountIn, swapFee);
    return this.calcSpotPrice(balanceIn + amountIn, weightIn, balanceOut - amountOut, weightOut, swapFee);
  }

  static calcBalanceRatio(weightA: number, priceA: number, weightB: number, priceB: number): number {
    return (priceB * weightA) / (priceA * weightB);
  }
}
