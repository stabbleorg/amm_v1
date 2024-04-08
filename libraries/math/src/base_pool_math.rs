use crate::bn::*;

// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-utils/contracts/lib/BasePoolMath.sol#L22-L45
pub fn compute_proportional_amounts_in(balances: Vec<U256>, pool_token_supply: U256, amount_out: U256) -> Vec<U256> {
    /************************************************************************************
    // computeProportionalAmountsIn                                                    //
    // (per token)                                                                     //
    // aI = amountIn                   /      bptOut      \                            //
    // b = balance           aI = b * | ----------------- |                            //
    // bptOut = bptAmountOut           \  bptTotalSupply  /                            //
    // bpt = bptTotalSupply                                                            //
     ************************************************************************************/

    // Since we're computing amounts in, we round up overall. This means rounding up on both the
    // multiplication and division.

    let mut amounts_in: Vec<U256> = vec![];
    for i in 0..balances.len() {
        amounts_in.push(balances[i].mul_div_up(amount_out, pool_token_supply).unwrap());
    }

    amounts_in
}

// See: https://github.com/stabbleorg/balancer-v2-monorepo/blob/master/pkg/pool-utils/contracts/lib/BasePoolMath.sol#L47-L70
pub fn compute_proportional_amounts_out(balances: Vec<U256>, pool_token_supply: U256, amount_in: U256) -> Vec<U256> {
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

    let mut amounts_out: Vec<U256> = vec![];
    for i in 0..balances.len() {
        amounts_out.push(balances[i].mul_div_down(amount_in, pool_token_supply).unwrap());
    }

    amounts_out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::uint256;

    #[test]
    fn test_compute_proportional_amounts_in() {
        let amounts_in = compute_proportional_amounts_in(
            vec![uint256!(5000000000_u64), uint256!(3000000000_u64)],
            uint256!(1000000000_u64),
            uint256!(100000000_u64),
        );
        assert_eq!(uint256!(500000000_u64), amounts_in[0]);
        assert_eq!(uint256!(300000000_u64), amounts_in[1]);
    }

    #[test]
    fn test_compute_proportional_amounts_out() {
        let amounts_out = compute_proportional_amounts_out(
            vec![uint256!(5000000000_u64), uint256!(3000000000_u64)],
            uint256!(1000000000_u64),
            uint256!(100000000_u64),
        );
        assert_eq!(uint256!(500000000_u64), amounts_out[0]);
        assert_eq!(uint256!(300000000_u64), amounts_out[1]);
    }
}
