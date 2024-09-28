use crate::state::*;
use anchor_common::validate::*;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token,
    token::Token,
    token_interface::{mint_to, transfer_checked, Mint, MintTo, Token2022, TokenAccount, TransferChecked},
};
use math::stable_math;
use vault::{error::SwapError, state::Vault, ID as VAULT_PROGRAM_ID};

pub fn process_deposit<'a, 'b, 'c, 'info>(
    ctx: Context<'_, '_, '_, 'info, Deposit<'info>>,
    amounts: Vec<u64>,
    minimum_amount_out: u64,
) -> Result<()> {
    let num_tokens = amounts.len();

    assert_ne!(num_tokens, 0);
    assert_eq!(ctx.remaining_accounts.len(), num_tokens * 3);
    if num_tokens > 1 {
        assert_eq!(num_tokens, ctx.accounts.pool.tokens.len());
    }

    let amplification = ctx.accounts.pool.get_amplification().unwrap();

    // LP amount
    let amount_out = if ctx.accounts.mint.supply == 0 {
        assert_ne!(num_tokens, 1);
        assert_eq!(ctx.accounts.user.key(), ctx.accounts.pool.owner);

        let offset_mints = num_tokens + num_tokens;

        // initial liquidity
        stable_math::calc_invariant(
            amplification,
            &amounts
                .iter()
                .enumerate()
                .map(|(token_index, &amount)| {
                    let mint = &ctx.remaining_accounts[token_index + offset_mints];
                    assert_eq!(ctx.accounts.pool.tokens[token_index].mint, mint.key()); // check token orders

                    ctx.accounts
                        .transfer_to_vault(
                            amount,
                            token_index,
                            &ctx.remaining_accounts[token_index],
                            &ctx.remaining_accounts[token_index + num_tokens],
                            mint,
                        )
                        .unwrap()
                })
                .collect(),
        )
        .unwrap()
    } else {
        let balances = ctx.accounts.pool.get_balances();
        let current_invariant = stable_math::calc_invariant(amplification, &balances).unwrap();

        // do_join
        if num_tokens == 1 {
            let mint = &ctx.remaining_accounts[2];
            let token_index = ctx.accounts.pool.get_token_index(mint.key()).unwrap();
            let balance_in = ctx
                .accounts
                .transfer_to_vault(
                    amounts[0],
                    token_index,
                    &ctx.remaining_accounts[0],
                    &ctx.remaining_accounts[1],
                    mint,
                )
                .unwrap();

            stable_math::calc_pool_token_out_given_exact_tokens_in(
                amplification,
                &balances,
                &ctx.accounts
                    .pool
                    .tokens
                    .iter()
                    .enumerate()
                    .map(|(index, _)| if token_index == index { balance_in } else { 0 })
                    .collect(),
                ctx.accounts.mint.supply,
                current_invariant,
                ctx.accounts.pool.swap_fee,
            )
            .unwrap()
        } else {
            let offset_mints = num_tokens + num_tokens;

            stable_math::calc_pool_token_out_given_exact_tokens_in(
                amplification,
                &balances,
                &amounts
                    .iter()
                    .enumerate()
                    .map(|(token_index, &amount)| {
                        let mint = &ctx.remaining_accounts[token_index + offset_mints];
                        assert_eq!(ctx.accounts.pool.tokens[token_index].mint, mint.key()); // check token orders

                        ctx.accounts
                            .transfer_to_vault(
                                amount,
                                token_index,
                                &ctx.remaining_accounts[token_index],
                                &ctx.remaining_accounts[token_index + num_tokens],
                                mint,
                            )
                            .unwrap()
                    })
                    .collect(),
                ctx.accounts.mint.supply,
                current_invariant,
                ctx.accounts.pool.swap_fee,
            )
            .unwrap()
        }
    };

    require_gte!(amount_out, minimum_amount_out, SwapError::SlippageExceeded);

    ctx.accounts.pool.emit_balance_updated_event();

    ctx.accounts.pool.authority_seeds(|signer_seed| {
        let token_program = if ctx.accounts.mint.to_account_info().owner.key() == Token::id() {
            ctx.accounts.token_program.as_ref().unwrap().to_account_info()
        } else {
            ctx.accounts.token_program_2022.as_ref().unwrap().to_account_info()
        };

        mint_to(
            CpiContext::new(
                token_program.to_account_info(),
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

impl<'info> Validate<'info> for Deposit<'info> {
    fn validate(&self) -> Result<()> {
        assert!(self.vault.is_active);
        assert!(self.pool.is_active);

        assert_eq!(self.user_pool_token.owner, self.user.key());

        Ok(())
    }
}

impl<'info> Deposit<'info> {
    fn transfer_to_vault(
        &mut self,
        amount: u64,
        token_index: usize,
        user_account: &AccountInfo<'info>,
        vault_account: &AccountInfo<'info>,
        mint: &AccountInfo<'info>,
    ) -> Result<u64> {
        let amount_in = self.pool.calc_rounded_amount(amount, token_index).unwrap();
        let balance_in = self.pool.calc_wrapped_amount(amount_in, token_index).unwrap();
        // add token balances
        self.pool.tokens[token_index].balance += balance_in;

        let token_program = if mint.owner.key() == Token::id() {
            self.token_program.as_ref().unwrap().to_account_info()
        } else {
            self.token_program_2022.as_ref().unwrap().to_account_info()
        };

        // check associated token account for vault
        let expected_vault_account_key = associated_token::get_associated_token_address_with_program_id(
            self.vault_authority.key,
            mint.key,
            token_program.key,
        );
        assert_eq!(expected_vault_account_key, vault_account.key());

        transfer_checked(
            CpiContext::new(
                token_program.to_account_info(),
                TransferChecked {
                    from: user_account.to_account_info(),
                    mint: mint.to_account_info(),
                    to: vault_account.to_account_info(),
                    authority: self.user.to_account_info(),
                },
            ),
            amount_in,
            self.pool.tokens[token_index].decimals,
        )?;

        Ok(balance_in)
    }
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_pool_token: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut, has_one = vault, has_one = mint)]
    pub pool: Account<'info, Pool>,
    /// CHECK: OK
    #[account(seeds = [Pool::AUTHORITY_PREFIX, &pool.key().to_bytes()], bump = pool.authority_bump)]
    pub pool_authority: UncheckedAccount<'info>,

    pub vault: Account<'info, Vault>,
    /// CHECK: OK
    #[account(seeds = [Vault::AUTHORITY_PREFIX, &vault.key().to_bytes()], bump = vault.authority_bump, seeds::program = VAULT_PROGRAM_ID)]
    pub vault_authority: UncheckedAccount<'info>,

    pub token_program: Option<Program<'info, Token>>,
    pub token_program_2022: Option<Program<'info, Token2022>>,
}
