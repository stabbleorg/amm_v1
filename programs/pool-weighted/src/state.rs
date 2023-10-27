use crate::located::*;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Eq, PartialEq, Clone, Copy)]
pub struct PoolToken {
    // immutable
    pub mint: Pubkey,
    // immutable
    // support max 9 decimals
    pub decimals: u8,
    // immutable
    // 10**decimals
    pub multiplier: u32,
    // immutable
    // 10**(9-decimals)
    pub scaling_factor: u32,
    // balances scaled up to 9 decimals
    pub balance: u64,
    // immutable
    // normalized weight basis points scaled up to 4 decimals
    pub weight: u16,
}

#[account]
pub struct Pool {
    pub owner: Pubkey,
    // immutable
    pub vault: Pubkey,
    // immutable
    pub mint: Pubkey,
    pub invariant: u64,
    pub swap_fee: u16,
    pub is_active: bool,
    // immutable
    pub authority_bump: u8,
    pub tokens: Vec<PoolToken>,
}

impl Pool {
    pub const AUTHORITY_PREFIX: &'static [u8] = b"Weighted Pool Authority";

    pub const MIN_SWAP_FEE: u16 = 10; // 0.1%
    pub const MAX_SWAP_FEE: u16 = 250; // 2.5%

    pub const MIN_TOKENS: usize = 2;
    pub const MAX_TOKENS: usize = 8;

    pub const POOL_TOKEN_DECIMALS: u8 = 9;
    pub const MAX_TOKEN_DECIMALS: u32 = 9;

    pub const BALANCE_PRECISION: f64 = 1e9;
    pub const WEIGHT_PRECISION: f64 = 1e4;
    pub const FEE_PRECISION: f64 = 1e4;

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

    pub fn get_multiplier(&self, mint: Pubkey) -> f64 {
        let token = self.tokens.iter().find(|token| token.mint == mint).unwrap();
        token.multiplier as f64
    }

    pub fn get_scaling_factor(&self, mint: Pubkey) -> f64 {
        let token = self.tokens.iter().find(|token| token.mint == mint).unwrap();
        token.scaling_factor as f64
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
    pub owner: Pubkey,
    pub swap_fee: u16,
    pub is_active: bool,
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
                owner: self.as_ref().owner,
                swap_fee: self.as_ref().swap_fee,
                is_active: self.as_ref().is_active,
                tokens: self.as_ref().tokens.clone(),
            },
        });
    }
}
