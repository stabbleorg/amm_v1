pub mod error;
pub mod located;
pub mod processor;
pub mod state;

pub use crate::processor::*;
use anchor_lang::prelude::*;

#[cfg(feature = "development")]
declare_id!("88eN7xkpWwyCrtVAuhuKtVLkmuSEFv6MgTkpAodvpd31");
#[cfg(not(feature = "development"))]
declare_id!("FtmRXo2x8Re3PrzLebm7dqNKPoYSnXYBzU9toXeKCvAw");

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
