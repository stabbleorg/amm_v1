pub mod error;
pub mod instructions;
pub mod located;
pub mod state;

pub use crate::instructions::*;
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

    pub fn pause<'info>(ctx: Context<AdminOnly<'info>>) -> Result<()> {
        process_pause(ctx)
    }

    pub fn unpause<'info>(ctx: Context<AdminOnly<'info>>) -> Result<()> {
        process_unpause(ctx)
    }

    pub fn change_max_liquidity<'info>(ctx: Context<AdminOnly<'info>>, new_max_liquidity: u64) -> Result<()> {
        process_change_max_liquidity(ctx, new_max_liquidity)
    }

    pub fn close<'a, 'b, 'c, 'info>(ctx: Context<'_, '_, '_, 'info, AdminOnly<'info>>) -> Result<()> {
        process_close(ctx)
    }
}
