use crate::state::*;
use anchor_common::validate::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{
    accessor::{amount as get_token_balance, authority as get_token_owner, mint as get_token_mint},
    transfer, Token, TokenAccount, Transfer,
};
use math::{
    fixed_math::{FixedComplement, FixedMul},
    stable_math, swap_fee_math,
};
use vault::{
    cpi::{accounts::Withdraw as WithdrawVault, withdraw as withdraw_vault},
    error::SwapError,
    program::Vault as VaultProgram,
    state::{Vault, WithdrawAuthority},
    x_token,
};

pub fn process_swap(ctx: Context<Swap>, amount_in: Option<u64>, minimum_amount_out: u64) -> Result<()> {
    let amplification = ctx.accounts.pool.get_amplification().unwrap();
    let balances = ctx.accounts.pool.get_balances();
    let current_invariant = stable_math::calc_invariant(amplification, &balances).unwrap();

    let token_in_index = ctx
        .accounts
        .pool
        .get_token_index(ctx.accounts.vault_token_in.mint)
        .unwrap();
    let token_out_index = ctx
        .accounts
        .pool
        .get_token_index(ctx.accounts.vault_token_out.mint)
        .unwrap();
    assert_ne!(token_in_index, token_out_index);

    // if amount_in is set to None, it will send full amount given user's in token account
    // this is useful to swap from intermediate token account created in multi-hop swap
    let amount_in = if amount_in.is_some() {
        ctx.accounts
            .pool
            .calc_rounded_amount(amount_in.unwrap(), token_in_index)
            .unwrap()
    } else {
        // it does not round down so that intermediate token accounts can be closed after multi-hop swap
        get_token_balance(&ctx.accounts.user_token_in.to_account_info())?
    };

    let balance_in = ctx
        .accounts
        .pool
        .calc_wrapped_amount(amount_in, token_in_index)
        .unwrap();
    let balance_out_without_fee = stable_math::calc_out_given_in(
        amplification,
        &balances,
        token_in_index,
        token_out_index,
        balance_in,
        current_invariant,
    )
    .unwrap();

    let num_ra = ctx.remaining_accounts.len();
    let swap_fee = if num_ra == 1 {
        // optional xSTB token account for swap fee discount
        let x_token_account = &ctx.remaining_accounts[0];
        assert_eq!(x_token_account.owner.key(), ctx.accounts.token_program.key());
        assert_eq!(get_token_mint(x_token_account)?, x_token::ID);
        assert_eq!(get_token_owner(x_token_account)?, ctx.accounts.user.key());
        swap_fee_math::calc_swap_fee_in_discount(ctx.accounts.pool.swap_fee, get_token_balance(x_token_account)?)
            .unwrap()
    } else {
        assert_eq!(num_ra, 0);
        ctx.accounts.pool.swap_fee
    };

    let amount_out_balance = balance_out_without_fee.mul_down(swap_fee.complement()).unwrap();
    let swap_fees_balance = balance_out_without_fee.saturating_sub(amount_out_balance);
    let beneficiary_fees_balance = swap_fees_balance.mul_down(ctx.accounts.vault.beneficiary_fee).unwrap();

    let amount_out = ctx
        .accounts
        .pool
        .calc_unwrapped_amount(amount_out_balance, token_out_index)
        .unwrap();
    require_gte!(amount_out, minimum_amount_out, SwapError::SlippageExceeded);

    let beneficiary_fees = ctx
        .accounts
        .pool
        .calc_unwrapped_amount(beneficiary_fees_balance, token_out_index)
        .unwrap();

    // add in token balance
    ctx.accounts.pool.tokens[token_in_index].balance += balance_in;
    // remove out token balance
    ctx.accounts.pool.tokens[token_out_index].balance -= ctx
        .accounts
        .pool
        .calc_wrapped_amount(amount_out + beneficiary_fees, token_out_index)
        .unwrap();

    ctx.accounts.pool.emit_balance_updated_event();

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

    ctx.accounts.vault.withdraw_authority_seeds(|signer_seed| {
        let cpi = CpiContext::new(
            ctx.accounts.vault_program.to_account_info(),
            WithdrawVault {
                withdraw_authority: ctx.accounts.withdraw_authority.to_account_info(),
                vault: ctx.accounts.vault.to_account_info(),
                vault_authority: ctx.accounts.vault_authority.to_account_info(),
                vault_token: ctx.accounts.vault_token_out.to_account_info(),
                dest_token: ctx.accounts.user_token_out.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
        );

        if beneficiary_fees > 0 {
            withdraw_vault(
                cpi.with_remaining_accounts(vec![ctx.accounts.beneficiary_token_out.to_account_info()])
                    .with_signer(&[signer_seed]),
                amount_out,
                beneficiary_fees,
            )
        } else {
            withdraw_vault(cpi.with_signer(&[signer_seed]), amount_out, 0)
        }
    })
}

impl<'info> Validate<'info> for Swap<'info> {
    fn validate(&self) -> Result<()> {
        assert!(self.vault.is_active);
        assert!(self.pool.is_active);

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
    #[account(mut,
        associated_token::mint = vault_token_in.mint,
        associated_token::authority = vault_authority,
    )]
    pub vault_token_in: Account<'info, TokenAccount>,
    /// CHECK: OK
    #[account(mut)]
    pub vault_token_out: Account<'info, TokenAccount>,

    /// CHECK: OK
    #[account(mut)]
    pub beneficiary_token_out: UncheckedAccount<'info>,

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
