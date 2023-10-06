use crate::{located::*, math};
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
    pub amp: u16,
    pub amp_start: u16,
    pub amp_start_time: i64,
    pub amp_end_time: i64,
    pub amp_duration: u32,
    pub is_active: bool,
    // immutable
    pub authority_bump: u8,
    pub tokens: Vec<PoolToken>,
}

impl Pool {
    pub const AUTHORITY_PREFIX: &'static [u8] = b"Stable Pool Authority";

    pub const MIN_AMP: u16 = 1;
    pub const MAX_AMP: u16 = 5000;

    pub const MIN_SWAP_FEE: u16 = 1; // 0.01%
    pub const MAX_SWAP_FEE: u16 = 100; // 1.00%

    pub const MIN_TOKENS: usize = 2;
    pub const MAX_TOKENS: usize = 5;

    pub const POOL_TOKEN_DECIMALS: u8 = 9;
    pub const MAX_TOKEN_DECIMALS: u32 = 9;

    pub fn get_invariant(&self) -> u128 {
        self.invariant as u128
    }

    pub fn get_amplification(&self) -> u128 {
        self.amp as u128
    }

    pub fn get_swap_fee(&self) -> u128 {
        self.swap_fee as u128
    }

    pub fn get_balances(&self) -> Vec<u128> {
        self.tokens.iter().map(|token| token.balance as u128).collect()
    }

    pub fn get_balance(&self, mint: Pubkey) -> u128 {
        let token = self.tokens.iter().find(|token| token.mint == mint).unwrap();
        token.balance as u128
    }

    pub fn get_multiplier(&self, mint: Pubkey) -> u128 {
        let token = self.tokens.iter().find(|token| token.mint == mint).unwrap();
        token.multiplier as u128
    }

    pub fn get_scaling_factor(&self, mint: Pubkey) -> u128 {
        let token = self.tokens.iter().find(|token| token.mint == mint).unwrap();
        token.scaling_factor as u128
    }

    pub fn get_token_index(&self, mint: Pubkey) -> usize {
        self.tokens
            .iter()
            .enumerate()
            .find(|(_, token)| token.mint == mint)
            .unwrap()
            .0
    }

    pub fn refresh_invariant(&mut self) {
        self.invariant =
            u64::try_from(math::calc_invariant(self.get_amplification(), self.get_balances()).unwrap()).unwrap();
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
    pub invariant: u64,
    pub swap_fee: u16,
    pub amp: u16,
    pub amp_start_time: i64,
    pub amp_end_time: i64,
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
                invariant: self.as_ref().invariant,
                swap_fee: self.as_ref().swap_fee,
                amp: self.as_ref().amp,
                amp_start_time: self.as_ref().amp_start_time,
                amp_end_time: self.as_ref().amp_end_time,
                is_active: self.as_ref().is_active,
                tokens: self.as_ref().tokens.clone(),
            },
        });
    }
}
