use crate::state::*;
use anchor_lang::prelude::*;
use vault::state::Vault;

#[derive(Accounts)]
pub struct Initialize<'info> {
    pub admin: Signer<'info>,
    #[account(zero, rent_exempt = enforce)]
    pub pool: Account<'info, Pool>,
    /// CHECK: OK
    #[account(seeds = [Pool::AUTHORITY_PREFIX, vault.key().as_ref()], bump)]
    pub pool_authority: UncheckedAccount<'info>,
    pub vault: Account<'info, Vault>,
}

impl<'info> Initialize<'info> {
    pub fn validate(ctx: &Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

pub fn process_initialize(ctx: Context<Initialize>) -> Result<()> {
    Ok(())
}
