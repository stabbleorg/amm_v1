pub mod error;
pub mod instructions;
pub mod state;
pub mod x_token;

use crate::instructions::*;
use anchor_common::validate::*;
use anchor_lang::prelude::*;

declare_id!("vo1tWgqZMjG61Z2T9qUaMYKqZ75CYzMuaZ2LZP1n7HV");

#[program]
pub mod vault {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        withdraw_authority: Pubkey,
        withdraw_authority_bump: u8,
        beneficiary: Pubkey,
        beneficiary_fee: u64,
    ) -> Result<()> {
        process_initialize(
            ctx,
            &withdraw_authority,
            withdraw_authority_bump,
            &beneficiary,
            beneficiary_fee,
        )
    }

    pub fn withdraw<'a, 'b, 'c, 'info>(
        ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>,
        amount: u64,
        beneficiary_amount: u64,
    ) -> Result<()> {
        process_withdraw(ctx, amount, beneficiary_amount)
    }

    /* Configuration */

    pub fn change_beneficiary_fee(ctx: Context<AdminOnly>, new_beneficiary_fee: u64) -> Result<()> {
        process_change_beneficiary_fee(ctx, new_beneficiary_fee)
    }

    pub fn change_beneficiary(ctx: Context<AdminOnly>, new_beneficiary: Pubkey) -> Result<()> {
        process_change_beneficiary(ctx, &new_beneficiary)
    }

    pub fn pause(ctx: Context<AdminOnly>) -> Result<()> {
        process_pause(ctx)
    }

    pub fn unpause(ctx: Context<AdminOnly>) -> Result<()> {
        process_unpause(ctx)
    }

    pub fn transfer_admin(ctx: Context<AdminOnly>, new_admin: Pubkey) -> Result<()> {
        process_transfer_admin(ctx, &new_admin)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn accept_admin(ctx: Context<PendingAdminOnly>) -> Result<()> {
        process_accept_admin(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn reject_admin(ctx: Context<PendingAdminOnly>) -> Result<()> {
        process_reject_admin(ctx)
    }
}
