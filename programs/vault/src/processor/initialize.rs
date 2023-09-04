use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    pub admin: Signer<'info>,
    #[account(zero, rent_exempt = enforce)]
    pub vault: Account<'info, Vault>,
    /// CHECK: OK
    #[account(seeds = [Vault::AUTHORITY_PREFIX, vault.key().as_ref()], bump)]
    pub vault_authority: UncheckedAccount<'info>,
}

impl<'info> Initialize<'info> {
    pub fn validate(ctx: &Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

pub fn process_initialize(ctx: Context<Initialize>) -> Result<()> {
    Ok(())
}
