use crate::state::*;
use anchor_common::validate::*;
use anchor_lang::prelude::*;
use math::stable_math;

pub fn process_change_swap_fee(ctx: Context<OwnerOnly>, new_swap_fee: u64) -> Result<()> {
    assert_ne!(ctx.accounts.pool.swap_fee, new_swap_fee);
    assert!(new_swap_fee >= stable_math::MIN_SWAP_FEE);
    assert!(new_swap_fee <= stable_math::MAX_SWAP_FEE);

    ctx.accounts.pool.swap_fee = new_swap_fee;

    ctx.accounts.pool.emit_updated_event();

    Ok(())
}

pub fn process_pause(ctx: Context<OwnerOnly>) -> Result<()> {
    assert!(ctx.accounts.pool.is_active);

    ctx.accounts.pool.is_active = false;

    ctx.accounts.pool.emit_updated_event();

    Ok(())
}

pub fn process_unpause(ctx: Context<OwnerOnly>) -> Result<()> {
    assert!(!ctx.accounts.pool.is_active);

    ctx.accounts.pool.is_active = true;

    ctx.accounts.pool.emit_updated_event();

    Ok(())
}

pub fn process_transfer_owner(ctx: Context<OwnerOnly>, new_owner: &Pubkey) -> Result<()> {
    assert_ne!(ctx.accounts.pool.owner, new_owner.key());
    if ctx.accounts.pool.pending_owner.is_some() {
        assert_ne!(ctx.accounts.pool.pending_owner.unwrap(), new_owner.key());
    }

    ctx.accounts.pool.pending_owner = Some(new_owner.key());

    Ok(())
}

pub fn process_accept_owner(ctx: Context<PendingOwnerOnly>) -> Result<()> {
    ctx.accounts.pool.owner = ctx.accounts.pool.pending_owner.unwrap();
    ctx.accounts.pool.pending_owner = None;

    Ok(())
}

pub fn process_reject_owner(ctx: Context<PendingOwnerOnly>) -> Result<()> {
    ctx.accounts.pool.pending_owner = None;

    Ok(())
}

#[derive(Accounts)]
pub struct OwnerOnly<'info> {
    pub owner: Signer<'info>,

    #[account(mut, has_one = owner)]
    pub pool: Account<'info, Pool>,
}

#[derive(Accounts)]
pub struct PendingOwnerOnly<'info> {
    pub pending_owner: Signer<'info>,

    #[account(mut)]
    pub pool: Account<'info, Pool>,
}

impl<'info> Validate<'info> for PendingOwnerOnly<'info> {
    fn validate(&self) -> Result<()> {
        assert!(self.pool.pending_owner.is_some());
        assert_eq!(self.pending_owner.key(), self.pool.pending_owner.unwrap());

        Ok(())
    }
}
