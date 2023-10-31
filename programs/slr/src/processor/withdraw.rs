use crate::{constants::*, state::*};
use anchor_lang::prelude::*;
use anchor_spl::token::{burn, transfer, Burn, Mint, Token, TokenAccount, Transfer};

pub fn process_withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let amount_out = ctx.accounts.pool.calc_amount_out(ctx.accounts.mint.supply, amount);
    ctx.accounts.pool.liquidity = ctx.accounts.pool.liquidity.checked_sub(amount_out).unwrap();

    burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.pool_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;

    ctx.accounts.mint.reload()?;
    ctx.accounts.pool.supply = ctx.accounts.mint.supply;

    vault::authority_seeds(|signer_seed| {
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_underlying_token.to_account_info(),
                    to: ctx.accounts.user_underlying_token.to_account_info(),
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
        assert_eq!(
            ctx.accounts.vault_underlying_token.mint,
            ctx.accounts.pool.underlying_mint
        );
        assert_eq!(ctx.accounts.vault_authority.key(), vault::ID);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
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
    pub vault_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}
