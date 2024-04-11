use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{
    accessor::mint as get_token_mint,
    {burn, Burn, Mint, Token, TokenAccount},
};
use bn::{safe_math::MulDiv, uint256, U256};
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
    let pool_token_supply = uint256!(ctx.accounts.mint.supply);
    let amplification = ctx.accounts.pool.get_amplification();
    let balances = ctx.accounts.pool.get_balances();
    let scaling_factors = ctx.accounts.pool.get_scaling_factors();
    let swap_fee = ctx.accounts.pool.get_swap_fee();
    let current_invariant = stable_math::calc_invariant(amplification, &balances).unwrap();

    let amounts_out = if ctx.remaining_accounts.len() == 2 {
        let mint = get_token_mint(&ctx.remaining_accounts[0])?;
        let token_index = ctx.accounts.pool.get_token_index(mint);
        let balance_out = stable_math::calc_token_out_given_exact_pool_token_in(
            amplification,
            &balances,
            ctx.accounts.pool.get_token_index(mint),
            uint256!(amount),
            pool_token_supply,
            current_invariant,
            swap_fee,
        )
        .unwrap();

        ctx.accounts.pool.tokens[token_index].balance = ctx.accounts.pool.tokens[token_index]
            .balance
            .checked_sub(balance_out.as_u64())
            .unwrap();

        let amount_out = balance_out
            .checked_div_down(scaling_factors[token_index])
            .unwrap()
            .as_u64();
        assert!(amount_out >= minimum_amounts_out[0]); // check slippage
        vec![amount_out]
    } else {
        let balances_out =
            base_pool_math::compute_proportional_amounts_out(balances, pool_token_supply, uint256!(amount));

        for (token_index, user_account) in ctx.remaining_accounts[0..balances_out.len()].iter().enumerate() {
            let mint = get_token_mint(&user_account)?;
            assert_eq!(ctx.accounts.pool.tokens[token_index].mint, mint);

            ctx.accounts.pool.tokens[token_index].balance = ctx.accounts.pool.tokens[token_index]
                .balance
                .checked_sub(balances_out[token_index].as_u64())
                .unwrap();
        }

        balances_out
            .iter()
            .enumerate()
            .map(|(token_index, &balance_out)| {
                let amount_out = balance_out
                    .checked_div_down(scaling_factors[token_index])
                    .unwrap()
                    .as_u64();
                assert!(amount_out >= minimum_amounts_out[token_index]); // check slippage
                amount_out
            })
            .collect()
    };

    for (index, user_account) in ctx.remaining_accounts[0..amounts_out.len()].iter().enumerate() {
        let vault_account = &ctx.remaining_accounts[index + amounts_out.len()];
        ctx.accounts.vault.withdraw_authority_seeds(|signer_seed| {
            withdraw_vault(
                CpiContext::new(
                    ctx.accounts.vault_program.to_account_info(),
                    WithdrawVault {
                        withdraw_authority: ctx.accounts.withdraw_authority.to_account_info(),
                        vault: ctx.accounts.vault.to_account_info(),
                        vault_authority: ctx.accounts.vault_authority.to_account_info(),
                        vault_token: vault_account.to_account_info(),
                        dest_token: user_account.to_account_info(),
                        token_program: ctx.accounts.token_program.to_account_info(),
                    },
                )
                .with_signer(&[signer_seed]),
                amounts_out[index],
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

    #[account(mut, has_one = vault, has_one = mint)]
    pub pool: Account<'info, Pool>,

    /// CHECK: signer & account checked in vault.withdraw
    pub withdraw_authority: UncheckedAccount<'info>,

    pub vault: Account<'info, Vault>,
    /// CHECK: PDA checked in vault.withdraw
    pub vault_authority: UncheckedAccount<'info>,

    pub vault_program: Program<'info, VaultProgram>,

    pub token_program: Program<'info, Token>,
}
