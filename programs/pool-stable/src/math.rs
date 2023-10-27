use crate::error::*;
use anchor_lang::prelude::*;

pub const BALANCE_PRECISION: u128 = 1_000_000_000;
pub const AMP_PRECISION: u128 = 1_000;
pub const FEE_PRECISION: u128 = 10_000;

// StableMath._calculateInvariant
// Computes the invariant given the current balances, using the Newton-Raphson approximation.
// The amplification parameter equals: A n^(n-1)
// See: https://github.com/curvefi/curve-contract/blob/b0bbf77f8f93c9c5f4e415bce9cd71f0cdee960e/contracts/pool-templates/base/SwapTemplateBase.vy#L206
// solhint-disable-previous-line max-line-length
pub fn calc_invariant(amp: u128, balances: Vec<u128>) -> Result<u128> {
    // invariant                                                                                 //
    // D = invariant                                                  D^(n+1)                    //
    // A = amplification coefficient      A  n^n S + D = A D n^n + -----------                   //
    // S = sum of balances                                             n^n P                     //
    // P = product of balances                                                                   //
    // n = number of tokens                                                                      //

    // Always round down, to match Vyper's arithmetic (which always truncates).
    let sum: u128 = balances.iter().sum(); // S in the Curve version
    let num_tokens = balances.len() as u128;

    if sum == 0 {
        return Ok(0);
    }

    let mut prev_invariant; // Dprev in the Curve version
    let mut invariant = sum; // D in the Curve version
    let amp_times_total = amp.checked_mul(num_tokens).unwrap(); // Ann in the Curve version

    for _ in 0..255 {
        let mut p = invariant;

        for j in 0..balances.len() {
            // (p * invariant) / (balances[j] * num_tokens)
            p = p
                .checked_mul(invariant)
                .unwrap()
                .checked_div(balances[j].checked_mul(num_tokens).unwrap())
                .unwrap();
        }

        prev_invariant = invariant;

        invariant = amp_times_total
            .checked_mul(sum)
            .unwrap()
            .checked_add(p.checked_mul(num_tokens).unwrap())
            .unwrap()
            .checked_mul(invariant)
            .unwrap()
            .checked_div(
                amp_times_total
                    .checked_sub(1)
                    .unwrap()
                    .checked_mul(invariant)
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

    err!(PoolStableError::GetInvariantDidntConverge)
}

// StableMath._calcOutGivenIn
// Computes how many tokens can be taken out of a pool if `tokenAmountIn` are sent, given the current balances.
// The amplification parameter equals: A n^(n-1)
pub fn calc_out_given_in(
    amp: u128,
    balances: &mut Vec<u128>,
    token_index_in: usize,
    token_index_out: usize,
    token_amount_in: u128,
    invariant: u128,
) -> Result<u128> {
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
    balances[token_index_in] = balances[token_index_in].checked_add(token_amount_in).unwrap();

    let final_balance_out =
        get_token_balance_given_invariant_and_all_other_balances(amp, balances.clone(), invariant, token_index_out)?;

    Ok(balances[token_index_out]
        .checked_sub(final_balance_out)
        .unwrap()
        .saturating_sub(1))
}

// StableMath._calcInGivenOut (Not used)
// Computes how many tokens must be sent to a pool if `tokenAmountOut` are sent given the
// current balances, using the Newton-Raphson approximation.
// The amplification parameter equals: A n^(n-1)
pub fn calc_in_given_out(
    amp: u128,
    balances: &mut Vec<u128>,
    token_index_in: usize,
    token_index_out: usize,
    token_amount_out: u128,
    invariant: u128,
) -> Result<u128> {
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
    balances[token_index_out] = balances[token_index_out].checked_sub(token_amount_out).unwrap();

    let final_balance_in =
        get_token_balance_given_invariant_and_all_other_balances(amp, balances.clone(), invariant, token_index_in)?;

    Ok(final_balance_in
        .checked_sub(balances[token_index_in])
        .unwrap()
        .checked_add(1)
        .unwrap())
}

// StableMath._calcBptOutGivenExactTokensIn
pub fn calc_out_exact_tokens_in(
    amp: u128,
    balances: Vec<u128>,
    amounts_in: Vec<u128>,
    total_supply: u128, // LP total supply
    current_invariant: u128,
    swap_fee: u128,
) -> Result<u128> {
    // BPT out, so we round down overall.

    // First loop calculates the sum of all token balances, which will be used to calculate
    // the current weights of each token, relative to this sum
    let sum_balances: u128 = balances.iter().sum();

    // Calculate the weighted balance ratio without considering fees
    let mut balance_ratios_with_fee = vec![];
    // The weighted sum of token balance ratios with fee
    let mut invariant_ratio_with_fees: u128 = 0;
    for j in 0..balances.len() {
        let current_weight = balances[j]
            .checked_mul(BALANCE_PRECISION)
            .unwrap()
            .checked_div(sum_balances)
            .unwrap();
        balance_ratios_with_fee.push(
            balances[j]
                .checked_add(amounts_in[j])
                .unwrap()
                .checked_mul(BALANCE_PRECISION)
                .unwrap()
                .checked_div(balances[j])
                .unwrap(),
        );
        invariant_ratio_with_fees = balance_ratios_with_fee[j]
            .checked_mul(current_weight)
            .unwrap()
            .checked_div(BALANCE_PRECISION)
            .unwrap()
            .checked_add(invariant_ratio_with_fees)
            .unwrap();
    }

    // Second loop calculates new amounts in, taking into account the fee on the percentage excess
    let mut new_balances = vec![];
    for j in 0..balances.len() {
        let amount_in_without_fee;

        // Check if the balance ratio is greater than the ideal ratio to charge fees or not
        if balance_ratios_with_fee[j] > invariant_ratio_with_fees {
            let non_taxable_amount = balances[j]
                .checked_mul(invariant_ratio_with_fees.checked_sub(BALANCE_PRECISION).unwrap())
                .unwrap()
                .checked_div(BALANCE_PRECISION)
                .unwrap();
            let taxable_amount = amounts_in[j].checked_sub(non_taxable_amount).unwrap();
            // No need to use checked arithmetic for the swap fee, it is guaranteed to be lower than 50%
            amount_in_without_fee = taxable_amount
                .checked_mul(FEE_PRECISION.saturating_sub(swap_fee))
                .unwrap()
                .checked_div(FEE_PRECISION)
                .unwrap()
                .checked_add(non_taxable_amount)
                .unwrap();
        } else {
            amount_in_without_fee = amounts_in[j];
        }

        new_balances.push(balances[j].checked_add(amount_in_without_fee).unwrap());
    }

    let new_invariant = calc_invariant(amp, new_balances)?;
    let invariant_ratio = new_invariant
        .checked_mul(BALANCE_PRECISION)
        .unwrap()
        .checked_div(current_invariant)
        .unwrap();

    // If the invariant didn't increase for any reason, we simply don't mint BPT
    if invariant_ratio > BALANCE_PRECISION {
        Ok(total_supply
            .checked_mul(invariant_ratio.saturating_sub(BALANCE_PRECISION))
            .unwrap()
            .checked_div(BALANCE_PRECISION)
            .unwrap())
    } else {
        Ok(0)
    }
}

// StableMath._calcTokenInGivenExactBptOut (Not used)
pub fn calc_token_in_exact_out(
    amp: u128,
    balances: Vec<u128>,
    token_index: usize,
    amount_out: u128,
    total_supply: u128,
    current_invariant: u128,
    swap_fee: u128,
) -> Result<u128> {
    // Token in, so we round up overall.

    let new_invariant = total_supply
        .checked_add(amount_out)
        .unwrap()
        .checked_mul(current_invariant)
        .unwrap()
        .checked_div(total_supply)
        .unwrap()
        // divUp
        .saturating_add(1);

    // Calculate amount in without fee.
    let new_balance =
        get_token_balance_given_invariant_and_all_other_balances(amp, balances.clone(), new_invariant, token_index)?;
    let amount_in_without_fee = new_balance.checked_sub(balances[token_index]).unwrap();

    // First calculate the sum of all token balances, which will be used to calculate
    // the current weight of each token
    let sum_balances = balances.iter().sum();

    // We can now compute how much extra balance is being deposited and used in virtual swaps, and charge swap fees
    // accordingly.
    let current_weight = balances[token_index]
        .checked_mul(BALANCE_PRECISION)
        .unwrap()
        .checked_div(sum_balances)
        .unwrap();
    let taxable_percentage = complement(current_weight);
    let taxable_amount = amount_in_without_fee
        .checked_mul(taxable_percentage)
        .unwrap()
        .checked_div(BALANCE_PRECISION)
        .unwrap();
    let non_taxable_amount = amount_in_without_fee.checked_sub(taxable_amount).unwrap();

    // No need to use checked arithmetic for the swap fee, it is guaranteed to be lower than 50%
    Ok(taxable_amount
        .checked_mul(FEE_PRECISION.saturating_sub(swap_fee))
        .unwrap()
        .checked_div(FEE_PRECISION)
        .unwrap()
        // divUp
        .saturating_add(1)
        .checked_add(non_taxable_amount)
        .unwrap())
}

// StableMath._calcBptInGivenExactTokensOut (Not used)
pub fn calc_in_exact_tokens_out(
    amp: u128,
    balances: Vec<u128>,
    amounts_out: Vec<u128>,
    total_supply: u128,
    current_invariant: u128,
    swap_fee: u128,
) -> Result<u128> {
    // BPT in, so we round up overall.

    // First loop calculates the sum of all token balances, which will be used to calculate
    // the current weights of each token relative to this sum
    let sum_balances = balances.iter().sum();

    // Calculate the weighted balance ratio without considering fees
    let mut balance_ratios_without_fee = vec![];
    let mut balance_ratio_without_fees = 0;
    for i in 0..balances.len() {
        let current_weight = balances[i]
            .checked_mul(BALANCE_PRECISION)
            .unwrap()
            .checked_div(sum_balances)
            .unwrap()
            // divUp
            .saturating_add(1);
        balance_ratios_without_fee[i] = balances[i]
            .checked_sub(amounts_out[i])
            .unwrap()
            .checked_mul(BALANCE_PRECISION)
            .unwrap()
            .checked_div(balances[i])
            .unwrap()
            // divUp
            .saturating_add(1);
        balance_ratio_without_fees = balance_ratios_without_fee[i]
            .checked_mul(current_weight)
            .unwrap()
            .checked_div(BALANCE_PRECISION)
            .unwrap()
            .checked_add(balance_ratio_without_fees)
            .unwrap();
    }

    // Second loop calculates new amounts in, taking into account the fee on the percentage excess
    let mut new_balances = vec![];
    for i in 0..balances.len() {
        // Swap fees are typically charged on 'token in', but there is no 'token in' here, so we apply it to
        // 'token out'. This results in slightly larger price impact.

        let amount_out_with_fee = if balance_ratio_without_fees > balance_ratios_without_fee[i] {
            let non_taxable_amount = balances[i]
                .checked_mul(complement(balance_ratio_without_fees))
                .unwrap()
                .checked_div(BALANCE_PRECISION)
                .unwrap();
            let taxable_amount = amounts_out[i].checked_sub(non_taxable_amount).unwrap();
            // No need to use checked arithmetic for the swap fee, it is guaranteed to be lower than 50%
            taxable_amount
                .checked_mul(FEE_PRECISION.saturating_sub(swap_fee))
                .unwrap()
                .checked_div(FEE_PRECISION)
                .unwrap()
                // divUp
                .saturating_add(1)
                .checked_add(non_taxable_amount)
                .unwrap()
        } else {
            amounts_out[i]
        };

        new_balances[i] = balances[i].checked_sub(amount_out_with_fee).unwrap();
    }

    let new_invariant = calc_invariant(amp, new_balances)?;
    let invariant_ratio = new_invariant
        .checked_mul(BALANCE_PRECISION)
        .unwrap()
        .checked_div(current_invariant)
        .unwrap();

    // return amountBPTIn
    return Ok(total_supply
        .checked_mul(complement(invariant_ratio))
        .unwrap()
        .checked_div(BALANCE_PRECISION)
        .unwrap());
}

// StableMath._calcTokenOutGivenExactBptIn
pub fn calc_token_out_exact_in(
    amp: u128,
    balances: Vec<u128>,
    token_index: usize,
    amount_in: u128,    // burning LP amount
    total_supply: u128, // LP total supply
    current_invariant: u128,
    swap_fee: u128,
) -> Result<u128> {
    // Token out, so we round down overall.

    let new_invariant = total_supply
        .checked_sub(amount_in)
        .unwrap()
        .checked_mul(current_invariant)
        .unwrap()
        .checked_div(total_supply)
        .unwrap()
        // divUp
        .saturating_add(1);

    // Calculate amount out without fee
    let new_balance =
        get_token_balance_given_invariant_and_all_other_balances(amp, balances.clone(), new_invariant, token_index)?;
    let amount_out_without_fee = balances[token_index].checked_sub(new_balance).unwrap();

    // First calculate the sum of all token balances, which will be used to calculate
    // the current weight of each token
    let sum_balances = balances.iter().sum();

    // We can now compute how much excess balance is being withdrawn as a result of the virtual swaps, which result
    // in swap fees.
    let current_weight = balances[token_index]
        .checked_mul(BALANCE_PRECISION)
        .unwrap()
        .checked_div(sum_balances)
        .unwrap();
    let taxable_percentage = complement(current_weight);

    // Swap fees are typically charged on 'token in', but there is no 'token in' here, so we apply it
    // to 'token out'. This results in slightly larger price impact. Fees are rounded up.
    let taxable_amount = amount_out_without_fee
        .checked_mul(taxable_percentage)
        .unwrap()
        .checked_div(BALANCE_PRECISION)
        .unwrap();
    let non_taxable_amount = amount_out_without_fee.checked_sub(taxable_amount).unwrap();

    // No need to use checked arithmetic for the swap fee, it is guaranteed to be lower than 50%
    return Ok(taxable_amount
        .checked_mul(FEE_PRECISION.saturating_sub(swap_fee))
        .unwrap()
        .checked_div(FEE_PRECISION)
        .unwrap()
        .checked_add(non_taxable_amount)
        .unwrap());
}

// BasePoolMath.computeProportionalAmountsOut
pub fn calc_tokens_out_exact_in(
    balances: Vec<u128>,
    amount_in: u128,    // burning LP amount
    total_supply: u128, // LP total supply
) -> Result<Vec<u128>> {
    /**********************************************************************************************
    // computeProportionalAmountsOut                                                             //
    // (per token)                                                                               //
    // aO = tokenAmountOut             /        bptIn         \                                  //
    // b = tokenBalance      a0 = b * | ---------------------  |                                 //
    // bptIn = bptAmountIn             \     bptTotalSupply    /                                 //
    // bpt = bptTotalSupply                                                                      //
     **********************************************************************************************/

    // Since we're computing an amount out, we round down overall. This means rounding down on both the
    // multiplication and division.

    let ratio = amount_in
        .checked_mul(BALANCE_PRECISION)
        .unwrap()
        .checked_div(total_supply)
        .unwrap();

    let mut amounts_out: Vec<u128> = vec![];
    for j in 0..balances.len() {
        amounts_out.push(
            balances[j]
                .checked_mul(ratio)
                .unwrap()
                .checked_div(BALANCE_PRECISION)
                .unwrap(),
        );
    }

    Ok(amounts_out)
}

// StableMath._getTokenBalanceGivenInvariantAndAllOtherBalances
// This function calculates the balance of a given token (token_index)
// given all the other balances and the invariant
fn get_token_balance_given_invariant_and_all_other_balances(
    amp: u128,
    balances: Vec<u128>,
    invariant: u128,
    token_index: usize,
) -> Result<u128> {
    // Rounds result up overall

    let num_tokens = balances.len() as u128;
    let amp_times_total = amp.checked_mul(num_tokens).unwrap();
    let mut sum = balances[0];
    let mut p = balances[0].checked_mul(num_tokens).unwrap();

    for j in 1..balances.len() {
        p = p
            .checked_mul(balances[j])
            .unwrap()
            .checked_mul(num_tokens)
            .unwrap()
            .checked_div(invariant)
            .unwrap();
        sum = sum.checked_add(balances[j]).unwrap();
    }
    // No need to use safe math, based on the loop above `sum` is greater than or equal to `balances[token_index]`
    sum = sum.saturating_sub(balances[token_index]);

    let inv_2 = invariant.checked_mul(invariant).unwrap();
    // We remove the balance from c by multiplying it
    let c = inv_2
        .checked_div(amp_times_total.checked_mul(p).unwrap())
        .unwrap()
        // divUp
        .saturating_add(1)
        .checked_mul(balances[token_index])
        .unwrap();
    let b = invariant
        .checked_div(amp_times_total)
        .unwrap()
        .checked_add(sum)
        .unwrap();

    // We iterate to find the balance
    let mut prev_token_balance;
    // We multiply the first iteration outside the loop with the invariant to set the value of the
    // initial approximation.
    let mut token_balance = inv_2
        .checked_add(c)
        .unwrap()
        .checked_div(invariant.checked_add(b).unwrap())
        .unwrap()
        // divUp
        .saturating_add(1);

    for _ in 0..255 {
        prev_token_balance = token_balance;

        token_balance = prev_token_balance
            .checked_mul(prev_token_balance)
            .unwrap()
            .checked_add(c)
            .unwrap()
            .checked_div(
                prev_token_balance
                    .checked_mul(2)
                    .unwrap()
                    .checked_add(b)
                    .unwrap()
                    .checked_sub(invariant)
                    .unwrap(),
            )
            .unwrap();

        if token_balance > prev_token_balance {
            if token_balance.saturating_sub(prev_token_balance) <= 1 {
                return Ok(token_balance);
            }
        } else if prev_token_balance.saturating_sub(token_balance) <= 1 {
            return Ok(token_balance);
        }
    }

    err!(PoolStableError::GetBalanceDidntConverge)
}

fn complement(weight: u128) -> u128 {
    if weight < BALANCE_PRECISION {
        BALANCE_PRECISION.saturating_sub(weight)
    } else {
        0
    }
}
