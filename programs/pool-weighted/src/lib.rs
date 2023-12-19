pub mod error;
pub mod located;
pub mod math;
pub mod processor;
pub mod state;

use crate::processor::*;
use anchor_lang::prelude::*;

declare_id!("MT29MUjo7TPYxWK2NjLUCQ32dFgYEGW3nEDSAAJbyVy");

#[program]
pub mod pool_weighted {
    use super::*;

    /// initialize a pool
    #[access_control(Initialize::validate(&ctx, swap_fee, &weights))]
    pub fn initialize(ctx: Context<Initialize>, swap_fee: u16, weights: Vec<u16>, ticks: Vec<u64>) -> Result<()> {
        process_initialize(ctx, swap_fee, weights, ticks)
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
}
