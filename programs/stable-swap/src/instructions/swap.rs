use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Token, TokenAccount, Transfer};
use math::{
    fixed_math::{FixedComplement, FixedMul},
    stable_math,
};
use vault::{
    cpi::{accounts::Withdraw as WithdrawVault, withdraw as withdraw_vault},
    program::Vault as VaultProgram,
    state::{Vault, WithdrawAuthority},
};

pub fn process_swap(ctx: Context<Swap>, amount_in: u64, minimum_amount_out: u64) -> Result<()> {
    let amplification = ctx.accounts.pool.get_amplification();
    let balances = ctx.accounts.pool.get_balances();
    let current_invariant = stable_math::calc_invariant(amplification, &balances).unwrap();

    let token_in_index = ctx.accounts.pool.get_token_index(ctx.accounts.vault_token_in.mint);
    let token_out_index = ctx
        .accounts
        .pool
        .get_token_index(ctx.accounts.beneficiary_token_out.mint);

    let balance_in = ctx.accounts.pool.calc_wrapped_amount(amount_in, token_in_index);
    let balance_out_without_fee = stable_math::calc_out_given_in(
        amplification,
        &balances,
        token_in_index,
        token_out_index,
        balance_in,
        current_invariant,
    )
    .unwrap();

    let amount_out_without_fee = ctx
        .accounts
        .pool
        .calc_unwrapped_amount(balance_out_without_fee, token_out_index);
    let amount_out = amount_out_without_fee.mul_down(ctx.accounts.pool.swap_fee.complement());
    assert!(amount_out >= minimum_amount_out); // check slippage

    let swap_fee_amount = amount_out_without_fee.saturating_sub(amount_out);
    let beneficiary_fee_amount = swap_fee_amount.mul_down(ctx.accounts.vault.beneficiary_fee);

    // add in token balance
    ctx.accounts.pool.tokens[token_in_index].balance = ctx.accounts.pool.tokens[token_in_index].balance + balance_in;
    // remove out token balance
    let balance_out = ctx
        .accounts
        .pool
        .calc_wrapped_amount(amount_out + beneficiary_fee_amount, token_out_index);
    ctx.accounts.pool.tokens[token_out_index].balance = ctx.accounts.pool.tokens[token_out_index].balance - balance_out;

    ctx.accounts.pool.emit_updated_event();

    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_in.to_account_info(),
                to: ctx.accounts.vault_token_in.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        ctx.accounts.pool.calc_rounded_amount(amount_in, token_in_index),
    )?;

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
                ctx.accounts
                    .pool
                    .calc_rounded_amount(beneficiary_fee_amount, token_out_index),
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
            ctx.accounts.pool.calc_rounded_amount(amount_out, token_out_index),
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

    pub vault_program: Program<'info, VaultProgram>,

    pub token_program: Program<'info, Token>,
}
