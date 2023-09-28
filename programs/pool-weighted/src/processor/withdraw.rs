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

pub fn process_withdraw<'a, 'b, 'c, 'info>(
    ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>,
    amount: u64,
    min_amounts_out: Vec<u64>,
) -> Result<()> {
    let amounts_out = if ctx.remaining_accounts.len() == 2 {
        let mint = get_token_mint(&ctx.remaining_accounts[0])?;
        let amount_out = math::calc_token_out_exact_in(
            ctx.accounts.pool.get_balance(mint),
            ctx.accounts.pool.get_normalized_weight(mint),
            amount as f64 / Pool::UNIT_BALANCE,
            ctx.accounts.mint.supply as f64 / Pool::UNIT_BALANCE,
            ctx.accounts.pool.get_swap_fee(),
        )?;
        let amount_out = u64::try_from((amount_out * ctx.accounts.pool.get_multiplier(mint)) as u128).unwrap();
        assert!(amount_out >= min_amounts_out[0]); // slippage
        vec![amount_out]
    } else {
        let amounts_out = math::calc_tokens_out_exact_in(
            ctx.accounts.pool.get_balances(),
            amount as f64 / Pool::UNIT_BALANCE,
            ctx.accounts.mint.supply as f64 / Pool::UNIT_BALANCE,
        )?;
        amounts_out
            .iter()
            .enumerate()
            .map(|(token_index, &amount_out)| {
                let amount_out =
                    u64::try_from((amount_out * ctx.accounts.pool.tokens[token_index].multiplier as f64) as u128)
                        .unwrap();
                assert!(amount_out >= min_amounts_out[token_index]); // slippage
                amount_out
            })
            .collect()
    };

    for (token_index, user_account) in ctx.remaining_accounts[0..amounts_out.len()].iter().enumerate() {
        let mint = get_token_mint(&user_account)?;
        if ctx.remaining_accounts.len() > 2 {
            // check token orders
            assert_eq!(ctx.accounts.pool.tokens[token_index].mint, mint);
        }
        // remove token balances
        ctx.accounts.pool.tokens[token_index].balance = ctx.accounts.pool.tokens[token_index]
            .balance
            .checked_sub(
                amounts_out[token_index]
                    .checked_mul(ctx.accounts.pool.tokens[token_index].scaling_factor as u64)
                    .unwrap(),
            )
            .unwrap();

        let vault_account = &ctx.remaining_accounts[token_index + amounts_out.len()];
        ctx.accounts.vault.withdraw_authority_seeds(|signer_seed| {
            withdraw_vault(
                CpiContext::new(
                    ctx.accounts.vault_program.to_account_info(),
                    WithdrawVault {
                        withdraw_authority: ctx.accounts.withdraw_authority.to_account_info(),
                        vault: ctx.accounts.vault.to_account_info(),
                        vault_authority: ctx.accounts.vault_authority.to_account_info(),
                        vault_token: vault_account.clone(),
                        dest_token: user_account.clone(),
                        token_program: ctx.accounts.token_program.to_account_info(),
                    },
                )
                .with_signer(&[signer_seed]),
                amounts_out[token_index],
            )
        })?;
    }

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

    /// CHECK: checked in vault program
    pub withdraw_authority: UncheckedAccount<'info>,

    pub vault: Account<'info, Vault>,
    /// CHECK: checked in vault program
    pub vault_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub vault_program: Program<'info, VaultProgram>,
}
