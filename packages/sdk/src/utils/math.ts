export class WeightedMath {
  static calcOutGivenIn(
    balanceIn: number,
    weightIn: number,
    balanceOut: number,
    weightOut: number,
    amountIn: number,
    swapFee: number = 0,
  ): number {
    if (amountIn > balanceIn * 0.3) return 0;
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

export class StableMath {
  static calcInvariant(balances: number[], amplification: number): number {
    const numTokens = balances.length;
    const sum = balances.reduce((a, b) => a + b, 0);

    if (sum === 0) return 0;

    let prevInv = 0;
    let inv = sum;
    const ampTimesTotal = amplification * numTokens;

    for (let i = 0; i < 255; i++) {
      let P_D = inv;
      for (let j = 0; j < numTokens; j++) {
        P_D = (P_D * inv) / (balances[j] * numTokens);
      }

      prevInv = inv;
      inv = ((ampTimesTotal * sum + P_D * numTokens) * inv) / ((ampTimesTotal - 1) * inv + (numTokens + 1) * P_D);

      // converge with precision of integer 1
      if (inv > prevInv) {
        if (inv - prevInv <= 1e-9) break;
      } else if (prevInv - inv <= 1e-9) break;
    }

    return inv;
  }

  static calcOutGivenIn(
    balances: number[],
    amplification: number,
    tokenIndexIn: number,
    tokenIndexOut: number,
    amountIn: number,
    swapFee: number = 0,
  ): number {
    const invariant = this.calcInvariant(balances, amplification);

    balances[tokenIndexIn] = balances[tokenIndexIn] + amountIn;

    const finalBalanceOut = this._getTokenBalanceGivenInvariantAndAllOtherBalances(
      balances,
      amplification,
      invariant,
      tokenIndexOut,
    );

    balances[tokenIndexIn] = balances[tokenIndexIn] - amountIn;

    return (balances[tokenIndexOut] - finalBalanceOut) * (1 - swapFee);
  }

  static _getTokenBalanceGivenInvariantAndAllOtherBalances(
    balances: number[],
    amplification: number,
    invariant: number,
    tokenIndex: number,
  ): number {
    const numTokens = balances.length;
    const ampTimesTotal = amplification * numTokens;
    let sum = balances[0];
    let P_D = balances[0] * numTokens;

    for (let i = 1; i < numTokens; i++) {
      P_D = (P_D * balances[i] * numTokens) / invariant;
      sum = sum + balances[i];
    }
    sum = sum - balances[tokenIndex];

    const inv2 = invariant ** 2;
    const b = invariant / ampTimesTotal + sum;
    const c = (inv2 / (ampTimesTotal * P_D)) * balances[tokenIndex];

    let prevBalance = 0;
    let balance = (inv2 + c) / (invariant + b);

    for (let i = 0; i < 255; i++) {
      prevBalance = balance;
      balance = (prevBalance * prevBalance + c) / (prevBalance * 2 + b - invariant);
      if (balance > prevBalance) {
        if (balance - prevBalance <= 1e-9) break;
      } else if (prevBalance - balance <= 1e-9) break;
    }

    return balance;
  }
}

export class BasicMath {
  static calcProportionalAmountsOut(balances: number[], amountIn: number, totalSupply: number): number[] {
    return balances.map((balance) => (balance * amountIn) / totalSupply);
  }
}
