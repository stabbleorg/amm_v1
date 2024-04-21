pub mod error;
pub mod instructions;
pub mod located;
pub mod state;

use crate::instructions::*;
use anchor_lang::prelude::*;

declare_id!("swapFpHZwjELNnjvThjajtiVmkz3yPQEHjLtka2fwHW");

#[program]
pub mod weighted_swap {
    use super::*;

    /// initialize a pool
    #[access_control(Initialize::validate(&ctx, swap_fee, &weights))]
    pub fn initialize(ctx: Context<Initialize>, swap_fee: u64, weights: Vec<u64>) -> Result<()> {
        process_initialize(ctx, swap_fee, weights)
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
    pub fn swap<'a, 'b, 'c, 'info>(
        ctx: Context<'_, '_, '_, 'info, Swap<'info>>,
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> Result<()> {
        process_swap(ctx, amount_in, minimum_amount_out)
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

    #[access_control(PendingOwnerOnly::validate(&ctx))]
    pub fn accept_owner<'info>(ctx: Context<PendingOwnerOnly<'info>>) -> Result<()> {
        process_accept_owner(ctx)
    }

    #[access_control(PendingOwnerOnly::validate(&ctx))]
    pub fn reject_owner<'info>(ctx: Context<PendingOwnerOnly<'info>>) -> Result<()> {
        process_reject_owner(ctx)
    }

    /// shutdown the zero-liquidity pool
    pub fn shutdown<'a, 'b, 'c, 'info>(ctx: Context<'_, '_, '_, 'info, OwnerOnly<'info>>) -> Result<()> {
        process_shutdown(ctx)
    }
}
