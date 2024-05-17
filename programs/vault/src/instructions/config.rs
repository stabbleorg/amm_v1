use crate::state::*;
use anchor_common::validate::*;
use anchor_lang::prelude::*;

pub fn process_change_beneficiary_fee<'info>(ctx: Context<AdminOnly<'info>>, new_beneficiary_fee: u64) -> Result<()> {
    assert_ne!(ctx.accounts.vault.beneficiary_fee, new_beneficiary_fee);

    ctx.accounts.vault.beneficiary_fee = new_beneficiary_fee;

    ctx.accounts.vault.emit_updated_event();

    Ok(())
}

pub fn process_change_beneficiary<'info>(ctx: Context<AdminOnly<'info>>, new_beneficiary: Pubkey) -> Result<()> {
    assert_ne!(ctx.accounts.vault.beneficiary, new_beneficiary);

    ctx.accounts.vault.beneficiary = new_beneficiary;

    Ok(())
}

pub fn process_pause<'info>(ctx: Context<AdminOnly<'info>>) -> Result<()> {
    assert!(ctx.accounts.vault.is_active);

    ctx.accounts.vault.is_active = false;

    ctx.accounts.vault.emit_updated_event();

    Ok(())
}

pub fn process_unpause<'info>(ctx: Context<AdminOnly<'info>>) -> Result<()> {
    assert!(!ctx.accounts.vault.is_active);

    ctx.accounts.vault.is_active = true;

    ctx.accounts.vault.emit_updated_event();

    Ok(())
}

pub fn process_transfer_admin<'info>(ctx: Context<AdminOnly<'info>>, new_admin: Pubkey) -> Result<()> {
    assert_ne!(ctx.accounts.vault.admin, new_admin);
    if ctx.accounts.vault.pending_admin.is_some() {
        assert_ne!(ctx.accounts.vault.pending_admin.unwrap(), new_admin);
    }

    ctx.accounts.vault.pending_admin = Some(new_admin);

    Ok(())
}

pub fn process_accept_admin<'info>(ctx: Context<PendingAdminOnly<'info>>) -> Result<()> {
    ctx.accounts.vault.admin = ctx.accounts.vault.pending_admin.unwrap();
    ctx.accounts.vault.pending_admin = None;

    Ok(())
}

pub fn process_reject_admin<'info>(ctx: Context<PendingAdminOnly<'info>>) -> Result<()> {
    ctx.accounts.vault.pending_admin = None;

    Ok(())
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    pub admin: Signer<'info>,

    #[account(mut, has_one = admin)]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct PendingAdminOnly<'info> {
    pub pending_admin: Signer<'info>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,
}

impl<'info> Validate<'info> for PendingAdminOnly<'info> {
    fn validate(&self) -> Result<()> {
        assert!(self.vault.pending_admin.is_some());
        assert_eq!(self.pending_admin.key(), self.vault.pending_admin.unwrap());

        Ok(())
    }
}
