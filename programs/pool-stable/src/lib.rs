pub mod processor;
pub mod state;

use crate::processor::*;
use anchor_lang::prelude::*;

declare_id!("99TTqzz6CLm1NNjUAbvePk9L2FHSrht53RVaZCWCLryE");

#[program]
pub mod pool_stable {
    use super::*;

    /// initialize a pool
    #[access_control(Initialize::validate(&ctx))]
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        process_initialize(ctx)
    }

    /// add liquidity
    #[access_control(Deposit::validate(&ctx))]
    pub fn deposit(ctx: Context<Deposit>, amounts: Vec<u64>, min_amount_out: u64) -> Result<()> {
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

    /// check slippage tolerance for batch swap
    /// should be appended at the end of swap instructions for batch swap transaction
    pub fn assert_batch_swap(
        ctx: Context<AssertBatchSwap>,
        amount_in: u64,      // token_in balance before swap
        min_amount_out: u64, // min_amount_out expected after batch swap
    ) -> Result<()> {
        process_assert_batch_swap(ctx, amount_in, min_amount_out)
    }
}
