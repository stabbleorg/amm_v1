use crate::{bn::*, error::WeightedMathError};

// A minimum normalized weight imposes a maximum weight ratio. We need this due to limitations in the
// implementation of the power function, as these ratios are often exponents.
pub const MIN_WEIGHT: u16 = 1;
// Having a minimum normalized weight imposes a limit on the maximum number of tokens;
// i.e., the largest possible pool is one where all tokens have exactly the minimum weight.
pub const MAX_WEIGHTED_TOKENS: usize = 100;

// Pool limits that arise from limitations in the fixed point power function (and the imposed 1:100 maximum weight ratio).

// Swap limits: amounts swapped may not be larger than this percentage of total balance.
pub const MAX_IN_RATIO: u64 = 300000000;
pub const MAX_OUT_RATIO: u64 = 300000000;

// Invariant growth limit: non-proportional joins cannot cause the invariant to increase by more than this ratio.
pub const MAX_INVARIANT_RATIO: u64 = 3000000000;
// Invariant shrink limit: non-proportional exits cannot cause the invariant to decrease by less than this ratio.
pub const MIN_INVARIANT_RATIO: u64 = 700000000;

// Invariant is used to collect protocol swap fees by comparing its value between two times.
// So we can round always to the same direction. It is also used to initiate the BPT amount
// and, because there is a minimum BPT, we round down the invariant.
// https://github.com/balancer/balancer-v2-monorepo/blob/master/pkg/pool-weighted/contracts/WeightedMath.sol#L56
pub fn calc_invariant(normalized_weights: Vec<U256>, balances: Vec<U256>) -> Result<U256, WeightedMathError> {
    /**********************************************************************************************
    // invariant               _____                                                             //
    // wi = weight index i      | |      wi                                                      //
    // bi = balance index i     | |  bi ^   = i                                                  //
    // i = invariant                                                                             //
     **********************************************************************************************/

    let mut invariant = U256::one();

    for j in 0..balances.len() {
        invariant = invariant
            .checked_mul(balances[j].checked_pow(normalized_weights[j]).unwrap())
            .unwrap();
    }

    if invariant > U256::zero() {
        Ok(invariant)
    } else {
        Err(WeightedMathError::ZeroInvariant)
    }
}

// // WeightedMath._calcOutGivenIn
// // Computes how many tokens can be taken out of a pool if `amountIn` are sent, given the
// // current balances and weights.
// pub fn calc_out_given_in(
//     balance_in: f64, // starting balance
//     weight_in: f64,
//     balance_out: f64, // starting balance
//     weight_out: f64,
//     amount_in: f64,
// ) -> Result<f64> {
//     /**********************************************************************************************
//     // outGivenIn                                                                                //
//     // aO = amountOut                                                                            //
//     // bO = balanceOut                                                                           //
//     // bI = balanceIn              /      /            bI             \    (wI / wO) \           //
//     // aI = amountIn    aO = bO * |  1 - | --------------------------  | ^            |          //
//     // wI = weightIn               \      \       ( bI + aI )         /              /           //
//     // wO = weightOut                                                                            //
//      **********************************************************************************************/
//     // Amount out, so we round down overall.

//     // The multiplication rounds down, and the subtrahend (power) rounds up (so the base rounds up too).
//     // Because bI / (bI + aI) <= 1, the exponent rounds down.

//     // Cannot exceed maximum in ratio
//     require!(amount_in <= balance_in * MAX_IN_RATIO, CustomError::MaxInRatio);

//     let denominator = balance_in + amount_in;
//     let base = balance_in / denominator;
//     let exponent = weight_in / weight_out;
//     let power = base.powf(exponent);
//     let ratio = complement(power);
//     let amount_out = balance_out * ratio;

//     Ok(amount_out)
// }

// // WeightedMath._calcInGivenOut (Not used)
// // Computes how many tokens can be taken out of a pool if `amountIn` are sent, given the
// // current balances and weights.
// pub fn calc_in_given_out(
//     balance_in: f64, // starting balance
//     weight_in: f64,
//     balance_out: f64, // starting balance
//     weight_out: f64,
//     amount_out: f64,
// ) -> Result<f64> {
//     /**********************************************************************************************
//     // inGivenOut                                                                                //
//     // aO = amountOut                                                                            //
//     // bO = balanceOut                                                                           //
//     // bI = balanceIn              /  /            bO             \    (wO / wI)      \          //
//     // aI = amountIn    aI = bI * |  | --------------------------  | ^            - 1  |         //
//     // wI = weightIn               \  \       ( bO - aO )         /                   /          //
//     // wO = weightOut                                                                            //
//      **********************************************************************************************/
//     // Amount in, so we round up overall.

//     // The multiplication rounds up, and the power rounds up (so the base rounds up too).
//     // Because b0 / (b0 - a0) >= 1, the exponent rounds up.

//     // Cannot exceed maximum out ratio
//     require!(amount_out <= balance_out * MAX_OUT_RATIO, CustomError::MaxOutRatio);

