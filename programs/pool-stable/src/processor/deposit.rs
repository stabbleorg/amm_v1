use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{
    accessor::{authority as get_token_owner, mint as get_token_mint},
    mint_to, transfer, Mint, MintTo, Token, TokenAccount, Transfer,
};
use math::{bn::*, stable_math, uint256};
use vault::{state::Vault, ID as VAULT_PROGRAM_ID};

pub fn process_deposit<'a, 'b, 'c, 'info>(
    ctx: Context<'_, '_, '_, 'info, Deposit<'info>>,
    amounts: Vec<u64>,
    minimum_amount_out: u64,
) -> Result<()> {
    let pool_token_supply = uint256!(ctx.accounts.mint.supply);
    let num_tokens = amounts.len();
    let amplification = ctx.accounts.pool.get_amplification();
    let scaling_factors = ctx.accounts.pool.get_scaling_factors();

    let amount_out = if pool_token_supply == U256::zero() {
        assert_eq!(ctx.accounts.user.key(), ctx.accounts.pool.owner);

        // initial liquidity
        stable_math::calc_invariant(
            amplification,
            &amounts
                .iter()
                .enumerate()
                .map(|(token_index, &amount)| uint256!(amount).checked_mul(scaling_factors[token_index]).unwrap())
                .collect(),
        )
        .unwrap()
    } else {
        let balances = ctx.accounts.pool.get_balances();
        let swap_fee = ctx.accounts.pool.get_swap_fee();
        let current_invariant = stable_math::calc_invariant(amplification, &balances).unwrap();

        // do_join
        if num_tokens == 1 {
            let mint = get_token_mint(&ctx.remaining_accounts[0])?;
            let token_index = ctx.accounts.pool.get_token_index(mint);
            stable_math::calc_pool_token_out_given_exact_tokens_in(
                amplification,
                &balances,
                ctx.accounts
                    .pool
                    .tokens
                    .iter()
                    .enumerate()
                    .map(|(index, _)| {
                        if token_index == index {
                            (uint256!(amounts[0]))
                                .checked_mul(scaling_factors[token_index])
                                .unwrap()
                        } else {
                            U256::zero()
                        }
                    })
                    .collect(),
                pool_token_supply,
                current_invariant,
                swap_fee,
            )
            .unwrap()
        } else {
            stable_math::calc_pool_token_out_given_exact_tokens_in(
                amplification,
                &balances,
                amounts
                    .iter()
                    .enumerate()
                    .map(|(token_index, &amount)| (uint256!(amount)).checked_mul(scaling_factors[token_index]).unwrap())
                    .collect(),
                pool_token_supply,
                current_invariant,
                swap_fee,
            )
            .unwrap()
        }
    };

    let amount_out = amount_out.as_u64();
    assert!(amount_out >= minimum_amount_out); // check slippage

    for (token_index, user_account) in ctx.remaining_accounts[0..num_tokens].iter().enumerate() {
        let mint = get_token_mint(&user_account)?;
        let token_in_index = if num_tokens > 1 {
            // check token orders
            assert_eq!(ctx.accounts.pool.tokens[token_index].mint, mint);
            token_index
        } else {
            ctx.accounts.pool.get_token_index(mint)
        };

        let balance_in = amounts[token_index]
            .checked_mul(ctx.accounts.pool.tokens[token_in_index].scaling_factor)
            .unwrap();
        // add token balances
        ctx.accounts.pool.tokens[token_in_index].balance = ctx.accounts.pool.tokens[token_in_index]
            .balance
            .checked_add(balance_in)
            .unwrap();

        let vault_account = &ctx.remaining_accounts[token_index + num_tokens];
        // check vault token owner
        assert_eq!(get_token_owner(vault_account)?, ctx.accounts.vault_authority.key());
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: user_account.to_account_info(),
                    to: vault_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amounts[token_index],
        )?;
    }

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

        let num_tokens = amounts.len();
        assert_ne!(num_tokens, 0);
        assert_eq!(ctx.remaining_accounts.len(), num_tokens << 1); // amounts.len() * 2
        if num_tokens > 1 {
            assert_eq!(num_tokens, ctx.accounts.pool.tokens.len());
        }

        assert_eq!(ctx.accounts.user_pool_token.owner, ctx.accounts.user.key());

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
