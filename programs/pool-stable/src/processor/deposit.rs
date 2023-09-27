use crate::{math, state::*};
use anchor_lang::prelude::*;
use anchor_spl::token::{
    accessor::{authority as get_token_owner, mint as get_token_mint},
    mint_to, transfer, Mint, MintTo, Token, TokenAccount, Transfer,
};
use vault::{state::Vault, ID as VAULT_PROGRAM_ID};

pub fn process_deposit<'a, 'b, 'c, 'info>(
    ctx: Context<'_, '_, '_, 'info, Deposit<'info>>,
    amounts: Vec<u64>,
    min_amount_out: u64,
) -> Result<()> {
    for (token_index, user_account) in ctx.remaining_accounts[0..amounts.len()].iter().enumerate() {
        let mint = get_token_mint(&user_account)?;
        if amounts.len() > 1 {
            // check token orders
            assert_eq!(ctx.accounts.pool.tokens[token_index].mint, mint);
        }
        // add token balances
        ctx.accounts.pool.tokens[token_index].balance = amounts[token_index]
            .checked_mul(ctx.accounts.pool.tokens[token_index].scaling_factor as u64)
            .unwrap()
            .checked_add(ctx.accounts.pool.tokens[token_index].balance)
            .unwrap();

        let vault_account = &ctx.remaining_accounts[token_index + amounts.len()];
        // check vault token owner
        assert_eq!(get_token_owner(vault_account)?, ctx.accounts.vault_authority.key());
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: user_account.clone(),
                    to: vault_account.clone(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amounts[token_index],
        )?;
    }

    let amount_out = if ctx.accounts.pool.invariant == 0 {
        assert_eq!(ctx.accounts.user.key(), ctx.accounts.pool.owner);
        // initial liquidity
        math::calc_invariant(ctx.accounts.pool.get_amplification(), ctx.accounts.pool.get_balances())?
    } else {
        // todo do_join
        0
    };
    let amount_out = u64::try_from(amount_out).unwrap();
    assert!(amount_out >= min_amount_out); // slippage

    ctx.accounts.pool.invariant = amount_out;

    ctx.accounts.pool.emit_updated_event();
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
            amount_out,
        )
    })
}

impl<'info> Deposit<'info> {
    pub fn validate(ctx: &Context<Deposit>, amounts: &Vec<u64>) -> Result<()> {
        assert!(ctx.accounts.vault.is_active);
        assert!(ctx.accounts.pool.is_active);
        assert_eq!(ctx.accounts.user_pool_token.owner, ctx.accounts.user.key());
        assert_eq!(ctx.remaining_accounts.len(), amounts.len() << 1); // amounts.len() * 2
        assert_ne!(amounts.len(), 0);
        if amounts.len() > 1 {
            assert_eq!(amounts.len(), ctx.accounts.pool.tokens.len());
        }
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub user: Signer<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub user_pool_token: Account<'info, TokenAccount>,

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
