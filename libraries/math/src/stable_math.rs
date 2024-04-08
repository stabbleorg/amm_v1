use crate::{bn::*, error::StableMathError, uint256};

pub const MIN_AMP: u16 = 1;
pub const MAX_AMP: u16 = 5000;

pub const AMP_PRECISION: u32 = 1_000;
pub const FEE_PRECISION: u32 = 1_000_000;
pub const INV_PRECISION: u32 = 1_000_000_000;

pub const MIN_STABLE_TOKENS: usize = 2;
pub const MAX_STABLE_TOKENS: usize = 5;

// StableMath._calculateInvariant
// Computes the invariant given the current balances, using the Newton-Raphson approximation.
// The amplification parameter equals: A n^(n-1)
// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-stable/contracts/StableMath.sol#L57-L120
pub fn calc_invariant(amplification: U256, balances: Vec<U256>) -> Result<U256, StableMathError> {
    // invariant                                                                                 //
    // D = invariant                                                  D^(n+1)                    //
    // A = amplification coefficient      A  n^n S + D = A D n^n + -----------                   //
    // S = sum of balances                                             n^n P                     //
    // P = product of balances                                                                   //
    // n = number of tokens                                                                      //

    // Always round down, to match Vyper's arithmetic (which always truncates).
    let mut sum = balances[0]; // S in the Curve version
    for i in 1..balances.len() {
        sum = sum.checked_add(balances[i]).unwrap();
    }

    if sum == U256::zero() {
        return Ok(U256::zero());
    }

    let mut prev_invariant; // Dprev in the Curve version
    let mut invariant = sum; // D in the Curve version
    let num_tokens = uint256!(balances.len());
    let amp_times_total = amplification.checked_mul(num_tokens).unwrap(); // Ann in the Curve version
    let amp_precision = uint256!(AMP_PRECISION);

    for _ in 0..255 {
        let mut p = invariant;

        for i in 0..balances.len() {
            // (p * invariant) / (balances[i] * num_tokens)
            p = p
                .mul_div_down(invariant, balances[i].checked_mul(num_tokens).unwrap())
                .unwrap();
        }

        prev_invariant = invariant;

        invariant = amp_times_total
            .mul_div_down(sum, amp_precision)
            .unwrap()
            .checked_add(p.checked_mul(num_tokens).unwrap())
            .unwrap()
            .checked_mul(invariant)
            .unwrap()
            .div_down(
                amp_times_total
                    .checked_sub(amp_precision)
                    .unwrap()
                    .mul_div_down(invariant, amp_precision)
                    .unwrap()
                    .checked_add(num_tokens.checked_add(U256::one()).unwrap().checked_mul(p).unwrap())
                    .unwrap(),
            )
            .unwrap();

        if invariant > prev_invariant {
            if invariant.checked_sub(prev_invariant).unwrap() <= U256::one() {
                return Ok(invariant);
            }
        } else if prev_invariant.checked_sub(invariant).unwrap() <= U256::one() {
            return Ok(invariant);
        }
    }

    Err(StableMathError::InvariantDidntConverge)
}

// Computes how many tokens can be taken out of a pool if `token_amount_in` are sent, given the current balances.
// The amplification parameter equals: A n^(n-1)
// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-stable/contracts/StableMath.sol#L124-L159
pub fn calc_out_given_in(
    amplification: U256,
    balances: Vec<U256>,
    token_index_in: usize,
    token_index_out: usize,
    token_amount_in: U256,
    invariant: U256,
) -> Result<U256, StableMathError> {
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
        new_balances.clone(),
        invariant,
        token_index_out,
    )?;

    let token_amount_out = balances[token_index_out]
        .checked_sub(final_balance_out)
        .unwrap()
        .checked_sub(U256::one())
        .unwrap();

    Ok(token_amount_out)
}

// Computes how many tokens must be sent to a pool if `token_amount_out` are sent given the
// current balances, using the Newton-Raphson approximation.
// The amplification parameter equals: A n^(n-1)
// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-stable/contracts/StableMath.sol#L164-L199
pub fn calc_in_given_out(
    amplification: U256,
    balances: Vec<U256>,
    token_index_in: usize,
    token_index_out: usize,
    token_amount_out: U256,
    invariant: U256,
) -> Result<U256, StableMathError> {
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
        new_balances.clone(),
        invariant,
        token_index_in,
    )?;

    let token_amount_in = final_balance_in
        .checked_sub(balances[token_index_in])
        .unwrap()
        .checked_add(U256::one())
        .unwrap();

    Ok(token_amount_in)
}

// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-stable/contracts/StableMath.sol#L201-L255
pub fn calc_pool_token_out_given_exact_tokens_in(
    amplification: U256,
    balances: Vec<U256>,
    amounts_in: Vec<U256>,
    pool_token_supply: U256,
    current_invariant: U256,
    swap_fee: U256,
) -> Result<U256, StableMathError> {
    // LP out, so we round down overall.
    let inv_precision = uint256!(INV_PRECISION);
    let fee_precision = uint256!(FEE_PRECISION);

    // First loop calculates the sum of all token balances, which will be used to calculate
    // the current weights of each token, relative to this sum
    let mut sum_balances = balances[0];
    for i in 1..balances.len() {
        sum_balances = sum_balances.checked_add(balances[i]).unwrap();
    }

    // Calculate the weighted balance ratio without considering fees
    let mut balance_ratios_with_fee = vec![];
    // The weighted sum of token balance ratios with fee
    let mut invariant_ratio_with_fees = U256::zero();
    for i in 0..balances.len() {
        let current_weight = balances[i].mul_div_down(inv_precision, sum_balances).unwrap();
        balance_ratios_with_fee.push(
            balances[i]
                .checked_add(amounts_in[i])
                .unwrap()
                .mul_div_down(inv_precision, balances[i])
                .unwrap(),
        );
        invariant_ratio_with_fees = balance_ratios_with_fee[i]
            .mul_div_down(current_weight, inv_precision)
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
                .mul_div_down(
                    invariant_ratio_with_fees.checked_sub(inv_precision).unwrap(),
                    inv_precision,
                )
                .unwrap();
            let taxable_amount = amounts_in[i].checked_sub(non_taxable_amount).unwrap();
            // No need to use checked arithmetic for the swap fee, it is guaranteed to be lower than 50%
            amount_in_without_fee = taxable_amount
                .mul_div_down(fee_precision.saturating_sub(swap_fee), fee_precision)
                .unwrap()
                .checked_add(non_taxable_amount)
                .unwrap();
        } else {
            amount_in_without_fee = amounts_in[i];
        }

        new_balances.push(balances[i].checked_add(amount_in_without_fee).unwrap());
    }

    let new_invariant = calc_invariant(amplification, new_balances)?;
    let invariant_ratio = new_invariant.mul_div_down(inv_precision, current_invariant).unwrap();

    // If the invariant didn't increase for any reason, we simply don't mint LP
    if invariant_ratio > inv_precision {
        let amount_out = pool_token_supply
            .mul_div_down(invariant_ratio.saturating_sub(inv_precision), inv_precision)
            .unwrap();
        Ok(amount_out)
    } else {
        Ok(U256::zero())
    }
}

// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-stable/contracts/StableMath.sol#L354-L395
pub fn calc_token_out_given_exact_pool_token_in(
    amplification: U256,
    balances: Vec<U256>,
    token_index: usize,
    amount_in: U256,
    pool_token_supply: U256,
    current_invariant: U256,
    swap_fee: U256,
) -> Result<U256, StableMathError> {
    // Token out, so we round down overall.
    let inv_precision = uint256!(INV_PRECISION);
    let fee_precision = uint256!(FEE_PRECISION);

    let new_invariant = pool_token_supply
        .checked_sub(amount_in)
        .unwrap()
        .mul_div_up(current_invariant, pool_token_supply)
        .unwrap();

    // Calculate amount out without fee
    let new_balance = get_token_balance_given_invariant_n_all_other_balances(
        amplification,
        balances.clone(),
        new_invariant,
        token_index,
    )?;
    let amount_out_without_fee = balances[token_index].checked_sub(new_balance).unwrap();

    // First calculate the sum of all token balances, which will be used to calculate
    // the current weight of each token
    let mut sum_balances = balances[0];
    for i in 1..balances.len() {
        sum_balances = sum_balances.checked_add(balances[i]).unwrap();
    }

    // We can now compute how much excess balance is being withdrawn as a result of the virtual swaps, which result
    // in swap fees.
    let current_weight = balances[token_index].mul_div_down(inv_precision, sum_balances).unwrap();
    let taxable_percentage = inv_precision.saturating_sub(current_weight);

    // Swap fees are typically charged on 'token in', but there is no 'token in' here, so we apply it
    // to 'token out'. This results in slightly larger price impact. Fees are rounded up.
    let taxable_amount = amount_out_without_fee
        .mul_div_up(taxable_percentage, inv_precision)
        .unwrap();
    let non_taxable_amount = amount_out_without_fee.checked_sub(taxable_amount).unwrap();

    // No need to use checked arithmetic for the swap fee, it is guaranteed to be lower than 50%
    let amount_out = taxable_amount
        .mul_div_down(fee_precision.saturating_sub(swap_fee), fee_precision)
        .unwrap()
        .checked_add(non_taxable_amount)
        .unwrap();
    Ok(amount_out)
}

