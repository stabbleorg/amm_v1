use crate::located::*;
use anchor_lang::{prelude::*, solana_program::sysvar::clock::Clock};
use bn::safe_math::CheckedMulDiv;
use math::stable_math;

#[derive(AnchorSerialize, AnchorDeserialize, Eq, PartialEq, Clone, Copy)]
pub struct PoolToken {
    pub mint: Pubkey, // immutable

    pub decimals: u8, // immutable

    // 10^(9-decimals) / tick
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

    pub const MIN_SWAP_FEE: u64 = 1; // 0.0001%
    pub const MAX_SWAP_FEE: u64 = 10_000; // 1.0000%

    pub const MAX_TOKEN_DECIMALS: u8 = 9;

    pub fn get_amplification(&self) -> u64 {
        let current_ts = Clock::get().unwrap().unix_timestamp;
        let amp_initial_factor = self.amp_initial_factor as u64;
        let amp_target_factor = self.amp_target_factor as u64;

        // No need to use checked arithmetic
        if current_ts <= self.ramp_start_ts {
            amp_initial_factor.saturating_mul(stable_math::AMP_PRECISION)
        } else if current_ts >= self.ramp_stop_ts {
            amp_target_factor.saturating_mul(stable_math::AMP_PRECISION)
        } else {
            let ramp_elsapsed = current_ts.saturating_sub(self.ramp_start_ts) as u64;
            let ramp_duration = self.ramp_stop_ts.saturating_sub(self.ramp_start_ts) as u64;
            if amp_initial_factor <= amp_target_factor {
                let amp_offset = (amp_target_factor.saturating_sub(amp_initial_factor))
                    .saturating_mul(stable_math::AMP_PRECISION)
                    .checked_mul_div_down(ramp_elsapsed, ramp_duration)
                    .unwrap();
                amp_initial_factor
                    .saturating_mul(stable_math::AMP_PRECISION)
                    .saturating_add(amp_offset)
            } else {
                let amp_offset = (amp_initial_factor.saturating_sub(amp_target_factor))
                    .saturating_mul(stable_math::AMP_PRECISION)
                    .checked_mul_div_down(ramp_elsapsed, ramp_duration)
                    .unwrap();
                amp_initial_factor
                    .saturating_mul(stable_math::AMP_PRECISION)
                    .saturating_sub(amp_offset)
            }
        }
    }

    pub fn get_balances(&self) -> Vec<u64> {
        self.tokens.iter().map(|token| token.balance).collect()
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
    pub amp_initial_factor: u16,
    pub amp_target_factor: u16,
    pub ramp_start_ts: i64,
    pub ramp_stop_ts: i64,

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
                amp_initial_factor: self.as_ref().amp_initial_factor,
                amp_target_factor: self.as_ref().amp_target_factor,
                ramp_start_ts: self.as_ref().ramp_start_ts,
                ramp_stop_ts: self.as_ref().ramp_stop_ts,
                tokens: self.as_ref().tokens.clone(),
            },
        });
    }
}
