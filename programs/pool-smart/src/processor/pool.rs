use crate::state::*;
use anchor_lang::prelude::*;
use vault::state::Vault;

pub fn process_pause<'info>(ctx: Context<AdminOnly<'info>>) -> Result<()> {
    ctx.accounts.pool.is_active = false;
    ctx.accounts.pool.emit_updated_event();
    Ok(())
}

pub fn process_unpause<'info>(ctx: Context<AdminOnly<'info>>) -> Result<()> {
    ctx.accounts.pool.is_active = true;
    ctx.accounts.pool.emit_updated_event();
    Ok(())
}

pub fn process_change_max_liquidity<'info>(ctx: Context<AdminOnly<'info>>, new_max_liquidity: u64) -> Result<()> {
    ctx.accounts.pool.max_liquidity = new_max_liquidity;
    ctx.accounts.pool.emit_updated_event();
    Ok(())
}

pub fn process_close<'info>(ctx: Context<'_, '_, '_, 'info, AdminOnly<'info>>) -> Result<()> {
    assert_eq!(ctx.accounts.pool.liquidity, 0);
    ctx.accounts.pool.close(ctx.remaining_accounts[0].to_account_info())
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    pub admin: Signer<'info>,

    #[account(mut, has_one = vault)]
    pub pool: Account<'info, Pool>,

    #[account(has_one = admin)]
    pub vault: Account<'info, Vault>,
}
