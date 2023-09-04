use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;
use vault::state::Vault;

#[derive(Accounts)]
pub struct Swap<'info> {
    pub token_in: Account<'info, TokenAccount>,
    pub token_out: Account<'info, TokenAccount>,
    #[account(mut, has_one = vault)]
    pub pool: Account<'info, Pool>,
    /// CHECK: OK
    #[account(seeds = [Pool::AUTHORITY_PREFIX, vault.key().as_ref()], bump = pool.authority_bump)]
    pub pool_authority: UncheckedAccount<'info>,
    pub vault: Account<'info, Vault>,
    /// CHECK: checked in vault program
    pub vault_authority: UncheckedAccount<'info>,
}

impl<'info> Swap<'info> {
    pub fn validate(ctx: &Context<Swap>) -> Result<()> {
        Ok(())
    }
}

pub fn process_swap(ctx: Context<Swap>, amount_in: u64, min_amount_out: u64) -> Result<()> {
    Ok(())
}
