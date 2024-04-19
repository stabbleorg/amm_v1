use crate::error::WeightedMathError;
use bn::safe_math::CheckedMulDiv;
use rust_decimal::prelude::*;
use rust_decimal::MathematicalOps;

pub const FEE_PRECISION: u64 = 1_000_000;
pub const INV_PRECISION: u64 = 1_000_000_000;

// A minimum normalized weight imposes a maximum weight ratio. We need this due to limitations in the
// implementation of the power function, as these ratios are often exponents.
pub const MIN_WEIGHT: u8 = 1;
pub const MAX_WEIGHT: u8 = 100;

pub const MIN_TOKENS: usize = 2;
pub const MAX_TOKENS: usize = 6;

// Pool limits that arise from limitations in the fixed point power function (and the imposed 1:100 maximum weight ratio).

// Swap limits: amounts swapped may not be larger than this percentage of total balance.
pub const MAX_IN_RATIO: u64 = 300_000_000;
pub const MAX_OUT_RATIO: u64 = 300_000_000;

// Invariant growth limit: non-proportional joins cannot cause the invariant to increase by more than this ratio.
pub const MAX_INVARIANT_RATIO: u64 = 3_000_000_000;
// Invariant shrink limit: non-proportional exits cannot cause the invariant to decrease by less than this ratio.
pub const MIN_INVARIANT_RATIO: u64 = 700_000_000;

// Invariant is used to collect protocol swap fees by comparing its value between two times.
// So we can round always to the same direction. It is also used to initiate the LP amount
// and, because there is a minimum LP, we round down the invariant.
// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-weighted/contracts/WeightedMath.sol#L56-L74
pub fn calc_invariant(balances: &Vec<u64>, normalized_weights: &Vec<u64>) -> Result<u64, WeightedMathError> {
    /**********************************************************************************************
    // invariant               _____                                                             //
    // wi = weight index i      | |      wi                                                      //
    // bi = balance index i     | |  bi ^   = i                                                  //
    // i = invariant                                                                             //
     **********************************************************************************************/

    let mut invariant = INV_PRECISION;

    for i in 0..balances.len() {
        invariant = invariant
            .checked_mul_div_down(pow_down(balances[i], normalized_weights[i]), INV_PRECISION)
            .unwrap();
    }

    if invariant > 0 {
        Ok(invariant)
    } else {
        Err(WeightedMathError::ZeroInvariant)
    }
}

// Computes how many tokens can be taken out of a pool if `amountIn` are sent, given the
// current balances and weights.
// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-weighted/contracts/WeightedMath.sol#L78-L109
pub fn calc_out_given_in(
    balance_in: u64,
    weight_in: u64,
    balance_out: u64,
    weight_out: u64,
    amount_in: u64,
) -> Result<u64, WeightedMathError> {
    /**********************************************************************************************
    // outGivenIn                                                                                //
    // aO = amountOut                                                                            //
    // bO = balanceOut                                                                           //
    // bI = balanceIn              /      /            bI             \    (wI / wO) \           //
    // aI = amountIn    aO = bO * |  1 - | --------------------------  | ^            |          //
    // wI = weightIn               \      \       ( bI + aI )         /              /           //
    // wO = weightOut                                                                            //
     **********************************************************************************************/
    // Amount out, so we round down overall.

    // The multiplication rounds down, and the subtrahend (power) rounds up (so the base rounds up too).
    // Because bI / (bI + aI) <= 1, the exponent rounds down.

    // Cannot exceed maximum in ratio
    if amount_in > balance_in.checked_mul_div_down(MAX_IN_RATIO, INV_PRECISION).unwrap() {
        return Err(WeightedMathError::MaxInRatio);
    }

    let base = balance_in
        .checked_mul_div_up(INV_PRECISION, balance_in + amount_in)
        .unwrap();
    let exponent = weight_in.checked_mul_div_down(INV_PRECISION, weight_out).unwrap();
    let power = pow_up(base, exponent);

    let amount_out = balance_out
        .checked_mul_div_down(INV_PRECISION.saturating_sub(power), INV_PRECISION)
        .unwrap();

    Ok(amount_out)
}

