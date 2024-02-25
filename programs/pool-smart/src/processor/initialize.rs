use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use vault::state::Vault;

pub fn process_initialize(ctx: Context<Initialize>, max_liquidity: u64) -> Result<()> {
    ctx.accounts.pool.set_inner(Pool {
        vault: ctx.accounts.vault.key(),
        mint: ctx.accounts.mint.key(),
        quote_mint: ctx.accounts.quote_mint.key(),
        decimals: ctx.accounts.quote_mint.decimals,
        liquidity: 0,
        max_liquidity,
        is_active: true,
        authority_bump: ctx.bumps.pool_authority,
    });
    Ok(())
}

impl<'info> Initialize<'info> {
    pub fn validate(ctx: &Context<Initialize>) -> Result<()> {
        assert_eq!(ctx.accounts.mint.supply, 0);
        assert_eq!(ctx.accounts.mint.decimals, ctx.accounts.quote_mint.decimals);
        assert_eq!(
            ctx.accounts.mint.mint_authority.unwrap(),
            ctx.accounts.pool_authority.key()
        );
        assert!(ctx.accounts.mint.freeze_authority.is_none());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    pub admin: Signer<'info>,

    pub mint: Account<'info, Mint>,
    pub quote_mint: Account<'info, Mint>,

    #[account(zero)]
    pub pool: Account<'info, Pool>,
    /// CHECK: OK
    #[account(seeds = [Pool::AUTHORITY_PREFIX, pool.key().as_ref()], bump)]
    pub pool_authority: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(seeds = [Vault::WITHDRAW_AUTHORITY_PREFIX, vault.key().as_ref()], bump = vault.withdraw_authority_bump)]
    pub withdraw_authority: UncheckedAccount<'info>,

    #[account(has_one = admin, has_one = withdraw_authority)]
    pub vault: Account<'info, Vault>,
}
