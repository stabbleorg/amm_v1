use anchor_common::located::*;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Eq, PartialEq, Clone, Copy)]
pub struct PoolToken {
    pub mint: Pubkey, // immutable

    pub decimals: u8, // immutable

    pub scaling_up: bool,    // immutable
    pub scaling_factor: u64, // immutable

    // balance scaled up to 9 decimals
    pub balance: u64,

    // normalized weight
    pub weight: u64, // immutable
}

#[account]
pub struct Pool {
    pub owner: Pubkey,

    pub vault: Pubkey, // immutable

    pub mint: Pubkey, // immutable

    pub authority_bump: u8, // immutable

    pub is_active: bool,

    pub invariant: u64,

    pub swap_fee: u64,

    pub tokens: Vec<PoolToken>,

    pub max_supply: u64,

    pub pending_owner: Option<Pubkey>,
}

impl Pool {
    pub const AUTHORITY_PREFIX: &'static [u8] = b"pool_authority";

    pub fn get_normalized_weights(&self) -> Vec<u64> {
        self.tokens.iter().map(|token| token.weight).collect()
    }

    pub fn get_balances(&self) -> Vec<u64> {
        self.tokens.iter().map(|token| token.balance).collect()
    }

    pub fn get_token_index(&self, mint: Pubkey) -> Option<usize> {
        self.tokens.iter().position(|token| token.mint == mint)
    }

    /// scaling up/down from token amount to wrapped balance amount
    pub fn calc_wrapped_amount(&self, amount: u64, token_index: usize) -> Option<u64> {
        let pool_token = self.tokens.get(token_index)?;
        if pool_token.scaling_factor == 1 {
            Some(amount)
        } else if pool_token.scaling_up {
            amount.checked_mul(pool_token.scaling_factor)
        } else {
            amount.checked_div(pool_token.scaling_factor)
        }
    }

    /// scaling up/down from wrapped balance amount to token amount
    pub fn calc_unwrapped_amount(&self, amount: u64, token_index: usize) -> Option<u64> {
        let pool_token = self.tokens.get(token_index)?;
        if pool_token.scaling_factor == 1 {
            Some(amount)
        } else if pool_token.scaling_up {
            amount.checked_div(pool_token.scaling_factor)
        } else {
            amount.checked_mul(pool_token.scaling_factor)
        }
    }

    /// round down token amount not to send the lost amount from wrapped balance amount when it scaled down
    pub fn calc_rounded_amount(&self, amount: u64, token_index: usize) -> Option<u64> {
        let pool_token = self.tokens.get(token_index)?;
        if pool_token.scaling_up {
            Some(amount)
        } else {
            amount
                .checked_div(pool_token.scaling_factor)?
                .checked_mul(pool_token.scaling_factor)
        }
    }
}

////////////////////////////////////////////////////////////////

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

////////////////////////////////////////////////////////////////

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct PoolUpdatedData {
    pub is_active: bool,
    pub swap_fee: u64,
    pub max_supply: u64,
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
                is_active: self.as_ref().is_active,
                swap_fee: self.as_ref().swap_fee,
                max_supply: self.as_ref().max_supply,
            },
        });
    }
}

////////////////////////////////////////////////////////////////

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct PoolBalanceUpdatedData {
    pub balances: Vec<u64>,
}

#[event]
pub struct PoolBalanceUpdatedEvent {
    pub pubkey: Pubkey,
    pub data: PoolBalanceUpdatedData,
}

pub trait EmitPoolBalanceUpdatedEvent {
    fn emit_balance_updated_event(&self);
}

impl<T> EmitPoolBalanceUpdatedEvent for T
where
    T: Located<Pool>,
{
    fn emit_balance_updated_event(&self) {
        emit!(PoolBalanceUpdatedEvent {
            pubkey: self.key(),
            data: PoolBalanceUpdatedData {
                balances: self.as_ref().tokens.iter().map(|token| { token.balance }).collect(),
            },
        });
    }
}
