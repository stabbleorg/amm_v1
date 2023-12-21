pub mod located;
pub mod processor;
pub mod state;

use crate::processor::*;
use anchor_lang::prelude::*;

#[cfg(feature = "development")]
declare_id!("7oh6tTdSfoWdKgqFXotGtPfS3Gqk6Jwc2yDZ7NCErYLW");
#[cfg(not(feature = "development"))]
declare_id!("6sTpp3Z7s4YSWgxuibjhE8tvcywhRc8a5FYfuv6vhuQA");

#[program]
pub mod vault {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        withdraw_authority: Pubkey,
        withdraw_authority_bump: u8,
        beneficiary: Pubkey,
        beneficiary_fee: u16,
    ) -> Result<()> {
        process_initialize(
            ctx,
            withdraw_authority,
            withdraw_authority_bump,
            beneficiary,
            beneficiary_fee,
        )
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        process_withdraw(ctx, amount)
    }
}
