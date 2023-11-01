use crate::{constants::*, error::*, state::*};
use anchor_lang::prelude::*;
use anchor_spl::token::{mint_to, transfer, Mint, MintTo, Token, TokenAccount, Transfer};

pub fn process_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    ctx.accounts.pool.authority_seeds(|signer_seed| {
        mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.pool_token.to_account_info(),
                    authority: ctx.accounts.pool_authority.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            ctx.accounts.pool.calc_new_supply(ctx.accounts.mint.supply, amount),
        )
    })?;

    ctx.accounts.mint.reload()?;
    ctx.accounts.pool.supply = ctx.accounts.mint.supply;
    ctx.accounts.pool.liquidity = ctx.accounts.pool.liquidity.checked_add(amount).unwrap();
    require!(
        ctx.accounts.pool.liquidity <= ctx.accounts.pool.max_liquidity,
        CustomError::MaxLiquidityExceeded
    );

    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_underlying_token.to_account_info(),
                to: ctx.accounts.vault_underlying_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )
}

impl<'info> Deposit<'info> {
    pub fn validate(ctx: &Context<Deposit>) -> Result<()> {
        assert_eq!(
            ctx.accounts.vault_underlying_token.mint,
            ctx.accounts.pool.underlying_mint
        );
        assert_eq!(ctx.accounts.vault_underlying_token.owner, vault::ID);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub user: Signer<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub user_underlying_token: UncheckedAccount<'info>,
    #[account(mut)]
    pub vault_underlying_token: Account<'info, TokenAccount>,
    /// CHECK: OK
    #[account(mut)]
    pub pool_token: UncheckedAccount<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut, has_one = mint)]
    pub pool: Account<'info, Pool>,

    /// CHECK: OK
    #[account(seeds = [Pool::AUTHORITY_PREFIX, pool.key().as_ref()], bump = pool.authority_bump)]
    pub pool_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}
