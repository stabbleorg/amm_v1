use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{burn, transfer, Burn, Mint, Token, TokenAccount, Transfer};

pub fn process_withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
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
    )?;

    let amount_out = ctx.accounts.pool.calc_amount_out(ctx.accounts.mint.supply, amount);
    ctx.accounts.pool.liquidity = ctx.accounts.pool.liquidity - amount_out;

    ctx.accounts.pool.emit_updated_event();

    ctx.accounts.vault.authority_seeds(|signer_seed| {
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_quote_token.to_account_info(),
                    to: ctx.accounts.user_quote_token.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            amount_out,
        )
    })
}

impl<'info> Withdraw<'info> {
    pub fn validate(ctx: &Context<Withdraw>) -> Result<()> {
        assert!(ctx.accounts.vault.is_active);

        assert_eq!(ctx.accounts.vault_quote_token.mint, ctx.accounts.pool.quote_mint);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
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

    pub vault: Account<'info, Vault>,
    /// CHECK: OK
    #[account(seeds = [Vault::AUTHORITY_PREFIX, vault.key().as_ref()], bump = vault.authority_bump)]
    pub vault_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}
