pub mod instructions;
pub mod located;
pub mod state;
pub mod x_token;

use crate::instructions::*;
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
            withdraw_authority,
            withdraw_authority_bump,
            beneficiary,
            beneficiary_fee,
        )
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        process_withdraw(ctx, amount)
    }

    pub fn change_beneficiary_fee<'info>(ctx: Context<AdminOnly<'info>>, new_beneficiary_fee: u64) -> Result<()> {
        process_change_beneficiary_fee(ctx, new_beneficiary_fee)
    }

    pub fn change_beneficiary<'info>(ctx: Context<AdminOnly<'info>>, new_beneficiary: Pubkey) -> Result<()> {
        process_change_beneficiary(ctx, new_beneficiary)
    }

    pub fn pause<'info>(ctx: Context<AdminOnly<'info>>) -> Result<()> {
        process_pause(ctx)
    }

    pub fn unpause<'info>(ctx: Context<AdminOnly<'info>>) -> Result<()> {
        process_unpause(ctx)
    }

    pub fn transfer_admin<'info>(ctx: Context<AdminOnly<'info>>, new_admin: Pubkey) -> Result<()> {
        process_transfer_admin(ctx, new_admin)
    }

    #[access_control(PendingAdminOnly::validate(&ctx))]
    pub fn accept_admin<'info>(ctx: Context<PendingAdminOnly<'info>>) -> Result<()> {
        process_accept_admin(ctx)
    }

    #[access_control(PendingAdminOnly::validate(&ctx))]
    pub fn reject_admin<'info>(ctx: Context<PendingAdminOnly<'info>>) -> Result<()> {
        process_reject_admin(ctx)
    }
}