//     let denominator = balance_out - amount_out;
//     let base = balance_out / denominator;
//     let exponent = weight_out / weight_in;
//     let power = base.powf(exponent);
//     let ratio = power - 1.0;
//     let amount_in = balance_in * ratio;

//     Ok(amount_in)
// }

// // WeightedMath._calcBptOutGivenExactTokenIn
// pub fn calc_out_exact_token_in(
//     balance: f64, // ending balance
//     normalized_weight: f64,
//     amount_in: f64,
//     total_supply: f64, // LP total supply
//     swap_fee: f64,
// ) -> Result<f64> {
//     // LP out, so we round down overall.

//     let starting_balance = balance - amount_in;
//     let balance_ratio_with_fee = balance / starting_balance;
//     let invariant_ratio_with_fees = balance_ratio_with_fee * normalized_weight + complement(normalized_weight);

//     let amount_in_without_fee = if balance_ratio_with_fee > invariant_ratio_with_fees {
//         let non_taxable_amount = if invariant_ratio_with_fees > 1.0 {
//             starting_balance * (invariant_ratio_with_fees - 1.0)
//         } else {
//             0.0
//         };
//         let taxable_amount = amount_in - non_taxable_amount;
//         let swap_fee_amount = taxable_amount * swap_fee;
//         non_taxable_amount + taxable_amount - swap_fee_amount
//     } else {
//         amount_in
//     };

//     if amount_in_without_fee == 0.0 {
//         return Ok(0.0);
//     }

//     let balance_ratio = (starting_balance + amount_in_without_fee) / starting_balance;
//     let invariant_ratio = balance_ratio.powf(normalized_weight);

//     if invariant_ratio > 1.0 {
//         Ok(total_supply * (invariant_ratio - 1.0))
//     } else {
//         Ok(0.0)
//     }
// }

// // WeightedMath._calcBptOutGivenExactTokensIn
// pub fn calc_out_exact_tokens_in(
//     balances: Vec<f64>, // ending balances
//     normalized_weights: Vec<f64>,
//     amounts_in: Vec<f64>,
//     total_supply: f64, // LP total supply
//     swap_fee: f64,
// ) -> Result<f64> {
//     let mut balance_ratios_with_fee = vec![];
//     let mut invariant_ratio_with_fees = 0.0;

//     for j in 0..balances.len() {
//         let balance_ratio_with_fee = balances[j] / (balances[j] - amounts_in[j]);
//         balance_ratios_with_fee.push(balance_ratio_with_fee);
//         invariant_ratio_with_fees = balance_ratio_with_fee * normalized_weights[j] + invariant_ratio_with_fees;
//     }

//     // WeightedMath._computeJoinExactTokensInInvariantRatio
//     let mut invariant_ratio = 1.0;
//     for j in 0..balances.len() {
//         let amount_in_without_fee;
//         let starting_balance = balances[j] - amounts_in[j];

//         if balance_ratios_with_fee[j] > invariant_ratio_with_fees {
//             // invariantRatioWithFees might be less than FixedPoint.ONE in edge scenarios due to rounding error,
//             // particularly if the weights don't exactly add up to 100%.
//             let non_taxable_amount = if invariant_ratio_with_fees > 1.0 {
//                 starting_balance * (invariant_ratio_with_fees - 1.0)
//             } else {
//                 0.0
//             };
//             let swap_fee_amount = (amounts_in[j] - non_taxable_amount) * swap_fee;
//             amount_in_without_fee = amounts_in[j] - swap_fee_amount;
//         } else {
//             amount_in_without_fee = amounts_in[j];

//             // If a token's amount in is not being charged a swap fee then it might be zero (e.g. when joining a
//             // Pool with only a subset of tokens). In this case, `balance_ratio` will equal `FixedPoint.ONE`, and
//             // the `invariantRatio` will not change at all. We therefore skip to the next iteration, avoiding
//             // the costly `powDown` call.
//             if amount_in_without_fee == 0.0 {
//                 continue;
//             }
//         }

//         let balance_ratio = (starting_balance + amount_in_without_fee) / starting_balance;
//         invariant_ratio = balance_ratio.powf(normalized_weights[j]) * invariant_ratio;
//     }

//     if invariant_ratio > 1.0 {
//         Ok(total_supply * (invariant_ratio - 1.0))
//     } else {
//         Ok(0.0)
//     }
// }

// // WeightedMath._calcTokenInGivenExactBptOut (Not used)
// pub fn calc_token_in_exact_out(
//     balance: f64, // starting balance
//     normalized_weight: f64,
//     amount_out: f64,   // minting LP amount
//     total_supply: f64, // LP total supply
//     swap_fee: f64,
// ) -> Result<f64> {
//     /******************************************************************************************
//     // tokenInForExactBPTOut                                                                 //
//     // a = amountIn                                                                          //
//     // b = balance                      /  /    totalBPT + bptOut      \    (1 / w)       \  //
//     // bptOut = bptAmountOut   a = b * |  | --------------------------  | ^          - 1  |  //
//     // bpt = totalBPT                   \  \       totalBPT            /                  /  //
//     // w = weight                                                                            //
//      ******************************************************************************************/
//     // Token in, so we round up overall.

