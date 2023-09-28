pub mod located;
pub mod processor;
pub mod state;

use crate::processor::*;
use anchor_lang::prelude::*;

declare_id!("7oh6tTdSfoWdKgqFXotGtPfS3Gqk6Jwc2yDZ7NCErYLW");

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

    pub fn assert_token_balance(ctx: Context<AssertTokenBalance>, min_balance: u64) -> Result<()> {
        process_assert_token_balance(ctx, min_balance)
    }
}
