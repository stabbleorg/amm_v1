use crate::{math, state::*};
use anchor_lang::prelude::*;
use anchor_spl::token::{
    accessor::mint as get_token_mint,
    {burn, Burn, Mint, Token, TokenAccount},
};
use vault::{
    cpi::{accounts::Withdraw as WithdrawVault, withdraw as withdraw_vault},
    program::Vault as VaultProgram,
    state::{Vault, WithdrawAuthority},
};

pub fn process_withdraw(ctx: Context<Withdraw>, amount: u64, min_amounts_out: Vec<u64>) -> Result<()> {
    // todo

    ctx.accounts.pool.emit_updated_event();
    burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.user_pool_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )
}

impl<'info> Withdraw<'info> {
    pub fn validate(ctx: &Context<Withdraw>) -> Result<()> {
        assert!(ctx.accounts.vault.is_active);
        assert!(ctx.accounts.pool.is_active);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub user: Signer<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub user_pool_token: Account<'info, TokenAccount>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut, has_one = vault)]
    pub pool: Account<'info, Pool>,
    /// CHECK: OK
    #[account(seeds = [Pool::AUTHORITY_PREFIX, pool.key().as_ref()], bump = pool.authority_bump)]
    pub pool_authority: UncheckedAccount<'info>,

    /// CHECK: OK
    pub withdraw_authority: UncheckedAccount<'info>,

    #[account(has_one = withdraw_authority)]
    pub vault: Account<'info, Vault>,
    /// CHECK: checked in vault program
    pub vault_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub vault_program: Program<'info, VaultProgram>,
}
