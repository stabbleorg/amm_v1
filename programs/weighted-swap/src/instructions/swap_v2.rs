use crate::state::*;
use anchor_common::{token::get_transfer_fee, validate::*};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token,
    token::{
        accessor::{amount as get_token_balance, authority as get_token_owner, mint as get_token_mint},
        Token,
    },
    token_interface::{transfer_checked, Mint, Token2022, TokenAccount, TransferChecked},
};
use math::{
    fixed_math::{FixedComplement, FixedMul},
    swap_fee_math, weighted_math,
};
use vault::{
    cpi::{accounts::WithdrawV2 as WithdrawVault, withdraw_v2 as withdraw_vault},
    error::SwapError,
    program::Vault as VaultProgram,
    state::{Vault, WithdrawAuthority},
    x_token,
};

pub fn process_swap_v2(ctx: Context<SwapV2>, amount_in: Option<u64>, minimum_amount_out: u64) -> Result<()> {
    let token_in_index = ctx.accounts.pool.get_token_index(ctx.accounts.mint_in.key()).unwrap();
    let token_out_index = ctx.accounts.pool.get_token_index(ctx.accounts.mint_out.key()).unwrap();
    assert_ne!(token_in_index, token_out_index);

    let epoch = Clock::get()?.epoch;

    // if amount_in is set to None, it will send full amount given user's in token account
    // this is useful to swap from intermediate token account created in multi-hop swap
    let amount_in = if amount_in.is_some() {
        amount_in.unwrap()
    } else {
        ctx.accounts.user_token_in.amount
    };

    let transfer_fee = get_transfer_fee(&ctx.accounts.mint_in.to_account_info(), amount_in, epoch)?;
    let post_fee_amount_in = amount_in.saturating_sub(transfer_fee);

    let balance_in = ctx
        .accounts
        .pool
        .calc_wrapped_amount(post_fee_amount_in, token_in_index)
        .unwrap();
    let balance_out_without_fee = weighted_math::calc_out_given_in(
        ctx.accounts.pool.tokens[token_in_index].balance,
        ctx.accounts.pool.tokens[token_in_index].weight,
        ctx.accounts.pool.tokens[token_out_index].balance,
        ctx.accounts.pool.tokens[token_out_index].weight,
        balance_in,
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
    let transfer_fee = get_transfer_fee(&ctx.accounts.mint_out.to_account_info(), amount_out, epoch)?;
    let post_fee_amount_out = amount_out - transfer_fee;
    require_gte!(post_fee_amount_out, minimum_amount_out, SwapError::SlippageExceeded);

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

    let mint_in = ctx.accounts.mint_in.to_account_info();
    let token_program = if mint_in.owner.key() == Token::id() {
        ctx.accounts.token_program.to_account_info()
    } else {
        ctx.accounts.token_2022_program.to_account_info()
    };
    transfer_checked(
        CpiContext::new(
            token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.user_token_in.to_account_info(),
                mint: mint_in,
                to: ctx.accounts.vault_token_in.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount_in,
        ctx.accounts.mint_in.decimals,
    )?;

    ctx.accounts.vault.withdraw_authority_seeds(|signer_seed| {
        let mint_out = ctx.accounts.mint_out.to_account_info();
        let token_program = if mint_out.owner.key() == Token::id() {
            ctx.accounts.token_program.to_account_info()
        } else {
            ctx.accounts.token_2022_program.to_account_info()
        };

        if beneficiary_fees > 0 {
            withdraw_vault(
                CpiContext::new(
                    ctx.accounts.vault_program.to_account_info(),
                    WithdrawVault {
                        withdraw_authority: ctx.accounts.withdraw_authority.to_account_info(),
                        vault: ctx.accounts.vault.to_account_info(),
                        vault_authority: ctx.accounts.vault_authority.to_account_info(),
                        vault_token: ctx.accounts.vault_token_out.to_account_info(),
                        dest_token: ctx.accounts.user_token_out.to_account_info(),
                        beneficiary_token: Some(ctx.accounts.beneficiary_token_out.to_account_info()),
                        mint: mint_out,
                        token_program,
                    },
                )
                .with_signer(&[signer_seed]),
                amount_out,
                beneficiary_fees,
            )
        } else {
            withdraw_vault(
                CpiContext::new(
                    ctx.accounts.vault_program.to_account_info(),
                    WithdrawVault {
                        withdraw_authority: ctx.accounts.withdraw_authority.to_account_info(),
                        vault: ctx.accounts.vault.to_account_info(),
                        vault_authority: ctx.accounts.vault_authority.to_account_info(),
                        vault_token: ctx.accounts.vault_token_out.to_account_info(),
                        dest_token: ctx.accounts.user_token_out.to_account_info(),
                        beneficiary_token: None,
                        mint: mint_out,
                        token_program,
                    },
                )
                .with_signer(&[signer_seed]),
                amount_out,
                0,
            )
        }
    })
}

impl<'info> Validate<'info> for SwapV2<'info> {
    fn validate(&self) -> Result<()> {
        assert!(self.vault.is_active);
        assert!(self.pool.is_active);

        assert_eq!(
            self.vault_token_in.key(),
            associated_token::get_associated_token_address_with_program_id(
                &self.vault_authority.key,
                self.mint_in.to_account_info().key,
                self.mint_in.to_account_info().owner,
            )
        );

        assert_eq!(
            self.beneficiary_token_out.key(),
            associated_token::get_associated_token_address_with_program_id(
                &self.vault.beneficiary,
                self.mint_out.to_account_info().key,
                self.mint_out.to_account_info().owner,
            )
        );

        Ok(())
    }
}

#[derive(Accounts)]
pub struct SwapV2<'info> {
    pub user: Signer<'info>,

    pub mint_in: InterfaceAccount<'info, Mint>,
    /// CHECK: OK
    pub mint_out: UncheckedAccount<'info>,

    #[account(mut)]
    pub user_token_in: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: OK
    #[account(mut)]
    pub user_token_out: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub vault_token_in: UncheckedAccount<'info>,
    /// CHECK: OK
    #[account(mut)]
    pub vault_token_out: UncheckedAccount<'info>,

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
    pub token_2022_program: Program<'info, Token2022>,
}
