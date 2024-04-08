pub mod error;
pub mod located;
pub mod processor;
pub mod state;

use crate::processor::*;
use anchor_lang::prelude::*;

declare_id!("EeyyyuAXAzo3YuMv7REuHYtPzEssgK4oBeFYM8K9CoGM");

#[program]
pub mod pool_stable {
    use super::*;

    /// initialize a pool
    #[access_control(Initialize::validate(&ctx, amp_factor, swap_fee))]
    pub fn initialize(ctx: Context<Initialize>, amp_factor: u16, swap_fee: u32) -> Result<()> {
        process_initialize(ctx, amp_factor, swap_fee)
    }

    /// add liquidity
    #[access_control(Deposit::validate(&ctx, &amounts))]
    pub fn deposit<'a, 'b, 'c, 'info>(
        ctx: Context<'_, '_, '_, 'info, Deposit<'info>>,
        amounts: Vec<u64>,
        minimum_amount_out: u64,
    ) -> Result<()> {
        process_deposit(ctx, amounts, minimum_amount_out)
    }

    /// remove liquidity
    #[access_control(Withdraw::validate(&ctx))]
    pub fn withdraw<'a, 'b, 'c, 'info>(
        ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>,
        amount: u64,
        minimum_amounts_out: Vec<u64>,
    ) -> Result<()> {
        process_withdraw(ctx, amount, minimum_amounts_out)
    }

    /// swap
    #[access_control(Swap::validate(&ctx))]
    pub fn swap(ctx: Context<Swap>, amount_in: u64, minimum_amount_out: u64) -> Result<()> {
        // process_swap(ctx, amount_in, minimum_amount_out)
        Ok(())
    }

    pub fn pause<'info>(ctx: Context<OwnerOnly<'info>>) -> Result<()> {
        process_pause(ctx)
    }

    pub fn unpause<'info>(ctx: Context<OwnerOnly<'info>>) -> Result<()> {
        process_unpause(ctx)
    }

    pub fn change_swap_fee<'info>(ctx: Context<OwnerOnly<'info>>, new_swap_fee: u32) -> Result<()> {
        process_change_swap_fee(ctx, new_swap_fee)
    }

    pub fn change_owner<'info>(ctx: Context<OwnerOnly<'info>>, new_owner: Pubkey) -> Result<()> {
        process_change_owner(ctx, new_owner)
    }

    pub fn close<'a, 'b, 'c, 'info>(ctx: Context<'_, '_, '_, 'info, OwnerOnly<'info>>) -> Result<()> {
        process_close(ctx)
    }
}
