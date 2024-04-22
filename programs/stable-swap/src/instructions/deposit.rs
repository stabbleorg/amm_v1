use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{
    accessor::{authority as get_token_owner, mint as get_token_mint},
    mint_to, transfer, Mint, MintTo, Token, TokenAccount, Transfer,
};
use math::stable_math;
use vault::{state::Vault, ID as VAULT_PROGRAM_ID};

pub fn process_deposit<'a, 'b, 'c, 'info>(
    ctx: Context<'_, '_, '_, 'info, Deposit<'info>>,
    amounts: Vec<u64>,
    minimum_amount_out: u64,
) -> Result<()> {
    let num_tokens = amounts.len();
    let amplification = ctx.accounts.pool.get_amplification();

    // LP amount
    let amount_out = if ctx.accounts.mint.supply == 0 {
        assert_eq!(ctx.accounts.user.key(), ctx.accounts.pool.owner);

        // initial liquidity
        stable_math::calc_invariant(
            amplification,
            &amounts
                .iter()
                .enumerate()
                .map(|(token_index, &amount)| {
                    let mint = get_token_mint(&ctx.remaining_accounts[token_index]).unwrap();
                    assert_eq!(ctx.accounts.pool.tokens[token_index].mint, mint); // check token orders

                    ctx.accounts
                        .transfer_to_vault(
                            amount,
                            token_index,
                            &ctx.remaining_accounts[token_index],
                            &ctx.remaining_accounts[token_index + num_tokens],
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
            let mint = get_token_mint(&ctx.remaining_accounts[0])?;
            let token_index = ctx.accounts.pool.get_token_index(mint);
            let balance_in = ctx
                .accounts
                .transfer_to_vault(
                    amounts[0],
                    token_index,
                    &ctx.remaining_accounts[0],
                    &ctx.remaining_accounts[1],
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
            stable_math::calc_pool_token_out_given_exact_tokens_in(
                amplification,
                &balances,
                &amounts
                    .iter()
                    .enumerate()
                    .map(|(token_index, &amount)| {
                        let mint = get_token_mint(&ctx.remaining_accounts[token_index]).unwrap();
                        assert_eq!(ctx.accounts.pool.tokens[token_index].mint, mint); // check token orders

                        ctx.accounts
                            .transfer_to_vault(
                                amount,
                                token_index,
                                &ctx.remaining_accounts[token_index],
                                &ctx.remaining_accounts[token_index + num_tokens],
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

    assert!(amount_out >= minimum_amount_out); // check slippage

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

    fn transfer_to_vault(
        &mut self,
        amount: u64,
        token_index: usize,
        user_account: &AccountInfo<'info>,
        vault_account: &AccountInfo<'info>,
    ) -> Result<u64> {
        let balance_in = self.pool.calc_wrapped_amount(amount, token_index);
        // add token balances
        self.pool.tokens[token_index].balance = self.pool.tokens[token_index].balance + balance_in;

        // check vault token owner
        assert_eq!(get_token_owner(vault_account)?, self.vault_authority.key());
        transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                Transfer {
                    from: user_account.to_account_info(),
                    to: vault_account.to_account_info(),
                    authority: self.user.to_account_info(),
                },
            ),
            self.pool.calc_rounded_amount(amount, token_index),
        )?;

        Ok(balance_in)
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
