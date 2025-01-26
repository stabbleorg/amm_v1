pub mod instructions;
pub mod state;

use crate::instructions::*;
use anchor_common::validate::*;
use anchor_lang::prelude::*;

declare_id!("swapFpHZwjELNnjvThjajtiVmkz3yPQEHjLtka2fwHW");

#[program]
pub mod weighted_swap {
    use super::*;

    /// initialize a pool
    #[access_control(ctx.accounts.validate())]
    pub fn initialize<'a, 'b, 'c, 'info>(
        ctx: Context<'_, '_, 'info, 'info, Initialize<'info>>,
        swap_fee: u64,
        weights: Vec<u64>,
        max_caps: Vec<u64>,
    ) -> Result<()> {
        process_initialize(ctx, swap_fee, weights, &max_caps)
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

    pub fn change_swap_fee(ctx: Context<OwnerOnly>, new_swap_fee: u64) -> Result<()> {
        process_change_swap_fee(ctx, new_swap_fee)
    }

    pub fn change_max_supply(ctx: Context<OwnerOnly>, new_max_supply: u64) -> Result<()> {
        process_change_max_supply(ctx, new_max_supply)
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
}