//     // Calculate the factor by which the invariant will increase after minting BPTAmountOut
//     let invariant_ratio = (total_supply + amount_out) / total_supply;
//     require!(invariant_ratio <= MAX_INVARIANT_RATIO, CustomError::MaxInvariantRatio);

//     // Calculate by how much the token balance has to increase to match the invariantRatio
//     let balance_ratio = invariant_ratio.powf(1.0 / normalized_weight);

//     let amount_in_without_fee = balance * (balance_ratio - 1.0);

//     // We can now compute how much extra balance is being deposited and used in virtual swaps, and charge swap fees
//     // accordingly.
//     let taxable_amount = amount_in_without_fee * complement(normalized_weight);
//     let non_taxable_amount = amount_in_without_fee - taxable_amount;

//     let taxable_amount_with_fees = taxable_amount / complement(swap_fee);

//     Ok(non_taxable_amount + taxable_amount_with_fees)
// }

// // WeightedMath._calcTokenOutGivenExactBptIn
// pub fn calc_token_out_exact_in(
//     balance: f64, // starting balance
//     normalized_weight: f64,
//     amount_in: f64,    // burning LP amount
//     total_supply: f64, // LP total supply
//     swap_fee: f64,
// ) -> Result<f64> {
//     /*****************************************************************************************
//     // exactBPTInForTokenOut                                                                //
//     // a = amountOut                                                                        //
//     // b = balance                     /      /    totalBPT - bptIn       \    (1 / w)  \   //
//     // bptIn = bptAmountIn    a = b * |  1 - | --------------------------  | ^           |  //
//     // bpt = totalBPT                  \      \       totalBPT            /             /   //
//     // w = weight                                                                           //
//      *****************************************************************************************/
//     // Token out, so we round down overall. The multiplication rounds down, but the power rounds up (so the base
//     // rounds up). Because (totalBPT - bptIn) / totalBPT <= 1, the exponent rounds down.

//     // Calculate the factor by which the invariant will decrease after burning BPTAmountIn

//     let invariant_ratio = (total_supply - amount_in) / total_supply;
//     require!(invariant_ratio >= MIN_INVARIANT_RATIO, CustomError::MinInvariantRatio);

//     // Calculate by how much the token balance has to decrease to match invariantRatio
//     let balance_ratio = invariant_ratio.powf(1.0 / normalized_weight);

//     // Because of rounding up, balance_ratio can be greater than one. Using complement prevents reverts.
//     let amount_out_without_fee = balance * complement(balance_ratio);

//     // We can now compute how much excess balance is being withdrawn as a result of the virtual swaps, which result
//     // in swap fees.

//     // Swap fees are typically charged on 'token in', but there is no 'token in' here, so we apply it
//     // to 'token out'. This results in slightly larger price impact. Fees are rounded up.
//     let taxable_amount = amount_out_without_fee * complement(normalized_weight);
//     let non_taxable_amount = amount_out_without_fee - taxable_amount;
//     let taxable_amount_minus_fees = taxable_amount * complement(swap_fee);

//     Ok(non_taxable_amount + taxable_amount_minus_fees)
// }

// // BasePoolMath.computeProportionalAmountsOut
// pub fn calc_tokens_out_exact_in(
//     balances: Vec<f64>, // starting balances
//     amount_in: f64,     // burning LP amount
//     total_supply: f64,
// ) -> Result<Vec<f64>> {
//     /**********************************************************************************************
//     // computeProportionalAmountsOut                                                             //
//     // (per token)                                                                               //
//     // aO = tokenAmountOut             /        bptIn         \                                  //
//     // b = tokenBalance      a0 = b * | ---------------------  |                                 //
//     // bptIn = bptAmountIn             \     bptTotalSupply    /                                 //
//     // bpt = bptTotalSupply                                                                      //
//      **********************************************************************************************/
//     // Since we're computing an amount out, we round down overall. This means rounding down on both the
//     // multiplication and division.

//     let ratio = amount_in / total_supply;

//     let mut amounts_out: Vec<f64> = vec![];
//     for j in 0..balances.len() {
//         amounts_out.push(balances[j] * ratio);
//     }

//     Ok(amounts_out)
// }

// fn complement(weight: f64) -> f64 {
//     if weight < 1.0 {
//         1.0 - weight
//     } else {
//         0.0
//     }
// }

// #[cfg(test)]
// mod tests {
//     use super::*;
//     use crate::uint256;

//     #[test]
//     fn test_calc_invariant() {
//         let invariant = calc_invariant(
//             vec![uint256!(4000u16), uint256!(6000u16)],
//             vec![uint256!(100000_000000000u64), uint256!(10000_000000000u64)],
//         )
//         .unwrap();
//         assert_eq!(uint256!(500000000u64), invariant);
//     }
// }
