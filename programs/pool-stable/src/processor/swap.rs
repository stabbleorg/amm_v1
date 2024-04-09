use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Token, TokenAccount, Transfer};
use math::{bn::*, stable_math, uint256};
use vault::{
    cpi::{accounts::Withdraw as WithdrawVault, withdraw as withdraw_vault},
    program::Vault as VaultProgram,
    state::{Vault, WithdrawAuthority},
};

pub fn process_swap(ctx: Context<Swap>, amount_in: u64, minimum_amount_out: u64) -> Result<()> {
    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_in.to_account_info(),
                to: ctx.accounts.vault_token_in.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount_in,
    )?;

    let amplification = ctx.accounts.pool.get_amplification();
    let balances = ctx.accounts.pool.get_balances();
    let scaling_factors = ctx.accounts.pool.get_scaling_factors();
    let current_invariant = stable_math::calc_invariant(amplification, balances.clone()).unwrap();

    let token_in_index = ctx.accounts.pool.get_token_index(ctx.accounts.vault_token_in.mint);
    let token_out_index = ctx
        .accounts
        .pool
        .get_token_index(ctx.accounts.beneficiary_token_out.mint);
    let balance_in = uint256!(amount_in)
        .checked_mul(scaling_factors[token_in_index])
        .unwrap();
    let balance_out_without_fee = stable_math::calc_out_given_in(
        amplification,
        balances,
        token_in_index,
        token_out_index,
        balance_in,
        current_invariant,
    )
    .unwrap();

    let amount_out_without_fee = balance_out_without_fee
        .div_down(scaling_factors[token_out_index])
        .unwrap()
        .as_u64();
    let amount_out = (stable_math::FEE_PRECISION.saturating_sub(ctx.accounts.pool.swap_fee))
        .mul_div_down(amount_out_without_fee, stable_math::FEE_PRECISION)
        .unwrap();
    assert!(amount_out >= minimum_amount_out); // check slippage

    let swap_fee_amount = amount_out_without_fee.checked_sub(amount_out).unwrap();
    let beneficiary_fee_amount = (swap_fee_amount)
        .mul_div_down(ctx.accounts.vault.beneficiary_fee, stable_math::FEE_PRECISION)
        .unwrap();

    // add in token balance
    ctx.accounts.pool.tokens[token_in_index].balance = ctx.accounts.pool.tokens[token_in_index]
        .balance
        .checked_add(balance_in.as_u64())
        .unwrap();
    // remove out token balance
    let balance_out = amount_out
        .checked_add(beneficiary_fee_amount)
        .unwrap()
        .checked_mul(ctx.accounts.pool.tokens[token_out_index].scaling_factor)
        .unwrap();
    ctx.accounts.pool.tokens[token_out_index].balance = ctx.accounts.pool.tokens[token_out_index]
        .balance
        .checked_sub(balance_out)
        .unwrap();

    ctx.accounts.pool.emit_updated_event();

    ctx.accounts.vault.withdraw_authority_seeds(|signer_seed| {
        if beneficiary_fee_amount > 0 {
            // transfer to beneficiary
            withdraw_vault(
                CpiContext::new(
                    ctx.accounts.vault_program.to_account_info(),
                    WithdrawVault {
                        withdraw_authority: ctx.accounts.withdraw_authority.to_account_info(),
                        vault: ctx.accounts.vault.to_account_info(),
                        vault_authority: ctx.accounts.vault_authority.to_account_info(),
                        vault_token: ctx.accounts.vault_token_out.to_account_info(),
                        dest_token: ctx.accounts.beneficiary_token_out.to_account_info(),
                        token_program: ctx.accounts.token_program.to_account_info(),
                    },
                )
                .with_signer(&[signer_seed]),
                beneficiary_fee_amount,
            )?;
        }

        // transfer to user
        withdraw_vault(
            CpiContext::new(
                ctx.accounts.vault_program.to_account_info(),
                WithdrawVault {
                    withdraw_authority: ctx.accounts.withdraw_authority.to_account_info(),
                    vault: ctx.accounts.vault.to_account_info(),
                    vault_authority: ctx.accounts.vault_authority.to_account_info(),
                    vault_token: ctx.accounts.vault_token_out.to_account_info(),
                    dest_token: ctx.accounts.user_token_out.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            amount_out,
        )
    })
}

impl<'info> Swap<'info> {
    pub fn validate(ctx: &Context<Swap>) -> Result<()> {
        assert!(ctx.accounts.vault.is_active);

        assert!(ctx.accounts.pool.is_active);

        assert_eq!(ctx.accounts.vault_token_in.owner, ctx.accounts.vault_authority.key());
        assert_eq!(ctx.accounts.beneficiary_token_out.owner, ctx.accounts.vault.beneficiary);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Swap<'info> {
    pub user: Signer<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub user_token_in: UncheckedAccount<'info>,
    /// CHECK: OK
    #[account(mut)]
    pub user_token_out: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub vault_token_in: Account<'info, TokenAccount>,
    /// CHECK: OK
    #[account(mut)]
    pub vault_token_out: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub beneficiary_token_out: Account<'info, TokenAccount>,

    #[account(mut, has_one = vault)]
    pub pool: Account<'info, Pool>,

    /// CHECK: OK
    pub withdraw_authority: UncheckedAccount<'info>,

    pub vault: Account<'info, Vault>,
    /// CHECK: checked in vault program
    pub vault_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub vault_program: Program<'info, VaultProgram>,
}
