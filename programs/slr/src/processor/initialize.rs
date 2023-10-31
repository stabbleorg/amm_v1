use crate::{constants::*, state::*};
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

pub fn process_initialize(ctx: Context<Initialize>, max_liquidity: u64) -> Result<()> {
    ctx.accounts.pool.set_inner(Pool {
        authority_bump: ctx.bumps.pool_authority,
        decimals: ctx.accounts.underlying_mint.decimals,
        mint: ctx.accounts.mint.key(),
        supply: 0,
        underlying_mint: ctx.accounts.underlying_mint.key(),
        liquidity: 0,
        reserved_liquidity: 0,
        locked_liquidity: 0,
        max_liquidity,
    });
    Ok(())
}

impl<'info> Initialize<'info> {
    pub fn validate(ctx: &Context<Initialize>) -> Result<()> {
        // uncomment it for devnet/mainnet deployment
        assert_eq!(ctx.accounts.admin.key(), admin::ID);
        assert_eq!(ctx.accounts.mint.supply, 0);
        assert_eq!(ctx.accounts.mint.decimals, ctx.accounts.underlying_mint.decimals);
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
    pub underlying_mint: Account<'info, Mint>,

    #[account(zero)]
    pub pool: Account<'info, Pool>,

    /// CHECK: OK
    #[account(seeds = [Pool::AUTHORITY_PREFIX, pool.key().as_ref()], bump)]
    pub pool_authority: UncheckedAccount<'info>,
}
