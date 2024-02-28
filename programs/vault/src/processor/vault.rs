use crate::state::*;
use anchor_lang::prelude::*;

pub fn process_pause<'info>(ctx: Context<AdminOnly<'info>>) -> Result<()> {
    ctx.accounts.vault.is_active = false;
    Ok(())
}

pub fn process_unpause<'info>(ctx: Context<AdminOnly<'info>>) -> Result<()> {
    ctx.accounts.vault.is_active = true;
    Ok(())
}

pub fn process_change_beneficiary_fee<'info>(ctx: Context<AdminOnly<'info>>, new_beneficiary_fee: u16) -> Result<()> {
    ctx.accounts.vault.beneficiary_fee = new_beneficiary_fee;
    Ok(())
}

pub fn process_change_beneficiary<'info>(ctx: Context<AdminOnly<'info>>, new_beneficiary: Pubkey) -> Result<()> {
    ctx.accounts.vault.beneficiary = new_beneficiary;
    Ok(())
}

pub fn process_change_admin<'info>(ctx: Context<AdminOnly<'info>>, new_admin: Pubkey) -> Result<()> {
    ctx.accounts.vault.admin = new_admin;
    Ok(())
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    pub admin: Signer<'info>,

    #[account(mut, has_one = admin)]
    pub vault: Account<'info, Vault>,
}
