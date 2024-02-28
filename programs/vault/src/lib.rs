pub mod located;
pub mod processor;
pub mod state;

use crate::processor::*;
use anchor_lang::prelude::*;

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

    pub fn pause<'info>(ctx: Context<AdminOnly<'info>>) -> Result<()> {
        process_pause(ctx)
    }

    pub fn unpause<'info>(ctx: Context<AdminOnly<'info>>) -> Result<()> {
        process_unpause(ctx)
    }

    pub fn change_beneficiary_fee<'info>(ctx: Context<AdminOnly<'info>>, new_beneficiary_fee: u16) -> Result<()> {
        process_change_beneficiary_fee(ctx, new_beneficiary_fee)
    }

    pub fn change_beneficiary<'info>(ctx: Context<AdminOnly<'info>>, new_beneficiary: Pubkey) -> Result<()> {
        process_change_beneficiary(ctx, new_beneficiary)
    }

    pub fn change_admin<'info>(ctx: Context<AdminOnly<'info>>, new_admin: Pubkey) -> Result<()> {
        process_change_admin(ctx, new_admin)
    }
}
