use crate::error::StableMathError;
use bn::{
    safe_math::{CheckedDivCeil, CheckedMulDiv},
    uint256, U256,
};

pub const AMP_PRECISION: u64 = 1_000;
pub const FEE_PRECISION: u64 = 1_000_000;
pub const INV_PRECISION: u64 = 1_000_000_000;

pub const MIN_AMP: u16 = 1;
pub const MAX_AMP: u16 = 5000;

pub const MIN_STABLE_TOKENS: usize = 2;
pub const MAX_STABLE_TOKENS: usize = 5;

pub fn amp_precision_u256() -> U256 {
    uint256!(AMP_PRECISION)
}

// StableMath._calculateInvariant
// Computes the invariant given the current balances, using the Newton-Raphson approximation.
// The amplification parameter equals: A n^(n-1)
// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-stable/contracts/StableMath.sol#L57-L120
pub fn calc_invariant(amplification: u64, balances: &Vec<u64>) -> Result<u64, StableMathError> {
    // invariant                                                                                 //
    // D = invariant                                                  D^(n+1)                    //
    // A = amplification coefficient      A  n^n S + D = A D n^n + -----------                   //
    // S = sum of balances                                             n^n P                     //
    // P = product of balances                                                                   //
    // n = number of tokens                                                                      //

    // Always round down, to match Vyper's arithmetic (which always truncates).
    let sum: u64 = balances.iter().sum(); // S in the Curve version

    if sum == 0 {
        return Ok(0);
    }

    let num_tokens = balances.len() as u64;
    let amp_times_total = amplification * num_tokens; // Ann in the Curve version

    let sum = uint256!(sum);
    let mut prev_invariant; // Dprev in the Curve version
    let mut invariant = sum; // D in the Curve version

    for _ in 0..255 {
        let mut p = invariant;

        for i in 0..balances.len() {
            // (p * invariant) / (balances[i] * num_tokens)
            p = p
                .checked_mul_div_down(invariant, uint256!(balances[i] * num_tokens))
                .unwrap();
        }

        prev_invariant = invariant;

        invariant = (uint256!(amp_times_total)
            .checked_mul_div_down(sum, amp_precision_u256())
            .unwrap()
            + (p * uint256!(balances.len())))
        .checked_mul_div_down(
            invariant,
            uint256!(amp_times_total - AMP_PRECISION)
                .checked_mul_div_down(invariant, amp_precision_u256())
                .unwrap()
                + (uint256!(num_tokens.saturating_add(1)) * p),
        )
        .unwrap();

        let invariant_u64 = invariant.as_u64();
        let prev_invariant_u64 = prev_invariant.as_u64();

        if invariant_u64 > prev_invariant_u64 {
            if invariant_u64.saturating_sub(prev_invariant_u64) <= 1 {
                return Ok(invariant_u64);
            }
        } else if prev_invariant_u64.saturating_sub(invariant_u64) <= 1 {
            return Ok(invariant.as_u64());
        }
    }

    Err(StableMathError::InvariantDidntConverge)
}

// // Computes how many tokens can be taken out of a pool if `token_amount_in` are sent, given the current balances.
// // The amplification parameter equals: A n^(n-1)
// // See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-stable/contracts/StableMath.sol#L124-L159
pub fn calc_out_given_in(
    amplification: u64,
    balances: &Vec<u64>,
    token_index_in: usize,
    token_index_out: usize,
    token_amount_in: u64,
    invariant: u64,
) -> Result<u64, StableMathError> {
    /**************************************************************************************************************
    // outGivenIn token x for y - polynomial equation to solve                                                   //
    // ay = amount out to calculate                                                                              //
    // by = balance token out                                                                                    //
    // y = by - ay (finalBalanceOut)                                                                             //
    // D = invariant                                               D                     D^(n+1)                 //
    // A = amplification coefficient               y^2 + ( S + ----------  - D) * y -  ------------- = 0         //
    // n = number of tokens                                    (A * n^n)               A * n^2n * P              //
    // S = sum of final balances but y                                                                           //
    // P = product of final balances but y                                                                       //
     **************************************************************************************************************/
    // Amount out, so we round down overall.

    let mut new_balances = vec![];
    for i in 0..balances.len() {
        if i == token_index_in {
            new_balances.push(balances[i] + token_amount_in);
        } else {
            new_balances.push(balances[i]);
        }
    }

    let final_balance_out = get_token_balance_given_invariant_n_all_other_balances(
        amplification,
        &new_balances,
        invariant,
        token_index_out,
    )?;

    let token_amount_out = balances[token_index_out] - final_balance_out - 1;

    Ok(token_amount_out)
}

