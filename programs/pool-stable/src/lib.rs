pub mod error;
pub mod located;
pub mod math;
pub mod processor;
pub mod state;

use crate::processor::*;
use anchor_lang::prelude::*;

declare_id!("CKZnJGq6aCDBccaoZUJkJpgYUVLpoVT51RfYpaMXP37f");

#[program]
pub mod pool_stable {
    use super::*;

    /// initialize a pool
    #[access_control(Initialize::validate(&ctx, amp, swap_fee))]
    pub fn initialize(ctx: Context<Initialize>, amp: u16, swap_fee: u16) -> Result<()> {
        process_initialize(ctx, amp, swap_fee)
    }

    /// add liquidity
    #[access_control(Deposit::validate(&ctx, &amounts))]
    pub fn deposit<'a, 'b, 'c, 'info>(
        ctx: Context<'_, '_, '_, 'info, Deposit<'info>>,
        amounts: Vec<u64>,
        min_amount_out: u64,
    ) -> Result<()> {
        process_deposit(ctx, amounts, min_amount_out)
    }

    /// remove liquidity
    #[access_control(Withdraw::validate(&ctx))]
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64, min_amounts_out: Vec<u64>) -> Result<()> {
        process_withdraw(ctx, amount, min_amounts_out)
    }

    /// swap
    /// min_amount_out can be 0 for batch swap
    #[access_control(Swap::validate(&ctx))]
    pub fn swap(ctx: Context<Swap>, amount_in: u64, min_amount_out: u64) -> Result<()> {
        process_swap(ctx, amount_in, min_amount_out)
    }
}