// Computes how many tokens can be taken out of a pool if `amountIn` are sent, given the
// current balances and weights.
// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-weighted/contracts/WeightedMath.sol#L113-L147
pub fn calc_in_given_out(
    balance_in: u64,
    weight_in: u64,
    balance_out: u64,
    weight_out: u64,
    amount_out: u64,
) -> Result<u64, WeightedMathError> {
    /**********************************************************************************************
    // inGivenOut                                                                                //
    // aO = amountOut                                                                            //
    // bO = balanceOut                                                                           //
    // bI = balanceIn              /  /            bO             \    (wO / wI)      \          //
    // aI = amountIn    aI = bI * |  | --------------------------  | ^            - 1  |         //
    // wI = weightIn               \  \       ( bO - aO )         /                   /          //
    // wO = weightOut                                                                            //
     **********************************************************************************************/
    // Amount in, so we round up overall.

    // The multiplication rounds up, and the power rounds up (so the base rounds up too).
    // Because b0 / (b0 - a0) >= 1, the exponent rounds up.

    // Cannot exceed maximum out ratio
    if amount_out > balance_out.checked_mul_div_down(MAX_OUT_RATIO, INV_PRECISION).unwrap() {
        return Err(WeightedMathError::MaxOutRatio);
    }

    let base = balance_out
        .checked_mul_div_up(INV_PRECISION, balance_out - amount_out)
        .unwrap();
    let exponent = weight_out.checked_mul_div_up(INV_PRECISION, weight_in).unwrap();
    let power = pow_up(base, exponent);

    let amount_in = balance_in
        .checked_mul_div_up(power - INV_PRECISION, INV_PRECISION)
        .unwrap();

    Ok(amount_in)
}

// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-weighted/contracts/WeightedMath.sol#L181-L228
pub fn calc_pool_token_out_given_exact_token_in(
    balance: u64,
    normalized_weight: u64,
    amount_in: u64,
    pool_token_supply: u64,
    swap_fee: u64,
) -> Result<u64, WeightedMathError> {
    // LP out, so we round down overall.

    let balance_ratio_with_fee = (balance + amount_in)
        .checked_mul_div_down(INV_PRECISION, balance)
        .unwrap();
    let invariant_ratio_with_fees = balance_ratio_with_fee
        .checked_mul_div_down(normalized_weight, INV_PRECISION)
        .unwrap()
        + INV_PRECISION.saturating_sub(normalized_weight);

    let amount_in_without_fee = if balance_ratio_with_fee > invariant_ratio_with_fees {
        let non_taxable_amount = if invariant_ratio_with_fees > INV_PRECISION {
            balance
                .checked_mul_div_down(invariant_ratio_with_fees.saturating_sub(INV_PRECISION), INV_PRECISION)
                .unwrap()
        } else {
            0
        };
        let taxable_amount = amount_in - non_taxable_amount;
        let swap_fee_amount = taxable_amount.checked_mul_div_up(swap_fee, FEE_PRECISION).unwrap();
        non_taxable_amount + taxable_amount - swap_fee_amount
    } else {
        amount_in
    };

    if amount_in_without_fee == 0 {
        return Ok(0);
    }

    let balance_ratio = (balance + amount_in_without_fee)
        .checked_mul_div_down(INV_PRECISION, balance)
        .unwrap();
    let invariant_ratio = pow_down(balance_ratio, normalized_weight);

    if invariant_ratio > INV_PRECISION {
        let amount_out = pool_token_supply
            .checked_mul_div_down(invariant_ratio.saturating_sub(INV_PRECISION), INV_PRECISION)
            .unwrap();
        Ok(amount_out)
    } else {
        Ok(0)
    }
}

// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-weighted/contracts/WeightedMath.sol#L149-L179
pub fn calc_pool_token_out_given_exact_tokens_in(
    balances: &Vec<u64>,
    normalized_weights: &Vec<u64>,
    amounts_in: &Vec<u64>,
    pool_token_supply: u64,
    swap_fee: u64,
) -> Result<u64, WeightedMathError> {
    let mut balance_ratios_with_fee = vec![];
    let mut invariant_ratio_with_fees = 0;

    for i in 0..balances.len() {
        let balance_ratio_with_fee = (balances[i] + amounts_in[i])
            .checked_mul_div_down(INV_PRECISION, balances[i])
            .unwrap();
        balance_ratios_with_fee.push(balance_ratio_with_fee);
        invariant_ratio_with_fees = balance_ratio_with_fee
            .checked_mul_div_down(normalized_weights[i], INV_PRECISION)
            .unwrap()
            + invariant_ratio_with_fees;
    }

    // See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-weighted/contracts/WeightedMath.sol#L233-L272
    let mut invariant_ratio = INV_PRECISION;
    for i in 0..balances.len() {
        let amount_in_without_fee;

        if balance_ratios_with_fee[i] > invariant_ratio_with_fees {
            // invariantRatioWithFees might be less than FixedPoint.ONE in edge scenarios due to rounding error,
            // particularly if the weights don't exactly add up to 100%.
            let non_taxable_amount = if invariant_ratio_with_fees > INV_PRECISION {
                balances[i]
                    .checked_mul_div_down(invariant_ratio_with_fees.saturating_sub(INV_PRECISION), INV_PRECISION)
                    .unwrap()
            } else {
                0
            };
            let swap_fee_amount = (amounts_in[i] - non_taxable_amount)
                .checked_mul_div_up(swap_fee, FEE_PRECISION)
                .unwrap();
            amount_in_without_fee = amounts_in[i] - swap_fee_amount;
        } else {
            amount_in_without_fee = amounts_in[i];

            // If a token's amount in is not being charged a swap fee then it might be zero (e.g. when joining a
            // Pool with only a subset of tokens). In this case, `balance_ratio` will equal `FixedPoint.ONE`, and
            // the `invariantRatio` will not change at all. We therefore skip to the next iteration, avoiding
            // the costly `powDown` call.
            if amount_in_without_fee == 0 {
                continue;
            }
        }

        let balance_ratio = (balances[i] + amount_in_without_fee)
            .checked_mul_div_down(INV_PRECISION, balances[i])
            .unwrap();
        invariant_ratio = invariant_ratio
            .checked_mul_div_down(pow_down(balance_ratio, normalized_weights[i]), INV_PRECISION)
            .unwrap();
    }

    if invariant_ratio > INV_PRECISION {
        let amount_out = pool_token_supply
            .checked_mul_div_down(invariant_ratio.saturating_sub(INV_PRECISION), INV_PRECISION)
            .unwrap();
        Ok(amount_out)
    } else {
        Ok(0)
    }
}

// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-weighted/contracts/WeightedMath.sol#L423-L462
pub fn calc_token_out_given_exact_pool_token_in(
    balance: u64,
    normalized_weight: u64,
    amount_in: u64,
    pool_token_supply: u64,
    swap_fee: u64,
) -> Result<u64, WeightedMathError> {
    /*****************************************************************************************
    // exactLPInForTokenOut                                                                 //
    // a = amountOut                                                                        //
    // b = balance                   /      /      totalLP - lpIn      \    (1 / w)  \      //
    // lpIn = lpAmountIn    a = b * |  1 - | -------------------------- | ^           |     //
    // lp = totalLP                  \      \       totalLP            /             /      //
    // w = weight                                                                           //
     *****************************************************************************************/
    // Token out, so we round down overall. The multiplication rounds down, but the power rounds up (so the base
    // rounds up). Because (totalLP - lpIn) / totalLP <= 1, the exponent rounds down.

    // Calculate the factor by which the invariant will decrease after burning LPAmountIn

    let invariant_ratio = (pool_token_supply - amount_in)
        .checked_mul_div_up(INV_PRECISION, pool_token_supply)
        .unwrap();
    if invariant_ratio < MIN_INVARIANT_RATIO {
        return Err(WeightedMathError::MinInvariantRatio);
    }

    // Calculate by how much the token balance has to decrease to match invariantRatio
    let exponent = INV_PRECISION
        .checked_mul_div_down(INV_PRECISION, normalized_weight)
        .unwrap();
    let balance_ratio = pow_up(invariant_ratio, exponent);

    // Because of rounding up, balance_ratio can be greater than one. Using complement prevents reverts.
    let amount_out_without_fee = balance
        .checked_mul_div_down(INV_PRECISION.saturating_sub(balance_ratio), INV_PRECISION)
        .unwrap();

    // We can now compute how much excess balance is being withdrawn as a result of the virtual swaps, which result
    // in swap fees.

    // Swap fees are typically charged on 'token in', but there is no 'token in' here, so we apply it
    // to 'token out'. This results in slightly larger price impact. Fees are rounded up.
    let taxable_amount = amount_out_without_fee
        .checked_mul_div_up(INV_PRECISION.saturating_sub(normalized_weight), INV_PRECISION)
        .unwrap();
    let non_taxable_amount = amount_out_without_fee - taxable_amount;
    let taxable_amount_minus_fees = taxable_amount
        .checked_mul_div_up(FEE_PRECISION.saturating_sub(swap_fee), FEE_PRECISION)
        .unwrap();

    Ok(non_taxable_amount + taxable_amount_minus_fees)
}

