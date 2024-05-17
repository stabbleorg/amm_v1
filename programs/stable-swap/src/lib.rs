pub mod error;
pub mod instructions;
pub mod state;

use crate::instructions::*;
use anchor_lang::prelude::*;
use anchor_pro::validate::*;

declare_id!("swapNyd8XiQwJ6ianp9snpu4brUqFxadzvHebnAXjJZ");

#[program]
pub mod stable_swap {
    use super::*;

    /// initialize a pool
    #[access_control(ctx.accounts.validate())]
    pub fn initialize(ctx: Context<Initialize>, amp_factor: u16, swap_fee: u64, max_caps: Vec<u64>) -> Result<()> {
        process_initialize(ctx, amp_factor, swap_fee, &max_caps)
    }

    /// add liquidity
    #[access_control(ctx.accounts.validate())]
    pub fn deposit<'a, 'b, 'c, 'info>(
        ctx: Context<'_, '_, '_, 'info, Deposit<'info>>,
        amounts: Vec<u64>,
        minimum_amount_out: u64,
    ) -> Result<()> {
        process_deposit(ctx, amounts, minimum_amount_out)
    }

    /// remove liquidity
    #[access_control(ctx.accounts.validate())]
    pub fn withdraw<'a, 'b, 'c, 'info>(
        ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>,
        amount: u64,
        minimum_amounts_out: Vec<u64>,
    ) -> Result<()> {
        process_withdraw(ctx, amount, minimum_amounts_out)
    }

    /// swap
    #[access_control(ctx.accounts.validate())]
    pub fn swap(ctx: Context<Swap>, amount_in: Option<u64>, minimum_amount_out: u64) -> Result<()> {
        process_swap(ctx, amount_in, minimum_amount_out)
    }

    pub fn change_amp_factor<'info>(
        ctx: Context<OwnerOnly<'info>>,
        new_amp_factor: u16,
        ramp_duration: u32,
    ) -> Result<()> {
        process_change_amp_factor(ctx, new_amp_factor, ramp_duration)
    }

    pub fn change_swap_fee<'info>(ctx: Context<OwnerOnly<'info>>, new_swap_fee: u64) -> Result<()> {
        process_change_swap_fee(ctx, new_swap_fee)
    }

    pub fn pause<'info>(ctx: Context<OwnerOnly<'info>>) -> Result<()> {
        process_pause(ctx)
    }

    pub fn unpause<'info>(ctx: Context<OwnerOnly<'info>>) -> Result<()> {
        process_unpause(ctx)
    }

    pub fn transfer_owner<'info>(ctx: Context<OwnerOnly<'info>>, new_owner: Pubkey) -> Result<()> {
        process_transfer_owner(ctx, new_owner)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn accept_owner<'info>(ctx: Context<PendingOwnerOnly<'info>>) -> Result<()> {
        process_accept_owner(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn reject_owner<'info>(ctx: Context<PendingOwnerOnly<'info>>) -> Result<()> {
        process_reject_owner(ctx)
    }

    /// shutdown the zero-liquidity pool
    pub fn shutdown<'a, 'b, 'c, 'info>(ctx: Context<'_, '_, '_, 'info, OwnerOnly<'info>>) -> Result<()> {
        process_shutdown(ctx)
    }
}