// // Computes how many tokens must be sent to a pool if `token_amount_out` are sent given the
// // current balances, using the Newton-Raphson approximation.
// // The amplification parameter equals: A n^(n-1)
// // See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-stable/contracts/StableMath.sol#L164-L199
pub fn calc_in_given_out(
    amplification: u64,
    balances: &Vec<u64>,
    token_index_in: usize,
    token_index_out: usize,
    token_amount_out: u64,
    invariant: u64,
) -> Result<u64, StableMathError> {
    /**************************************************************************************************************
    // inGivenOut token x for y - polynomial equation to solve                                                   //
    // ax = amount in to calculate                                                                               //
    // bx = balance token in                                                                                     //
    // x = bx + ax (finalBalanceIn)                                                                              //
    // D = invariant                                                D                     D^(n+1)                //
    // A = amplification coefficient               x^2 + ( S + ----------  - D) * x -  ------------- = 0         //
    // n = number of tokens                                     (A * n^n)               A * n^2n * P             //
    // S = sum of final balances but x                                                                           //
    // P = product of final balances but x                                                                       //
     **************************************************************************************************************/
    // Amount in, so we round up overall.
    let mut new_balances = vec![];
    for i in 0..balances.len() {
        if i == token_index_out {
            new_balances.push(balances[i] - token_amount_out);
        } else {
            new_balances.push(balances[i]);
        }
    }

    let final_balance_in = get_token_balance_given_invariant_n_all_other_balances(
        amplification,
        &new_balances,
        invariant,
        token_index_in,
    )?;

    let token_amount_in = final_balance_in - balances[token_index_in] + 1;

    Ok(token_amount_in)
}

// // See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-stable/contracts/StableMath.sol#L201-L255
pub fn calc_pool_token_out_given_exact_tokens_in(
    amplification: u64,
    balances: &Vec<u64>,
    amounts_in: Vec<u64>,
    pool_token_supply: u64,
    current_invariant: u64,
    swap_fee: u64,
) -> Result<u64, StableMathError> {
    // LP out, so we round down overall.

    // First loop calculates the sum of all token balances, which will be used to calculate
    // the current weights of each token, relative to this sum
    let sum: u64 = balances.iter().sum();

    // Calculate the weighted balance ratio without considering fees
    let mut balance_ratios_with_fee = vec![];
    // The weighted sum of token balance ratios with fee
    let mut invariant_ratio_with_fees = 0;
    for i in 0..balances.len() {
        let current_weight = balances[i].checked_mul_div_down(INV_PRECISION, sum).unwrap();
        balance_ratios_with_fee.push(
            (balances[i] + amounts_in[i])
                .checked_mul_div_down(INV_PRECISION, balances[i])
                .unwrap(),
        );
        invariant_ratio_with_fees = balance_ratios_with_fee[i]
            .checked_mul_div_down(current_weight, INV_PRECISION)
            .unwrap()
            + invariant_ratio_with_fees;
    }

    // Second loop calculates new amounts in, taking into account the fee on the percentage excess
    let mut new_balances = vec![];
    for i in 0..balances.len() {
        let amount_in_without_fee;

        // Check if the balance ratio is greater than the ideal ratio to charge fees or not
        if balance_ratios_with_fee[i] > invariant_ratio_with_fees {
            let non_taxable_amount = balances[i]
                .checked_mul_div_down(invariant_ratio_with_fees - INV_PRECISION, INV_PRECISION)
                .unwrap();
            let taxable_amount = amounts_in[i] - non_taxable_amount;

            amount_in_without_fee = taxable_amount
                .checked_mul_div_down(
                    // No need to use checked arithmetic for the swap fee, it is guaranteed to be lower than 50%
                    FEE_PRECISION.saturating_sub(swap_fee),
                    FEE_PRECISION,
                )
                .unwrap()
                .checked_add(non_taxable_amount)
                .unwrap();
        } else {
            amount_in_without_fee = amounts_in[i];
        }

        new_balances.push(balances[i] + amount_in_without_fee);
    }

    let new_invariant = calc_invariant(amplification, &new_balances)?;
    let invariant_ratio = new_invariant
        .checked_mul_div_down(INV_PRECISION, current_invariant)
        .unwrap();

    // If the invariant didn't increase for any reason, we simply don't mint LP
    if invariant_ratio > INV_PRECISION {
        let amount_out = pool_token_supply
            .checked_mul_div_down(invariant_ratio.saturating_sub(INV_PRECISION), INV_PRECISION)
            .unwrap();
        Ok(amount_out)
    } else {
        Ok(0)
    }
}

