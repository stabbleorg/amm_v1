use crate::{math, state::*};
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Token, TokenAccount, Transfer};
use vault::{
    cpi::{accounts::Withdraw as WithdrawVault, withdraw as withdraw_vault},
    program::Vault as VaultProgram,
    state::{Vault, WithdrawAuthority},
};

pub fn process_swap(ctx: Context<Swap>, amount_in: u64, min_amount_out: u64) -> Result<()> {
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
    let token_in_index = ctx.accounts.pool.get_token_index(ctx.accounts.vault_token_in.mint);
    let token_out_index = ctx
        .accounts
        .pool
        .get_token_index(ctx.accounts.beneficiary_token_out.mint);
    let amount_in = (amount_in as u128)
        .checked_mul(ctx.accounts.pool.tokens[token_in_index].scaling_factor as u128)
        .unwrap();
    let invariant = math::calc_invariant(amplification, ctx.accounts.pool.get_balances())?;
    let amount_out_without_fee = math::calc_out_given_in(
        amplification,
        &mut ctx.accounts.pool.get_balances(),
        token_in_index,
        token_out_index,
        amount_in,
        invariant,
    )?;

    let amount_out = (Pool::UNIT_WEIGHT)
        .saturating_sub(ctx.accounts.pool.get_swap_fee())
        .checked_mul(amount_out_without_fee)
        .unwrap()
        .checked_div(Pool::UNIT_WEIGHT)
        .unwrap();
    let swap_fee_amount = amount_out_without_fee.checked_sub(amount_out).unwrap();
    let beneficiary_fee_amount = swap_fee_amount
        .checked_mul(ctx.accounts.vault.beneficiary_fee as u128)
        .unwrap()
        .checked_div(Pool::UNIT_WEIGHT)
        .unwrap() as u64;

    let amount_out = u64::try_from(amount_out).unwrap();
    let beneficiary_fee_amount = u64::try_from(beneficiary_fee_amount).unwrap();

    // add in token balance
    ctx.accounts.pool.tokens[token_in_index].balance = ctx.accounts.pool.tokens[token_in_index]
        .balance
        .checked_add(u64::try_from(amount_in).unwrap())
        .unwrap();
    // remove out token balance
    ctx.accounts.pool.tokens[token_out_index].balance = ctx.accounts.pool.tokens[token_out_index]
        .balance
        .checked_sub(amount_out.checked_add(beneficiary_fee_amount).unwrap())
        .unwrap();

    let amount_out = amount_out
        .checked_div(ctx.accounts.pool.tokens[token_out_index].scaling_factor as u64)
        .unwrap();
    assert!(amount_out >= min_amount_out); // slippage

    let beneficiary_fee_amount = beneficiary_fee_amount
        .checked_div(ctx.accounts.pool.tokens[token_out_index].scaling_factor as u64)
        .unwrap();

    ctx.accounts.pool.emit_updated_event();
    ctx.accounts.vault.withdraw_authority_seeds(|signer_seed| {
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
        )?;

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

    #[account(has_one = withdraw_authority)]
    pub vault: Account<'info, Vault>,
    /// CHECK: checked in vault program
    pub vault_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub vault_program: Program<'info, VaultProgram>,
}
