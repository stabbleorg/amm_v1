use crate::state::*;
use anchor_lang::prelude::*;

pub fn process_change_swap_fee<'info>(ctx: Context<OwnerOnly<'info>>, new_swap_fee: u64) -> Result<()> {
    assert_ne!(ctx.accounts.pool.swap_fee, new_swap_fee);
    assert!(new_swap_fee >= Pool::MIN_SWAP_FEE);
    assert!(new_swap_fee <= Pool::MAX_SWAP_FEE);

    ctx.accounts.pool.swap_fee = new_swap_fee;

    ctx.accounts.pool.emit_updated_event();

    Ok(())
}

pub fn process_pause<'info>(ctx: Context<OwnerOnly<'info>>) -> Result<()> {
    assert!(ctx.accounts.pool.is_active);

    ctx.accounts.pool.is_active = false;

    ctx.accounts.pool.emit_updated_event();

    Ok(())
}

pub fn process_unpause<'info>(ctx: Context<OwnerOnly<'info>>) -> Result<()> {
    assert!(!ctx.accounts.pool.is_active);

    ctx.accounts.pool.is_active = true;

    ctx.accounts.pool.emit_updated_event();

    Ok(())
}

pub fn process_transfer_owner<'info>(ctx: Context<OwnerOnly<'info>>, new_owner: Pubkey) -> Result<()> {
    assert_ne!(ctx.accounts.pool.owner, new_owner);
    if ctx.accounts.pool.pending_owner.is_some() {
        assert_ne!(ctx.accounts.pool.pending_owner.unwrap(), new_owner);
    }

    ctx.accounts.pool.pending_owner = Some(new_owner);

    Ok(())
}

pub fn process_accept_owner<'info>(ctx: Context<PendingOwnerOnly<'info>>) -> Result<()> {
    ctx.accounts.pool.owner = ctx.accounts.pool.pending_owner.unwrap();
    ctx.accounts.pool.pending_owner = None;

    Ok(())
}

pub fn process_reject_owner<'info>(ctx: Context<PendingOwnerOnly<'info>>) -> Result<()> {
    ctx.accounts.pool.pending_owner = None;

    Ok(())
}

pub fn process_shutdown<'info>(ctx: Context<'_, '_, '_, 'info, OwnerOnly<'info>>) -> Result<()> {
    for token in ctx.accounts.pool.tokens.iter() {
        assert_eq!(token.balance, 0);
    }

    ctx.accounts.pool.close(ctx.remaining_accounts[0].to_account_info())
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

impl<'info> PendingOwnerOnly<'info> {
    pub fn validate(ctx: &Context<PendingOwnerOnly>) -> Result<()> {
        assert!(ctx.accounts.pool.pending_owner.is_some());
        assert_eq!(
            ctx.accounts.pending_owner.key(),
            ctx.accounts.pool.pending_owner.unwrap()
        );

        Ok(())
    }
}