// This function calculates the balance of a given token (token_index)
// given all the other balances and the invariant
// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-stable/contracts/StableMath.sol#L399-L449
fn get_token_balance_given_invariant_n_all_other_balances(
    amplification: U256,
    balances: Vec<U256>,
    invariant: U256,
    token_index: usize,
) -> Result<U256, StableMathError> {
    // Rounds result up overall
    let amp_precision = uint256!(AMP_PRECISION);

    let num_tokens = uint256!(balances.len());
    let amp_times_total = amplification.checked_mul(num_tokens).unwrap();
    let mut sum = balances[0];
    let mut p = balances[0].checked_mul(num_tokens).unwrap();
    for i in 1..balances.len() {
        let p_i = balances[i].checked_mul(num_tokens).unwrap();
        p = p.mul_div_down(p_i, invariant).unwrap();
        sum = sum.checked_add(balances[i]).unwrap();
    }
    // No need to use safe math, based on the loop above `sum` is greater than or equal to `balances[token_index]`
    sum = sum.saturating_sub(balances[token_index]);

    let invariant_2 = invariant.checked_mul(invariant).unwrap();
    // We remove the balance from c by multiplying it
    let c = invariant_2
        .mul_div_up(amp_precision, amp_times_total.checked_mul(p).unwrap())
        .unwrap()
        .checked_mul(balances[token_index])
        .unwrap();
    let b = invariant
        .mul_div_up(amp_precision, amp_times_total)
        .unwrap()
        .checked_add(sum)
        .unwrap();

    // We iterate to find the balance
    let mut prev_token_balance;
    // We multiply the first iteration outside the loop with the invariant to set the value of the
    // initial approximation.
    let mut token_balance = invariant_2
        .checked_add(c)
        .unwrap()
        .div_up(invariant.checked_add(b).unwrap())
        .unwrap();

    for _ in 0..255 {
        prev_token_balance = token_balance;

        token_balance = token_balance
            .checked_mul(token_balance)
            .unwrap()
            .checked_add(c)
            .unwrap()
            .div_up(
                token_balance
                    .checked_mul(uint256!(2))
                    .unwrap()
                    .checked_add(b)
                    .unwrap()
                    .checked_sub(invariant)
                    .unwrap(),
            )
            .unwrap();

        if token_balance > prev_token_balance {
            if token_balance.checked_sub(prev_token_balance).unwrap() <= U256::one() {
                return Ok(token_balance);
            }
        } else if prev_token_balance.checked_sub(token_balance).unwrap() <= U256::one() {
            return Ok(token_balance);
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
        let amplification = uint256!(5000000);
        let balances = vec![uint256!(894520800000000_u64), uint256!(467581800000000_u64)];
        let invariant = calc_invariant(amplification, balances.clone()).unwrap();
        let token_amount_in = uint256!(1000000000000_u64);
        let min_token_amount_out = uint256!(999845000000_u64);
        let token_amount_out = calc_out_given_in(amplification, balances, 0, 1, token_amount_in, invariant).unwrap();

        assert!(token_amount_out > min_token_amount_out);
    }

    #[test]
    fn test_calc_in_given_out() {
        // snapshot of DAI-USDC
        let amplification = uint256!(750000);
        let balances = vec![uint256!(117169800000000_u64), uint256!(64670620000000_u64)];
        let invariant = calc_invariant(amplification, balances.clone()).unwrap();
        let max_token_amount_in = uint256!(1001000000000_u64);
        let token_amount_out = uint256!(1000000000000_u64);
        let token_amount_in = calc_in_given_out(amplification, balances, 0, 1, token_amount_out, invariant).unwrap();

        assert!(token_amount_in < max_token_amount_in);
    }

    #[test]
    fn test_calc_pool_token_out_given_exact_tokens_in() {
        // snapshot of USDC-USDT
        let amplification = uint256!(5000000);
        let balances = vec![uint256!(894520800000000_u64), uint256!(467581800000000_u64)];
        let invariant = calc_invariant(amplification, balances.clone()).unwrap();
        let amounts_in = vec![uint256!(1000000000000_u64), uint256!(1000000000000_u64)];
        let amount_out = calc_pool_token_out_given_exact_tokens_in(
            amplification,
            balances,
            amounts_in,
            uint256!(1163354615110000_u64),
            invariant,
            uint256!(100),
        )
        .unwrap();

        assert!(amount_out > U256::zero());
    }
}
