export class WeightedMath {
  static MAX_INVARIANT_RATIO = 3;
  static MIN_INVARIANT_RATIO = 0.7;
  static MAX_IN_RATIO = 0.3;
  static MAX_OUT_RATIO = 0.3;

  static calcSpotPrice(
    balanceIn: number,
    weightIn: number,
    balanceOut: number,
    weightOut: number,
    swapFee: number = 0,
  ): number {
    return ((balanceOut * weightIn) / (balanceIn * weightOut)) * (1 - swapFee);
  }

  static calcOutGivenIn(
    balanceIn: number,
    weightIn: number,
    balanceOut: number,
    weightOut: number,
    amountIn: number,
    swapFee: number = 0,
  ): number {
    if (!amountIn) return 0;

    if (amountIn > balanceIn * WeightedMath.MAX_IN_RATIO) return 0;

    return balanceOut * (1 - (balanceIn / (balanceIn + amountIn)) ** (weightIn / weightOut)) * (1 - swapFee);
  }

  static calcTokenOutGivenExactPoolTokenIn(
    balance: number,
    normalizedWeight: number,
    amountIn: number,
    poolTokenSupply: number,
    swapFee: number,
  ): number {
    let invariantRatio = (poolTokenSupply - amountIn) / poolTokenSupply;

    if (invariantRatio < WeightedMath.MIN_INVARIANT_RATIO) {
      return 0;
    }

    let balanceRatio = Math.pow(invariantRatio, 1 / normalizedWeight);

    let amountOutWithoutFee = balance * (1 - balanceRatio);

    let taxableAmount = amountOutWithoutFee * (1 - normalizedWeight);
    let nonTaxableAmount = amountOutWithoutFee - taxableAmount;
    let taxableAmountMinusFees = taxableAmount * (1 - swapFee);

    return nonTaxableAmount + taxableAmountMinusFees;
  }
}

export class StableMath {
  // Convergence threshold
  static INV_THRESHOLD = 100e-9;
  static BALANCE_THRESHOLD = 1e-9;

  static calcInvariant(balances: number[], amplification: number): number {
    const N = balances.length;
    const S = balances.reduce((res, balance) => res + balance, 0);

    if (S === 0) return 0;

    let prevInvariant = 0;
    let invariant = S;
    const ampTimesTotal = amplification * N;

    for (let i = 0; i < 255; i++) {
      let P_D = invariant;
      for (let j = 0; j < N; j++) {
        P_D = (P_D * invariant) / (balances[j] * N);
      }

      prevInvariant = invariant;
      invariant = ((ampTimesTotal * S + P_D * N) * invariant) / ((ampTimesTotal - 1) * invariant + (N + 1) * P_D);

      if (invariant > prevInvariant) {
        if (invariant - prevInvariant <= StableMath.INV_THRESHOLD) break;
      } else if (prevInvariant - invariant <= StableMath.INV_THRESHOLD) break;
    }

    return invariant;
  }

  static calcSpotPrice(
    balances: number[],
    amplification: number,
    tokenIndexIn: number,
    tokenIndexOut: number,
    swapFee: number = 0,
  ): number {
    const N = balances.length;
    const D = this.calcInvariant(balances, amplification);
    let S = 0;
    for (let i = 0; i < N; i++) {
      if (i != tokenIndexIn && i != tokenIndexOut) {
        S += balances[i];
      }
    }
    const x = balances[tokenIndexIn];
    const y = balances[tokenIndexOut];
    const a = amplification * N ** N;
    const b = (S - D) * a + D;
    const c = 2 * a * x * y;
    const pX = c + a * y * y + b * y;
    const pY = c + a * x * x + b * x;

    return (pX / pY) * (1 - swapFee);
  }

  static calcOutGivenIn(
    balances: number[],
    amplification: number,
    tokenIndexIn: number,
    tokenIndexOut: number,
    amountIn: number,
    swapFee: number = 0,
  ): number {
    if (!amountIn) return 0;

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

  static calcTokenOutGivenExactPoolTokenIn(
    balances: number[],
    amplification: number,
    tokenIndex: number,
    amountIn: number,
    poolTokenSupply: number,
    currentInvariant: number,
    swapFee: number = 0,
  ): number {
    const newInvariant = ((poolTokenSupply - amountIn) * currentInvariant) / poolTokenSupply;

    const newBalance = this._getTokenBalanceGivenInvariantAndAllOtherBalances(
      balances,
      amplification,
      newInvariant,
      tokenIndex,
    );
    const amountOutWithoutFee = balances[tokenIndex] - newBalance;

    const currentWeight = balances[tokenIndex] / balances.reduce((res, balance) => res + balance, 0);
    const taxablePercentage = 1 - currentWeight;

    const taxableAmount = amountOutWithoutFee * taxablePercentage;
    const nonTaxableAmount = amountOutWithoutFee - taxableAmount;

    const amountOut = taxableAmount * (1 - swapFee) + nonTaxableAmount;

    return amountOut;
  }

  static _getTokenBalanceGivenInvariantAndAllOtherBalances(
    balances: number[],
    amplification: number,
    invariant: number,
    tokenIndex: number,
  ): number {
    const N = balances.length;
    const ampTimesTotal = amplification * N;
    let S = balances[0];
    let P_D = balances[0] * N;

    for (let i = 1; i < N; i++) {
      P_D = (P_D * balances[i] * N) / invariant;
      S = S + balances[i];
    }
    S = S - balances[tokenIndex];

    const invariant2 = invariant * invariant;
    const b = invariant / ampTimesTotal + S;
    const c = (invariant2 / (ampTimesTotal * P_D)) * balances[tokenIndex];

    let prevBalance = 0;
    let balance = (invariant2 + c) / (invariant + b);

    for (let i = 0; i < 255; i++) {
      prevBalance = balance;
      balance = (prevBalance * prevBalance + c) / (prevBalance * 2 + b - invariant);
      if (balance > prevBalance) {
        if (balance - prevBalance <= StableMath.BALANCE_THRESHOLD) return balance;
      } else if (prevBalance - balance <= StableMath.BALANCE_THRESHOLD) return balance;
    }

    return balances[tokenIndex];
  }
}

export class BasicMath {
  static calcProportionalAmountsOut(balances: number[], amountIn: number, totalSupply: number): number[] {
    return balances.map((balance) => balance * (amountIn / totalSupply));
  }
}
