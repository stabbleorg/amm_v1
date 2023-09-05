use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub vault: Account<'info, Vault>,
    /// CHECK: OK
    #[account(seeds = [Vault::AUTHORITY_PREFIX, vault.key().as_ref()], bump = vault.authority_bump)]
    pub vault_authority: UncheckedAccount<'info>,
}

impl<'info> Deposit<'info> {
    pub fn validate(ctx: &Context<Deposit>) -> Result<()> {
        Ok(())
    }
}

pub fn process_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    Ok(())
}
