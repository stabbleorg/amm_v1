use crate::state::*;
use anchor_common::validate::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{
    accessor::mint as get_token_mint,
    {burn, Burn, Mint, Token, TokenAccount},
};
use math::{base_pool_math, stable_math};
use vault::{
    cpi::{accounts::Withdraw as WithdrawVault, withdraw as withdraw_vault},
    program::Vault as VaultProgram,
    state::{Vault, WithdrawAuthority},
};

pub fn process_withdraw<'a, 'b, 'c, 'info>(
    ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>,
    amount: u64,
    minimum_amounts_out: Vec<u64>,
) -> Result<()> {
    let amplification = ctx.accounts.pool.get_amplification();
    let balances = ctx.accounts.pool.get_balances();
    let current_invariant = stable_math::calc_invariant(amplification, &balances).unwrap();

    if ctx.remaining_accounts.len() == 2 {
        let mint = get_token_mint(&ctx.remaining_accounts[0])?;
        let token_index = ctx.accounts.pool.get_token_index(mint);
        let balance_out = stable_math::calc_token_out_given_exact_pool_token_in(
            amplification,
            &balances,
            ctx.accounts.pool.get_token_index(mint),
            amount,
            ctx.accounts.mint.supply,
            current_invariant,
            ctx.accounts.pool.swap_fee,
        )
        .unwrap();

        ctx.accounts.pool.tokens[token_index].balance = ctx.accounts.pool.tokens[token_index].balance - balance_out;

        let amount_out = ctx.accounts.pool.calc_unwrapped_amount(balance_out, token_index);
        assert!(amount_out >= minimum_amounts_out[0]); // check slippage

        ctx.accounts
            .transfer_to_user(amount_out, &ctx.remaining_accounts[0], &ctx.remaining_accounts[1])?;
    } else {
        let balances_out =
            base_pool_math::compute_proportional_amounts_out(&balances, ctx.accounts.mint.supply, amount);

        for (token_index, user_account) in ctx.remaining_accounts[0..balances_out.len()].iter().enumerate() {
            let mint = get_token_mint(&user_account)?;
            assert_eq!(ctx.accounts.pool.tokens[token_index].mint, mint); // check token orders

            ctx.accounts.pool.tokens[token_index].balance =
                ctx.accounts.pool.tokens[token_index].balance - balances_out[token_index];

            let amount_out = ctx
                .accounts
                .pool
                .calc_unwrapped_amount(balances_out[token_index], token_index);
            assert!(amount_out >= minimum_amounts_out[token_index]); // check slippage

            ctx.accounts.transfer_to_user(
                amount_out,
                &user_account,
                &ctx.remaining_accounts[token_index + balances_out.len()],
            )?;
        }
    };

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
    ) -> Result<()> {
        self.vault.withdraw_authority_seeds(|signer_seed| {
            withdraw_vault(
                CpiContext::new(
                    self.vault_program.to_account_info(),
                    WithdrawVault {
                        withdraw_authority: self.withdraw_authority.to_account_info(),
                        vault: self.vault.to_account_info(),
                        vault_authority: self.vault_authority.to_account_info(),
                        vault_token: vault_account.to_account_info(),
                        dest_token: user_account.to_account_info(),
                        token_program: self.token_program.to_account_info(),
                    },
                )
                .with_signer(&[signer_seed]),
                amount,
            )
        })
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

    #[account(mut, has_one = mint, has_one = vault)]
    pub pool: Account<'info, Pool>,

    /// CHECK: signer & account checked in vault.withdraw
    pub withdraw_authority: UncheckedAccount<'info>,

    pub vault: Account<'info, Vault>,
    /// CHECK: PDA checked in vault.withdraw
    pub vault_authority: UncheckedAccount<'info>,

    pub vault_program: Program<'info, VaultProgram>,

    pub token_program: Program<'info, Token>,
}
