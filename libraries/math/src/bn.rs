///! 128 and 256 bit numbers
///! U128 is more efficient than u128
///! https://github.com/solana-labs/solana/issues/19549
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

/// Trait for calculating `val * num / denom` with different rounding modes and overflow
/// protection.
///
/// Implementations of this trait have to ensure that even if the result of the multiplication does
/// not fit into the type, as long as it would fit after the division the correct result has to be
/// returned instead of `None`. `None` only should be returned if the overall result does not fit
/// into the type.
///
/// This specifically means that e.g. the `u64` implementation must, depending on the arguments, be
/// able to do 128 bit integer multiplication.
pub trait MulDiv<RHS = Self> {
    /// Output type for the methods of this trait.
    type Output;

    /// Calculates `floor(val * num / denom)`, i.e. the largest integer less than or equal to the
    /// result of the division.
    fn mul_div_down(self, num: RHS, denom: RHS) -> Option<Self::Output>;

    /// Calculates `floor(val / denom)`, i.e. the largest integer less than or equal to the
    /// result of the division.
    fn div_down(self, denom: RHS) -> Option<Self::Output>;

    /// Calculates `ceil(val * num / denom)`, i.e. the the smallest integer greater than or equal to
    /// the result of the division.
    fn mul_div_up(self, num: RHS, denom: RHS) -> Option<Self::Output>;

    /// Calculates `ceil(val / denom)`, i.e. the the smallest integer greater than or equal to
    /// the result of the division.
    fn div_up(self, denom: RHS) -> Option<Self::Output>;

    /// Return u64 not out of bounds
    fn to_underflow_u64(self) -> u64;
}

pub trait Upcast {
    fn as_u256(self) -> U256;
}
impl Upcast for U128 {
    fn as_u256(self) -> U256 {
        U256([self.0[0], self.0[1], 0, 0])
    }
}

pub trait Downcast {
    /// Unsafe cast to U128
    /// Bits beyond the 128th position are lost
    fn as_u128(self) -> U128;
}
impl Downcast for U256 {
    fn as_u128(self) -> U128 {
        U128([self.0[0], self.0[1]])
    }
}

impl MulDiv for u64 {
    type Output = u64;

    fn mul_div_down(self, num: Self, denom: Self) -> Option<Self::Output> {
        assert_ne!(denom, 0);
        let r = (uint128!(self) * uint128!(num)) / uint128!(denom);
        if r > uint128!(u64::MAX) {
            None
        } else {
            Some(r.as_u64())
        }
    }

    fn div_down(self, denom: Self) -> Option<Self::Output> {
        assert_ne!(denom, 0);
        let r = uint128!(self) / uint128!(denom);
        if r > uint128!(u64::MAX) {
            None
        } else {
            Some(r.as_u64())
        }
    }

    fn mul_div_up(self, num: Self, denom: Self) -> Option<Self::Output> {
        assert_ne!(denom, 0);
        let r = (uint128!(self) * uint128!(num) + uint128!(denom - 1)) / uint128!(denom);
        if r > uint128!(u64::MAX) {
            None
        } else {
            Some(r.as_u64())
        }
    }

    fn div_up(self, denom: Self) -> Option<Self::Output> {
        assert_ne!(denom, 0);
        let r = (uint128!(self) + uint128!(denom - 1)) / uint128!(denom);
        if r > uint128!(u64::MAX) {
            None
        } else {
            Some(r.as_u64())
        }
    }

    fn to_underflow_u64(self) -> u64 {
        self
    }
}

impl MulDiv for U256 {
    type Output = U256;

    fn mul_div_down(self, num: Self, denom: Self) -> Option<Self::Output> {
        assert_ne!(denom, U256::default());
        let r = (self * num) / denom;
        if r > U128::MAX.as_u256() {
            None
        } else {
            Some(r)
        }
    }

    fn div_down(self, denom: Self) -> Option<Self::Output> {
        assert_ne!(denom, U256::default());
        let r = self / denom;
        if r > U128::MAX.as_u256() {
            None
        } else {
            Some(r)
        }
    }

    fn mul_div_up(self, num: Self, denom: Self) -> Option<Self::Output> {
        assert_ne!(denom, U256::default());
        let r = (self * num + (denom - 1)) / denom;
        if r > U128::MAX.as_u256() {
            None
        } else {
            Some(r)
        }
    }

    fn div_up(self, denom: Self) -> Option<Self::Output> {
        assert_ne!(denom, U256::default());
        let r = (self + (denom - 1)) / denom;
        if r > U128::MAX.as_u256() {
            None
        } else {
            Some(r)
        }
    }

    fn to_underflow_u64(self) -> u64 {
        if self < uint256!(u64::MAX) {
            self.as_u64()
        } else {
            0
        }
    }
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
}
