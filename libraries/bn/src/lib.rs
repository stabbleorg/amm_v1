pub mod safe_math;

use uint::construct_uint;

construct_uint! {
    pub struct U256(4);
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
    fn test_shift_for_div_by_2() {
        assert_eq!(uint256!(u128::MAX) >> 1, uint256!(u128::MAX) / (uint256!(2)));
    }

    #[test]
    fn test_shift_for_mul_by_2() {
        assert_eq!(uint256!(u128::MAX) << 1, uint256!(u128::MAX) * uint256!(2));
    }
}
