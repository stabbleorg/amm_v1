use crate::state::*;
use anchor_lang::prelude::*;
use vault::state::Vault;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, has_one = vault)]
    pub pool: Account<'info, Pool>,
    /// CHECK: OK
    #[account(seeds = [Pool::AUTHORITY_PREFIX, vault.key().as_ref()], bump = pool.authority_bump)]
    pub pool_authority: UncheckedAccount<'info>,
    pub vault: Account<'info, Vault>,
    /// CHECK: checked in vault program
    pub vault_authority: UncheckedAccount<'info>,
}

impl<'info> Withdraw<'info> {
    pub fn validate(ctx: &Context<Withdraw>) -> Result<()> {
        Ok(())
    }
}

pub fn process_withdraw(ctx: Context<Withdraw>, amount: u64, min_amounts_out: Vec<u64>) -> Result<()> {
    Ok(())
}