// // See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-stable/contracts/StableMath.sol#L354-L395
pub fn calc_token_out_given_exact_pool_token_in(
    amplification: u64,
    balances: &Vec<u64>,
    token_index: usize,
    amount_in: u64,
    pool_token_supply: u64,
    current_invariant: u64,
    swap_fee: u64,
) -> Result<u64, StableMathError> {
    // Token out, so we round down overall.

    let new_invariant = (pool_token_supply - amount_in)
        .checked_mul_div_up(current_invariant, pool_token_supply)
        .unwrap();

    // Calculate amount out without fee
    let new_balance =
        get_token_balance_given_invariant_n_all_other_balances(amplification, &balances, new_invariant, token_index)?;
    let amount_out_without_fee = balances[token_index] - new_balance;

    // First calculate the sum of all token balances, which will be used to calculate
    // the current weight of each token
    let sum: u64 = balances.iter().sum();

    // We can now compute how much excess balance is being withdrawn as a result of the virtual swaps, which result
    // in swap fees.
    let current_weight = balances[token_index].checked_mul_div_down(INV_PRECISION, sum).unwrap();
    let taxable_percentage = INV_PRECISION.saturating_sub(current_weight);

    // Swap fees are typically charged on 'token in', but there is no 'token in' here, so we apply it
    // to 'token out'. This results in slightly larger price impact. Fees are rounded up.
    let taxable_amount = amount_out_without_fee
        .checked_mul_div_up(taxable_percentage, INV_PRECISION)
        .unwrap();
    let non_taxable_amount = amount_out_without_fee.saturating_sub(taxable_amount);

    let amount_out = taxable_amount
        .checked_mul_div_down(
            // No need to use checked arithmetic for the swap fee, it is guaranteed to be lower than 50%
            FEE_PRECISION.saturating_sub(swap_fee),
            FEE_PRECISION,
        )
        .unwrap()
        + non_taxable_amount;

    Ok(amount_out)
}

