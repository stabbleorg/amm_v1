use crate::state::*;
use anchor_lang::prelude::*;

pub fn process_pause<'info>(ctx: Context<OwnerOnly<'info>>) -> Result<()> {
    ctx.accounts.pool.is_active = false;
    ctx.accounts.pool.emit_updated_event();
    Ok(())
}

pub fn process_unpause<'info>(ctx: Context<OwnerOnly<'info>>) -> Result<()> {
    ctx.accounts.pool.is_active = true;
    ctx.accounts.pool.emit_updated_event();
    Ok(())
}

pub fn process_change_swap_fee<'info>(ctx: Context<OwnerOnly<'info>>, new_swap_fee: u16) -> Result<()> {
    ctx.accounts.pool.swap_fee = new_swap_fee;
    ctx.accounts.pool.emit_updated_event();
    Ok(())
}

pub fn process_change_owner<'info>(ctx: Context<OwnerOnly<'info>>, new_owner: Pubkey) -> Result<()> {
    ctx.accounts.pool.owner = new_owner;
    ctx.accounts.pool.emit_updated_event();
    Ok(())
}

#[derive(Accounts)]
pub struct OwnerOnly<'info> {
    pub owner: Signer<'info>,

    #[account(mut, has_one = owner)]
    pub pool: Account<'info, Pool>,
}
