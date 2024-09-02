use anchor_common::located::*;
use anchor_lang::{prelude::*, solana_program::sysvar::clock::Clock};
use bn::safe_math::CheckedMulDiv;
use math::stable_math;

#[derive(AnchorSerialize, AnchorDeserialize, Eq, PartialEq, Clone, Copy)]
pub struct PoolToken {
    pub mint: Pubkey, // immutable

    pub decimals: u8, // immutable

    pub scaling_up: bool,    // immutable
    pub scaling_factor: u64, // immutable

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

    pub amp_initial_factor: u16,
    pub amp_target_factor: u16,
    pub ramp_start_ts: i64,
    pub ramp_stop_ts: i64,

    pub swap_fee: u64,

    pub tokens: Vec<PoolToken>,

    pub pending_owner: Option<Pubkey>,
}

impl Pool {
    pub const AUTHORITY_PREFIX: &'static [u8] = b"pool_authority";

    pub fn get_amplification(&self) -> Option<u64> {
        let current_ts = Clock::get().unwrap().unix_timestamp;
        let amp_initial_factor = self.amp_initial_factor as u64;
        let amp_target_factor = self.amp_target_factor as u64;

        // No need to use checked arithmetic
        let amp = if current_ts <= self.ramp_start_ts {
            amp_initial_factor.saturating_mul(stable_math::AMP_PRECISION)
        } else if current_ts >= self.ramp_stop_ts {
            amp_target_factor.saturating_mul(stable_math::AMP_PRECISION)
        } else {
            let ramp_elapsed = (current_ts.saturating_sub(self.ramp_start_ts) as u64)
                .checked_div(60)?
                .checked_mul(60)?;
            let ramp_duration = self.ramp_stop_ts.saturating_sub(self.ramp_start_ts) as u64;
            if amp_initial_factor <= amp_target_factor {
                let amp_offset = (amp_target_factor.saturating_sub(amp_initial_factor))
                    .saturating_mul(stable_math::AMP_PRECISION)
                    .checked_mul_div_down(ramp_elapsed, ramp_duration)?;
                amp_initial_factor
                    .saturating_mul(stable_math::AMP_PRECISION)
                    .saturating_add(amp_offset)
            } else {
                let amp_offset = (amp_initial_factor.saturating_sub(amp_target_factor))
                    .saturating_mul(stable_math::AMP_PRECISION)
                    .checked_mul_div_down(ramp_elapsed, ramp_duration)?;
                amp_initial_factor
                    .saturating_mul(stable_math::AMP_PRECISION)
                    .saturating_sub(amp_offset)
            }
        };

        Some(amp)
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
    pub amp_initial_factor: u16,
    pub amp_target_factor: u16,
    pub ramp_start_ts: i64,
    pub ramp_stop_ts: i64,
    pub swap_fee: u64,
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
                amp_initial_factor: self.as_ref().amp_initial_factor,
                amp_target_factor: self.as_ref().amp_target_factor,
                ramp_start_ts: self.as_ref().ramp_start_ts,
                ramp_stop_ts: self.as_ref().ramp_stop_ts,
                swap_fee: self.as_ref().swap_fee,
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
