use crate::state::*;
use anchor_common::validate::*;
use anchor_lang::prelude::*;
use anchor_spl::{
    token::Token,
    token_interface::{burn, Burn, Mint, Token2022, TokenAccount},
};
use math::{base_pool_math, weighted_math};
use vault::{
    cpi::{accounts::WithdrawV2 as WithdrawVault, withdraw_v2 as withdraw_vault},
    error::SwapError,
    program::Vault as VaultProgram,
    state::{Vault, WithdrawAuthority},
};

pub fn process_withdraw<'a, 'b, 'c, 'info>(
    ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>,
    amount: u64,
    minimum_amounts_out: Vec<u64>,
) -> Result<()> {
    let num_tokens = minimum_amounts_out.len();

    assert_eq!(ctx.remaining_accounts.len(), num_tokens * 3);
    if num_tokens > 1 {
        assert_eq!(num_tokens, ctx.accounts.pool.tokens.len());
    }

    if num_tokens == 1 {
        let mint = &ctx.remaining_accounts[2];
        let token_index = ctx.accounts.pool.get_token_index(mint.key()).unwrap();
        let balance_out = weighted_math::calc_token_out_given_exact_pool_token_in(
            ctx.accounts.pool.tokens[token_index].balance,
            ctx.accounts.pool.tokens[token_index].weight,
            amount,
            ctx.accounts.mint.supply,
            ctx.accounts.pool.swap_fee,
        )
        .unwrap();

        let amount_out = ctx
            .accounts
            .pool
            .calc_unwrapped_amount(balance_out, token_index)
            .unwrap();
        require_gte!(amount_out, minimum_amounts_out[0], SwapError::SlippageExceeded);

        ctx.accounts.pool.tokens[token_index].balance -=
            ctx.accounts.pool.calc_wrapped_amount(amount_out, token_index).unwrap();

        ctx.accounts
            .transfer_to_user(amount_out, &ctx.remaining_accounts[0], &ctx.remaining_accounts[1], mint)?;
    } else {
        let balances_out = base_pool_math::compute_proportional_amounts_out(
            &ctx.accounts.pool.get_balances(),
            ctx.accounts.mint.supply,
            amount,
        )
        .unwrap();
        let offset_mints = num_tokens + num_tokens;

        for (token_index, user_account) in ctx.remaining_accounts[0..num_tokens].iter().enumerate() {
            let mint = &ctx.remaining_accounts[token_index + offset_mints];
            assert_eq!(ctx.accounts.pool.tokens[token_index].mint, mint.key()); // check token orders

            let amount_out = ctx
                .accounts
                .pool
                .calc_unwrapped_amount(balances_out[token_index], token_index)
                .unwrap();
            require_gte!(
                amount_out,
                minimum_amounts_out[token_index],
                SwapError::SlippageExceeded
            );

            ctx.accounts.pool.tokens[token_index].balance -=
                ctx.accounts.pool.calc_wrapped_amount(amount_out, token_index).unwrap();

            ctx.accounts.transfer_to_user(
                amount_out,
                &user_account,
                &ctx.remaining_accounts[token_index + num_tokens],
                mint,
            )?;
        }
    };

    ctx.accounts.pool.emit_balance_updated_event();

    let token_program = if ctx.accounts.mint.to_account_info().owner.key() == Token::id() {
        ctx.accounts.token_program.to_account_info()
    } else {
        ctx.accounts.token_program_2022.to_account_info()
    };

    burn(
        CpiContext::new(
            token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.user_pool_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )
}

impl<'info> Validate<'info> for Withdraw<'info> {
    fn validate(&self) -> Result<()> {
        assert!(self.vault.is_active);
        assert!(self.pool.is_active);

        Ok(())
    }
}

impl<'info> Withdraw<'info> {
    fn transfer_to_user(
        &mut self,
        amount: u64,
        user_account: &AccountInfo<'info>,
        vault_account: &AccountInfo<'info>,
        mint: &AccountInfo<'info>,
    ) -> Result<()> {
        self.vault.withdraw_authority_seeds(|signer_seed| {
            let token_program = if mint.owner.key() == Token::id() {
                self.token_program.to_account_info()
            } else {
                self.token_program_2022.to_account_info()
            };

            withdraw_vault(
                CpiContext::new(
                    self.vault_program.to_account_info(),
                    WithdrawVault {
                        withdraw_authority: self.withdraw_authority.to_account_info(),
                        vault: self.vault.to_account_info(),
                        vault_authority: self.vault_authority.to_account_info(),
                        vault_token: vault_account.to_account_info(),
                        dest_token: user_account.to_account_info(),
                        beneficiary_token: None,
                        mint: mint.to_account_info(),
                        token_program,
                    },
                )
                .with_signer(&[signer_seed]),
                amount,
                0,
            )
        })
    }
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_pool_token: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut, has_one = mint, has_one = vault)]
    pub pool: Account<'info, Pool>,

    /// CHECK: signer & account checked in vault.withdraw
    pub withdraw_authority: UncheckedAccount<'info>,

    pub vault: Account<'info, Vault>,
    /// CHECK: checked in vault program
    pub vault_authority: UncheckedAccount<'info>,

    pub vault_program: Program<'info, VaultProgram>,

    pub token_program: Program<'info, Token>,
    pub token_program_2022: Program<'info, Token2022>,
}
