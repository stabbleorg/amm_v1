use crate::located::Located;
use anchor_lang::prelude::*;

#[account]
pub struct Pool {
    // immutable
    pub vault: Pubkey,
    // immutable
    pub mint: Pubkey,
    // immutable
    pub quote_mint: Pubkey,
    // immutable
    pub decimals: u8,
    pub liquidity: u64,
    pub locked_liquidity: u64,
    pub max_liquidity: u64,
    pub is_active: bool,
    // immutable
    pub authority_bump: u8,
}

impl Pool {
    pub const AUTHORITY_PREFIX: &'static [u8] = b"pool_authority";

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

    pub fn calc_unwrapped_amount(&self, total_supply: u64, amount_burn: u64) -> u64 {
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

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct PoolUpdatedData {
    pub liquidity: u64,
    pub locked_liquidity: u64,
    pub max_liquidity: u64,
    pub is_active: bool,
}

#[event]
pub struct PoolUpdatedEvent {
    pub pubkey: Pubkey,
    pub data: PoolUpdatedData,
}

pub trait EmitPoolUpdatedEvent {
    fn emit_updated_event(&self);
}

impl<T> EmitPoolUpdatedEvent for T
where
    T: Located<Pool>,
{
    fn emit_updated_event(&self) {
        emit!(PoolUpdatedEvent {
            pubkey: self.key(),
            data: PoolUpdatedData {
                liquidity: self.as_ref().liquidity,
                locked_liquidity: self.as_ref().locked_liquidity,
                max_liquidity: self.as_ref().max_liquidity,
                is_active: self.as_ref().is_active,
            },
        });
    }
}
