use crate::state::*;
use anchor_common::validate::*;
use anchor_lang::prelude::*;
use math::fixed_math::ONE;

pub fn process_change_beneficiary_fee(ctx: Context<AdminOnly>, new_beneficiary_fee: u64) -> Result<()> {
    assert_ne!(ctx.accounts.vault.beneficiary_fee, new_beneficiary_fee);
    assert!(new_beneficiary_fee <= ONE);

    ctx.accounts.vault.beneficiary_fee = new_beneficiary_fee;

    ctx.accounts.vault.emit_updated_event();

    Ok(())
}

pub fn process_change_beneficiary(ctx: Context<AdminOnly>, new_beneficiary: &Pubkey) -> Result<()> {
    assert_ne!(ctx.accounts.vault.beneficiary, new_beneficiary.key());

    ctx.accounts.vault.beneficiary = new_beneficiary.key();

    Ok(())
}

pub fn process_pause(ctx: Context<AdminOnly>) -> Result<()> {
    assert!(ctx.accounts.vault.is_active);

    ctx.accounts.vault.is_active = false;

    ctx.accounts.vault.emit_updated_event();

    Ok(())
}

pub fn process_unpause(ctx: Context<AdminOnly>) -> Result<()> {
    assert!(!ctx.accounts.vault.is_active);

    ctx.accounts.vault.is_active = true;

    ctx.accounts.vault.emit_updated_event();

    Ok(())
}

pub fn process_transfer_admin(ctx: Context<AdminOnly>, new_admin: &Pubkey) -> Result<()> {
    assert_ne!(ctx.accounts.vault.admin, new_admin.key());
    if ctx.accounts.vault.pending_admin.is_some() {
        assert_ne!(ctx.accounts.vault.pending_admin.unwrap(), new_admin.key());
    }

    ctx.accounts.vault.pending_admin = Some(new_admin.key());

    Ok(())
}

pub fn process_accept_admin(ctx: Context<PendingAdminOnly>) -> Result<()> {
    ctx.accounts.vault.admin = ctx.accounts.vault.pending_admin.unwrap();
    ctx.accounts.vault.pending_admin = None;

    Ok(())
}

pub fn process_reject_admin(ctx: Context<PendingAdminOnly>) -> Result<()> {
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
