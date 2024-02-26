pub mod error;
pub mod located;
pub mod processor;
pub mod state;

pub use crate::processor::*;
use anchor_lang::prelude::*;

declare_id!("smpDKqHRt79KZPjWNC1UK5UWrrRv5avn9NqU6y2HJPT");

#[program]
pub mod pool_smart {
    use super::*;

    #[access_control(Initialize::validate(&ctx))]
    pub fn initialize(ctx: Context<Initialize>, max_liquidity: u64) -> Result<()> {
        process_initialize(ctx, max_liquidity)
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