fn pow_up(base: u64, exponent: u64) -> u64 {
    Decimal::from_i128_with_scale(base as i128, 9)
        .powd(Decimal::from_i128_with_scale(exponent as i128, 9))
        .round_dp_with_strategy(9, RoundingStrategy::AwayFromZero)
        .mantissa() as u64
}

fn pow_down(base: u64, exponent: u64) -> u64 {
    Decimal::from_i128_with_scale(base as i128, 9)
        .powd(Decimal::from_i128_with_scale(exponent as i128, 9))
        .round_dp(9)
        .mantissa() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    pub const BALANCES: [u64; 2] = [5_000_000_000_000_000_000, 1_000_000_000_000_000_000];
    pub const NORMALIZED_WEIGHTS: [u64; 2] = [500_000_000, 500_000_000];

    #[test]
    fn test_calc_invariant() {
        let invariant = calc_invariant(&BALANCES.to_vec(), &NORMALIZED_WEIGHTS.to_vec()).unwrap();
        assert_eq!(invariant, 2236021719197214567);
    }

    #[test]
    fn test_calc_out_given_in() {
        let amount_out = calc_out_given_in(
            BALANCES[0],
            NORMALIZED_WEIGHTS[0],
            BALANCES[1],
            NORMALIZED_WEIGHTS[1],
            100_000_000_000,
        )
        .unwrap();
        assert_eq!(amount_out, 19000000000);

        let amount_out = calc_out_given_in(
            BALANCES[0],
            NORMALIZED_WEIGHTS[0],
            BALANCES[1],
            NORMALIZED_WEIGHTS[1],
            1_000_000_000_000_000,
        )
        .unwrap();
        assert_eq!(amount_out, 199960000000000);

        let amount_out = calc_out_given_in(
            538787471_887000000,
            700_000_000,
            898152_463000000,
            300_000_000,
            100_000_000_000,
        )
        .unwrap();
        assert_eq!(amount_out, 387103711);
        let amount_out = calc_out_given_in(
            366851436508161000,
            600_000_000,
            958530278657000,
            400_000_000,
            100_000_000_000,
        )
        .unwrap();
        assert_eq!(amount_out, 390121823);
    }

    #[test]
    fn test_calc_pool_token_out() {
        let amount_out = calc_pool_token_out_given_exact_token_in(
            BALANCES[0],
            NORMALIZED_WEIGHTS[0],
            5_000_000_000_000_000,
            2236021719197214567 << 1,
            10_000,
        )
        .unwrap();
        assert_eq!(amount_out, 2224287077214867);

        let amount_out = calc_pool_token_out_given_exact_token_in(
            BALANCES[0],
            NORMALIZED_WEIGHTS[0],
            5_000_000_000_000,
            2236021719197214567 << 1,
            10_000,
        )
        .unwrap();
        assert_eq!(amount_out, 2222605588882);

        let amount_out = calc_pool_token_out_given_exact_token_in(
            BALANCES[1],
            NORMALIZED_WEIGHTS[1],
            1_000_000_000_000_000,
            2236021719197214567 << 1,
            10_000,
        )
        .unwrap();
        assert_eq!(amount_out, 2224287077214867);

        let amount_out = calc_pool_token_out_given_exact_token_in(
            BALANCES[1],
            NORMALIZED_WEIGHTS[1],
            1_000_000_000_000,
            2236021719197214567 << 1,
            10_000,
        )
        .unwrap();
        assert_eq!(amount_out, 2222605588882);

        let amount_out = calc_pool_token_out_given_exact_tokens_in(
            &BALANCES.to_vec(),
            &NORMALIZED_WEIGHTS.to_vec(),
            &vec![5_000_000_000_000_000 >> 1, 1_000_000_000_000_000 >> 1],
            2236021719197214567 << 1,
            10_000,
        )
        .unwrap();
        assert_eq!(amount_out, 2236021719197214);
    }

    #[test]
    fn test_calc_token_out_given_exact_pool_token_in() {
        let amount_out = calc_token_out_given_exact_pool_token_in(
            BALANCES[0],
            NORMALIZED_WEIGHTS[0],
            2222605588882,
            2236021719197214567 << 1,
            10_000,
        )
        .unwrap();
        assert_eq!(amount_out, 4930225000000);

        let amount_out = calc_token_out_given_exact_pool_token_in(
            BALANCES[1],
            NORMALIZED_WEIGHTS[1],
            2222605588882,
            2236021719197214567 << 1,
            10_000,
        )
        .unwrap();
        assert_eq!(amount_out, 986045000000);
    }
}
