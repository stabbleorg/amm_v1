use crate::error::StableMathError;
use bn::{ext::MulDiv, uint128, U128};

pub const AMP_PRECISION: u64 = 1_000;
pub const FEE_PRECISION: u64 = 1_000_000;
pub const INV_PRECISION: u64 = 1_000_000_000;

pub const MIN_AMP: u16 = 1;
pub const MAX_AMP: u16 = 5000;

pub const MIN_STABLE_TOKENS: usize = 2;
pub const MAX_STABLE_TOKENS: usize = 5;

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

    let mut prev_invariant; // Dprev in the Curve version
    let mut invariant = sum; // D in the Curve version
    let num_tokens = balances.len() as u64;
    let amp_times_total = amplification.checked_mul(num_tokens).unwrap(); // Ann in the Curve version

    for _ in 0..255 {
        let mut p = invariant;

        for i in 0..balances.len() {
            // (p * invariant) / (balances[i] * num_tokens)
            p = p
                .checked_mul_div_down(invariant, balances[i])
                .unwrap()
                .checked_div_down(num_tokens)
                .unwrap();
        }

        prev_invariant = invariant;

        invariant = amp_times_total
            .checked_mul_div_down(sum, AMP_PRECISION)
            .unwrap()
            .checked_add(p.checked_mul(num_tokens).unwrap())
            .unwrap()
            .checked_mul_div_down(
                invariant,
                amp_times_total
                    .checked_sub(AMP_PRECISION)
                    .unwrap()
                    .checked_mul_div_down(invariant, AMP_PRECISION)
                    .unwrap()
                    .checked_add(num_tokens.saturating_add(1).checked_mul(p).unwrap())
                    .unwrap(),
            )
            .unwrap();

        if invariant > prev_invariant {
            if invariant.saturating_sub(prev_invariant) <= 1 {
                return Ok(invariant);
            }
        } else if prev_invariant.saturating_sub(invariant) <= 1 {
            return Ok(invariant);
        }
    }

    Err(StableMathError::InvariantDidntConverge)
}

// Computes how many tokens can be taken out of a pool if `token_amount_in` are sent, given the current balances.
// The amplification parameter equals: A n^(n-1)
// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-stable/contracts/StableMath.sol#L124-L159
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
            new_balances.push(balances[i].checked_add(token_amount_in).unwrap());
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

    let token_amount_out = balances[token_index_out]
        .checked_sub(final_balance_out)
        .unwrap()
        .checked_sub(1)
        .unwrap();

    Ok(token_amount_out)
}

// Computes how many tokens must be sent to a pool if `token_amount_out` are sent given the
// current balances, using the Newton-Raphson approximation.
// The amplification parameter equals: A n^(n-1)
// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-stable/contracts/StableMath.sol#L164-L199
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
            new_balances.push(balances[i].checked_sub(token_amount_out).unwrap());
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

    let token_amount_in = final_balance_in
        .checked_sub(balances[token_index_in])
        .unwrap()
        .checked_add(1)
        .unwrap();

    Ok(token_amount_in)
}

// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-stable/contracts/StableMath.sol#L201-L255
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
            balances[i]
                .checked_add(amounts_in[i])
                .unwrap()
                .checked_mul_div_down(INV_PRECISION, balances[i])
                .unwrap(),
        );
        invariant_ratio_with_fees = balance_ratios_with_fee[i]
            .checked_mul_div_down(current_weight, INV_PRECISION)
            .unwrap()
            .checked_add(invariant_ratio_with_fees)
            .unwrap();
    }

    // Second loop calculates new amounts in, taking into account the fee on the percentage excess
    let mut new_balances = vec![];
    for i in 0..balances.len() {
        let amount_in_without_fee;

        // Check if the balance ratio is greater than the ideal ratio to charge fees or not
        if balance_ratios_with_fee[i] > invariant_ratio_with_fees {
            let non_taxable_amount = balances[i]
                .checked_mul_div_down(
                    invariant_ratio_with_fees.checked_sub(INV_PRECISION).unwrap(),
                    INV_PRECISION,
                )
                .unwrap();
            let taxable_amount = amounts_in[i].checked_sub(non_taxable_amount).unwrap();

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

        new_balances.push(balances[i].checked_add(amount_in_without_fee).unwrap());
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

// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-stable/contracts/StableMath.sol#L354-L395
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

    let new_invariant = pool_token_supply
        .checked_sub(amount_in)
        .unwrap()
        .checked_mul_div_up(current_invariant, pool_token_supply)
        .unwrap();

    // Calculate amount out without fee
    let new_balance =
        get_token_balance_given_invariant_n_all_other_balances(amplification, &balances, new_invariant, token_index)?;
    let amount_out_without_fee = balances[token_index].checked_sub(new_balance).unwrap();

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
    let non_taxable_amount = amount_out_without_fee.checked_sub(taxable_amount).unwrap();

    let amount_out = taxable_amount
        .checked_mul_div_down(
            // No need to use checked arithmetic for the swap fee, it is guaranteed to be lower than 50%
            FEE_PRECISION.saturating_sub(swap_fee),
            FEE_PRECISION,
        )
        .unwrap()
        .checked_add(non_taxable_amount)
        .unwrap();

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

    let invariant = uint128!(invariant);
    let num_tokens = uint128!(balances.len());
    let amp_times_total = uint128!(amplification).checked_mul(num_tokens).unwrap();
    let amp_precision = uint128!(AMP_PRECISION);

    let balance_0 = uint128!(balances[0]);
    let mut sum = balance_0;
    let mut p = balance_0.checked_mul(num_tokens).unwrap();
    for i in 1..balances.len() {
        let balance_i = uint128!(balances[i]);
        p = p
            .checked_mul_div_down(balance_i.checked_mul(num_tokens).unwrap(), invariant)
            .unwrap();
        sum = sum.checked_add(balance_i).unwrap();
    }
    // No need to use safe math, based on the loop above `sum` is greater than or equal to `balances[token_index]`
    sum = sum.saturating_sub(uint128!(balances[token_index]));

    let invariant_2 = invariant.checked_mul(invariant).unwrap();
    // We remove the balance from c by multiplying it
    let c = invariant_2
        .checked_mul_div_up(amp_precision, amp_times_total.checked_mul(uint128!(p)).unwrap())
        .unwrap()
        .checked_mul(uint128!(balances[token_index]))
        .unwrap();
    let b = invariant
        .checked_mul_div_up(amp_precision, amp_times_total)
        .unwrap()
        .checked_add(uint128!(sum))
        .unwrap();

    // We iterate to find the balance
    let mut prev_token_balance;
    // We multiply the first iteration outside the loop with the invariant to set the value of the
    // initial approximation.
    let mut token_balance = invariant_2
        .checked_add(c)
        .unwrap()
        .checked_div_up(invariant.checked_add(b).unwrap())
        .unwrap();

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

        if token_balance > prev_token_balance {
            if token_balance.saturating_sub(prev_token_balance) <= U128::one() {
                return Ok(token_balance.as_u64());
            }
        } else if prev_token_balance.saturating_sub(token_balance) <= U128::one() {
            return Ok(token_balance.as_u64());
        }
    }

    Err(StableMathError::GetBalanceDidntConverge)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calc_out_given_in() {
        // snapshot of USDC-USDT
        let amplification = 5_000_000;
        let balances = vec![2_000_000_000_000_000, 3_000_000_000_000_000];
        let invariant = calc_invariant(amplification, &balances).unwrap();

        println!("Invariant: {}", invariant);

        // let token_amount_in = 1_000_000_000_000;
        // let token_amount_out = calc_out_given_in(amplification, &balances, 0, 1, token_amount_in, invariant).unwrap();

        // println!("Swap Token Out: {}", token_amount_out);

        // let amounts_in = vec![1_000_000_000_000, 1_000_000_000_000];
        // let amount_out =
        //     calc_pool_token_out_given_exact_tokens_in(amplification, &balances, amounts_in, invariant, invariant, 100)
        //         .unwrap();

        // println!("LP Out: {}", amount_out);

        // calc_token_out_given_exact_pool_token_in(amplification, &balances, 0, amount_out, amount_out, invariant, 100)
        //     .unwrap();
    }

    #[test]
    fn test_calc_in_given_out() {
        // snapshot of DAI-USDC
        let amplification = 750_000;
        let balances = vec![117_169_800_000_000, 64_670_620_000_000_u64];
        let invariant = calc_invariant(amplification, &balances).unwrap();

        println!("Invariant: {}", invariant);

        let token_amount_out = 1_000_000_000_000;
        let token_amount_in = calc_in_given_out(amplification, &balances, 0, 1, token_amount_out, invariant).unwrap();

        println!("Swap Token In: {}", token_amount_in);
    }
}
