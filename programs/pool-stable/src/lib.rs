pub mod error;
pub mod located;
pub mod math;
pub mod processor;
pub mod state;

use crate::processor::*;
use anchor_lang::prelude::*;

#[cfg(feature = "development")]
declare_id!("BGJ7Ra51bCSLfJTzXXQsx6Mc8KYuzBnvG2JuUgkp454a");
#[cfg(not(feature = "development"))]
declare_id!("EeyyyuAXAzo3YuMv7REuHYtPzEssgK4oBeFYM8K9CoGM");

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
        process_swap(ctx, amount_in, minimum_amount_out)
    }
}
