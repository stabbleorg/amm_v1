use crate::located::*;
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

    pub pending_owner: Option<Pubkey>,
}

impl Pool {
    pub const AUTHORITY_PREFIX: &'static [u8] = b"pool_authority";

    pub const MIN_SWAP_FEE: u64 = 1_000; // 0.1%
    pub const MAX_SWAP_FEE: u64 = 25_000; // 2.5%

    pub const MAX_SAFE_BALANCE: u64 = 2_000_000_000;

    pub const MAX_TOKEN_DECIMALS: u8 = 9;

    pub fn get_balances(&self) -> Vec<u64> {
        self.tokens.iter().map(|token| token.balance).collect()
    }

    pub fn get_normalized_weights(&self) -> Vec<u64> {
        self.tokens.iter().map(|token| token.weight).collect()
    }

    pub fn get_token_index(&self, mint: Pubkey) -> usize {
        self.tokens
            .iter()
            .enumerate()
            .find(|(_, token)| token.mint == mint)
            .unwrap()
            .0
    }

    pub fn calc_balance_in(&self, amount_in: u64, token_index: usize) -> u64 {
        if self.tokens[token_index].scaling_factor == 1 {
            amount_in
        } else if self.tokens[token_index].scaling_up {
            amount_in * self.tokens[token_index].scaling_factor
        } else {
            amount_in / self.tokens[token_index].scaling_factor
        }
    }

    pub fn calc_amount_in(&self, amount_in: u64, token_index: usize) -> u64 {
        if self.tokens[token_index].scaling_up {
            amount_in
        } else {
            amount_in / self.tokens[token_index].scaling_factor * self.tokens[token_index].scaling_factor
        }
    }

    pub fn calc_amount_out(&self, balance_out: u64, token_index: usize) -> u64 {
        if self.tokens[token_index].scaling_factor == 1 {
            balance_out
        } else if self.tokens[token_index].scaling_up {
            balance_out / self.tokens[token_index].scaling_factor
        } else {
            balance_out * self.tokens[token_index].scaling_factor
        }
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
    pub is_active: bool,
    pub swap_fee: u64,
    pub tokens: Vec<PoolToken>,
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
                tokens: self.as_ref().tokens.clone(),
            },
        });
    }
}
