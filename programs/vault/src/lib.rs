pub mod processor;
pub mod state;

use crate::processor::*;
use anchor_lang::prelude::*;

declare_id!("359c376ustKUBAy8ZJdjyRub9Kf7W4LHxxahXP8P9LEW");

#[program]
pub mod vault {
    use super::*;

    #[access_control(Initialize::validate(&ctx))]
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        process_initialize(ctx)
    }

    #[access_control(Deposit::validate(&ctx))]
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        process_deposit(ctx, amount)
    }

    #[access_control(Withdraw::validate(&ctx))]
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        process_withdraw(ctx, amount)
    }
}
