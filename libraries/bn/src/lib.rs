///! 128 and 256 bit numbers
///! U128 is more efficient than u128
///! https://github.com/solana-labs/solana/issues/19549
pub mod safe_math;

use uint::construct_uint;

construct_uint! {
    pub struct U128(2);
}

construct_uint! {
    pub struct U256(4);
}

#[macro_export]
macro_rules! uint128 {
    ($value:expr) => {
        U128::from($value)
    };
}

#[macro_export]
macro_rules! uint256 {
    ($value:expr) => {
        U256::from($value)
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_macros() {
        assert_eq!(uint256!(0), U256::zero());
        assert_eq!(uint256!(u64::MAX).as_u64(), u64::MAX);

        assert_eq!(uint128!(0), U128::zero());
        assert_eq!(uint128!(u64::MAX).as_u64(), u64::MAX);
    }

    #[test]
    fn test_shift_for_div_by_2() {
        assert_eq!(
            uint256!(u128::MAX) >> 1,
            uint256!(u128::MAX).checked_div(uint256!(2)).unwrap()
        );
    }

    #[test]
    fn test_shift_for_mul_by_2() {
        assert_eq!(
            uint256!(u128::MAX) << 1,
            uint256!(u128::MAX).checked_mul(uint256!(2)).unwrap()
        );
    }
}
