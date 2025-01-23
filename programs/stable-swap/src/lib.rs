pub mod instructions;
pub mod state;

use crate::instructions::*;
use anchor_common::validate::*;
use anchor_lang::prelude::*;

declare_id!("swapNyd8XiQwJ6ianp9snpu4brUqFxadzvHebnAXjJZ");

#[program]
pub mod stable_swap {
    use super::*;

    /// initialize a pool
    #[access_control(ctx.accounts.validate())]
    pub fn initialize<'a, 'b, 'c, 'info>(
        ctx: Context<'_, '_, 'info, 'info, Initialize<'info>>,
        amp_factor: u16,
        swap_fee: u64,
        max_caps: Vec<u64>,
    ) -> Result<()> {
        process_initialize(ctx, amp_factor, swap_fee, &max_caps)
    }

    /// shutdown the zero-liquidity pool
    #[access_control(ctx.accounts.validate())]
    pub fn shutdown(ctx: Context<Shutdown>) -> Result<()> {
        Ok(())
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

    #[access_control(ctx.accounts.validate())]
    pub fn swap_v2(ctx: Context<SwapV2>, amount_in: Option<u64>, minimum_amount_out: u64) -> Result<()> {
        process_swap_v2(ctx, amount_in, minimum_amount_out)
    }

    /* Configuration */

    pub fn change_amp_factor(ctx: Context<AdminOnly>, new_amp_factor: u16, ramp_duration: u32) -> Result<()> {
        process_change_amp_factor(ctx, new_amp_factor, ramp_duration)
    }

    pub fn change_swap_fee(ctx: Context<OwnerOnly>, new_swap_fee: u64) -> Result<()> {
        process_change_swap_fee(ctx, new_swap_fee)
    }

    pub fn pause(ctx: Context<OwnerOnly>) -> Result<()> {
        process_pause(ctx)
    }

    pub fn unpause(ctx: Context<OwnerOnly>) -> Result<()> {
        process_unpause(ctx)
    }

    pub fn transfer_owner(ctx: Context<OwnerOnly>, new_owner: Pubkey) -> Result<()> {
        process_transfer_owner(ctx, &new_owner)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn accept_owner(ctx: Context<PendingOwnerOnly>) -> Result<()> {
        process_accept_owner(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn reject_owner(ctx: Context<PendingOwnerOnly>) -> Result<()> {
        process_reject_owner(ctx)
    }

    /* Dynamic amplification */

    pub fn create_strategy(
        ctx: Context<CreateStrategy>,
        amp_min_factor: u16,
        amp_max_factor: u16,
        ramp_min_step: u16,
        ramp_max_step: u16,
        ramp_min_duration: u32,
        ramp_max_duration: u32,
    ) -> Result<()> {
        process_create_strategy(
            ctx,
            amp_min_factor,
            amp_max_factor,
            ramp_min_step,
            ramp_max_step,
            ramp_min_duration,
            ramp_max_duration,
        )
    }

    pub fn approve_strategy(ctx: Context<ApproveStrategy>) -> Result<()> {
        process_approve_strategy(ctx)
    }

    pub fn exec_strategy(ctx: Context<ExecStrategy>, ramp_step: u16, ramp_duration: u32) -> Result<()> {
        process_exec_strategy(ctx, ramp_step, ramp_duration)
    }
}
