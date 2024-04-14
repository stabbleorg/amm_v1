use crate::located::*;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Eq, PartialEq, Clone, Copy)]
pub struct PoolToken {
    pub mint: Pubkey, // immutable

    pub decimals: u8, // immutable

    // normalized weight
    pub weight: u64, // immutable

    // immutable
    // 10**decimals
    pub multiplier: u32,

    // 10^(9-decimals) / tick
    pub scaling_factor: u64, // immutable

    pub tick: u64, // immutable

    // balance scaled up to 9 decimals
    pub balance: u64,
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

    pub const MIN_SWAP_FEE: u64 = 1000; // 0.1%
    pub const MAX_SWAP_FEE: u64 = 25000; // 2.5%

    pub const MIN_TOKENS: usize = 2;
    pub const MAX_TOKENS: usize = 8;

    pub const POOL_TOKEN_DECIMALS: u8 = 9;
    pub const MAX_TOKEN_DECIMALS: u32 = 9;

    pub const BALANCE_PRECISION: f64 = 1e9;
    pub const WEIGHT_PRECISION: f64 = 1e6;
    pub const FEE_PRECISION: f64 = 1e6;

    pub fn get_swap_fee(&self) -> f64 {
        self.swap_fee as f64 / Pool::FEE_PRECISION
    }

    pub fn get_balances(&self) -> Vec<f64> {
        self.tokens
            .iter()
            .map(|token| token.balance as f64 / Pool::BALANCE_PRECISION)
            .collect()
    }

    pub fn get_normalized_weights(&self) -> Vec<f64> {
        self.tokens
            .iter()
            .map(|token| token.weight as f64 / Pool::WEIGHT_PRECISION)
            .collect()
    }

    pub fn get_balance(&self, mint: Pubkey) -> f64 {
        let token = self.tokens.iter().find(|token| token.mint == mint).unwrap();
        token.balance as f64 / Pool::BALANCE_PRECISION
    }

    pub fn get_normalized_weight(&self, mint: Pubkey) -> f64 {
        let token = self.tokens.iter().find(|token| token.mint == mint).unwrap();
        token.weight as f64 / Pool::WEIGHT_PRECISION
    }

    pub fn get_token_index(&self, mint: Pubkey) -> usize {
        self.tokens
            .iter()
            .enumerate()
            .find(|(_, token)| token.mint == mint)
            .unwrap()
            .0
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
                tokens: self.as_ref().tokens.clone(),
            },
        });
    }
}