// This function calculates the balance of a given token (token_index)
// given all the other balances and the invariant
// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-stable/contracts/StableMath.sol#L399-L449
fn get_token_balance_given_invariant_n_all_other_balances(
    amplification: u64,
    balances: &Vec<u64>,
    invariant: u64,
    token_index: usize,
) -> Result<u64, StableMathError> {
    // Rounds result up overall

    let num_tokens = balances.len() as u64;
    let amp_times_total = uint256!(amplification * num_tokens);

    let invariant = uint256!(invariant);

    let mut sum = balances[0];
    let mut p = uint256!(balances[0] * num_tokens);
    for i in 1..balances.len() {
        let p_i = uint256!(balances[i] * num_tokens);
        p = p.checked_mul_div_down(p_i, invariant).unwrap();
        sum = sum + balances[i];
    }
    // No need to use safe math, based on the loop above `sum` is greater than or equal to `balances[token_index]`
    sum = sum.saturating_sub(balances[token_index]);
    let sum = uint256!(sum);

    let invariant_2 = invariant.checked_mul(invariant).unwrap();
    // We remove the balance from c by multiplying it
    let c = invariant_2
        .checked_mul_div_up(amp_precision_u256(), amp_times_total * p)
        .unwrap()
        * uint256!(balances[token_index]);
    let b = invariant
        .checked_mul_div_up(amp_precision_u256(), amp_times_total)
        .unwrap()
        + sum;

    // We iterate to find the balance
    let mut prev_token_balance;
    // We multiply the first iteration outside the loop with the invariant to set the value of the
    // initial approximation.
    let mut token_balance = (invariant_2 + c).checked_div_up(invariant + b).unwrap();

    for _ in 0..255 {
        prev_token_balance = token_balance;

        token_balance = token_balance
            .checked_mul(token_balance)
            .unwrap()
            .checked_add(c)
            .unwrap()
            .checked_div_up(
                // No need to use checked arithmetic because max value of `token_balance` is u128::MAX
                (token_balance << 1) // token_balance * 2
                    .checked_add(b)
                    .unwrap()
                    .checked_sub(invariant)
                    .unwrap(),
            )
            .unwrap();

        let token_balance_u64 = token_balance.as_u64();
        let prev_token_balance_u64 = prev_token_balance.as_u64();

        if token_balance_u64 > prev_token_balance_u64 {
            if token_balance_u64.saturating_sub(prev_token_balance_u64) <= 1 {
                return Ok(token_balance_u64);
            }
        } else if prev_token_balance_u64.saturating_sub(token_balance_u64) <= 1 {
            return Ok(token_balance_u64);
        }
    }

    Err(StableMathError::GetBalanceDidntConverge)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calc_out_given_in() {
        let amplification = 5_000_000;
        let balances = vec![40_000_000_000_000_000_u64, 60_000_000_000_000_000_u64];
        let invariant = calc_invariant(amplification, &balances).unwrap();
        println!("Invariant: {}", invariant);

        let token_amount_in = 100_000_000_000_000_u64;
        let token_a_out = calc_out_given_in(amplification, &balances, 1, 0, token_amount_in, invariant).unwrap();
        let token_b_out = calc_out_given_in(amplification, &balances, 0, 1, token_amount_in, invariant).unwrap();
        println!("A-B out: {}", token_a_out);
        println!("B-A out: {}", token_b_out);

        let amplification = 750_000;
        let balances = vec![
            40_000_000_000_000_000_u64,
            50_000_000_000_000_000_u64,
            60_000_000_000_000_000_u64,
        ];
        let invariant = calc_invariant(amplification, &balances).unwrap();
        println!("Invariant: {}", invariant);

        let amplification = 150_000;
        let balances = vec![
            40_000_000_000_000_000_u64,
            50_000_000_000_000_000_u64,
            60_000_000_000_000_000_u64,
            70_000_000_000_000_000_u64,
        ];
        let invariant = calc_invariant(amplification, &balances).unwrap();
        println!("Invariant: {}", invariant);

        // // snapshot of USDC-USDT
        let amplification = 5_000_000_u64;
        let balances = vec![894_520_800_000_000_u64, 467_581_800_000_000_u64];
        let invariant = calc_invariant(amplification, &balances).unwrap();
        let token_amount_in = 1_000_000_000_000_u64;
        let min_token_amount_out = 999_845_000_000_u64;
        let token_amount_out = calc_out_given_in(amplification, &balances, 0, 1, token_amount_in, invariant).unwrap();
        assert!(token_amount_out > min_token_amount_out);
    }

    #[test]
    fn test_calc_pool_token_out_given_exact_tokens_in() {
        // snapshot of USDC-USDT
        let amplification = 5_000_000_u64;
        let balances = vec![894_520_800_000_000_u64, 467_581_800_000_000_u64];
        let invariant = calc_invariant(amplification, &balances).unwrap();
        let amounts_in = vec![1_000_000_000_000_000_u64, 1_000_000_000_000_000_u64];
        let amount_out = calc_pool_token_out_given_exact_tokens_in(
            amplification,
            &balances,
            amounts_in,
            1_163_354_615_110_000_u64,
            invariant,
            100,
        )
        .unwrap();
        println!("Amount out: {}", amount_out);
    }
}
