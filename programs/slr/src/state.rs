use crate::located::Located;
use anchor_lang::prelude::*;

#[account]
pub struct Pool {
    pub authority_bump: u8,
    pub decimals: u8,

    pub mint: Pubkey,
    pub supply: u64,

    pub underlying_mint: Pubkey,
    pub liquidity: u64,
    pub reserved_liquidity: u64,
    pub locked_liquidity: u64,
    pub max_liquidity: u64,
}

impl Pool {
    pub const AUTHORITY_PREFIX: &'static [u8] = b"SLR Pool Authority";

    pub fn calc_new_supply(&self, total_supply: u64, amount_in: u64) -> u64 {
        if total_supply == 0 {
            amount_in
        } else {
            (amount_in as u128)
                .checked_mul(total_supply as u128)
                .unwrap()
                .checked_div(self.liquidity as u128)
                .unwrap() as u64
        }
    }

    pub fn calc_amount_out(&self, total_supply: u64, amount_burn: u64) -> u64 {
        (amount_burn as u128)
            .checked_mul(self.liquidity as u128)
            .unwrap()
            .checked_div(total_supply as u128)
            .unwrap() as u64
    }
}

pub trait PoolAuthority {
    fn authority_seeds<R, F: FnOnce(&[&[u8]]) -> R>(&self, f: F) -> R;
}

impl<T> PoolAuthority for T
where
    T: Located<Pool>,
{
    fn authority_seeds<R, F: FnOnce(&[&[u8]]) -> R>(&self, f: F) -> R {
        f(&[
            Pool::AUTHORITY_PREFIX,
            &self.key().to_bytes(),
            &[self.as_ref().authority_bump],
        ])
    }
}
