use crate::{error::*, state::*};
use anchor_lang::prelude::*;
use anchor_spl::token::{mint_to, transfer, Mint, MintTo, Token, TokenAccount, Transfer};
use vault::{state::Vault, ID as VAULT_PROGRAM_ID};

pub fn process_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    ctx.accounts.pool.liquidity = ctx.accounts.pool.liquidity.checked_add(amount).unwrap();
    require!(
        ctx.accounts.pool.liquidity <= ctx.accounts.pool.max_liquidity,
        CustomError::MaxLiquidityExceeded
    );

    ctx.accounts.pool.authority_seeds(|signer_seed| {
        mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.user_pool_token.to_account_info(),
                    authority: ctx.accounts.pool_authority.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            ctx.accounts.pool.calc_new_supply(ctx.accounts.mint.supply, amount),
        )
    })?;

    ctx.accounts.pool.emit_updated_event();

    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_quote_token.to_account_info(),
                to: ctx.accounts.vault_quote_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )
}

impl<'info> Deposit<'info> {
    pub fn validate(ctx: &Context<Deposit>) -> Result<()> {
        assert!(ctx.accounts.vault.is_active);
        assert!(ctx.accounts.pool.is_active);
        assert_eq!(ctx.accounts.vault_quote_token.mint, ctx.accounts.pool.quote_mint);
        assert_eq!(ctx.accounts.vault_quote_token.owner, ctx.accounts.vault_authority.key());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub user: Signer<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub user_pool_token: UncheckedAccount<'info>,
    /// CHECK: OK
    #[account(mut)]
    pub user_quote_token: UncheckedAccount<'info>,
    #[account(mut)]
    pub vault_quote_token: Account<'info, TokenAccount>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut, has_one = vault, has_one = mint)]
    pub pool: Account<'info, Pool>,
    /// CHECK: OK
    #[account(seeds = [Pool::AUTHORITY_PREFIX, pool.key().as_ref()], bump = pool.authority_bump)]
    pub pool_authority: UncheckedAccount<'info>,

    pub vault: Account<'info, Vault>,
    /// CHECK: OK
    #[account(seeds = [Vault::AUTHORITY_PREFIX, vault.key().as_ref()], bump = vault.authority_bump, seeds::program = VAULT_PROGRAM_ID)]
    pub vault_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}
