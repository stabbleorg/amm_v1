use crate::state::*;
use anchor_common::validate::Validate;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TransferChecked};

pub fn process_withdraw_v2<'a, 'b, 'c, 'info>(
    ctx: Context<'_, '_, '_, 'info, WithdrawV2<'info>>,
    amount: u64,
    beneficiary_amount: u64,
) -> Result<()> {
    ctx.accounts.vault.authority_seeds(|signer_seed| {
        if beneficiary_amount > 0 {
            let beneficiary_token_account = ctx.accounts.beneficiary_token.as_ref().unwrap();
            assert_eq!(beneficiary_token_account.owner, ctx.accounts.vault.beneficiary);

            transfer_checked(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    TransferChecked {
                        from: ctx.accounts.vault_token.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        to: beneficiary_token_account.to_account_info(),
                        authority: ctx.accounts.vault_authority.to_account_info(),
                    },
                )
                .with_signer(&[signer_seed]),
                beneficiary_amount,
                ctx.accounts.mint.decimals,
            )?;
        }

        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.dest_token.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            amount,
            ctx.accounts.mint.decimals,
        )
    })
}

impl<'info> Validate<'info> for WithdrawV2<'info> {
    fn validate(&self) -> Result<()> {
        assert_eq!(self.token_program.key(), self.mint.to_account_info().owner.key());

        Ok(())
    }
}

#[derive(Accounts)]
pub struct WithdrawV2<'info> {
    pub withdraw_authority: Signer<'info>,

    #[account(has_one = withdraw_authority)]
    pub vault: Account<'info, Vault>,
    /// CHECK: OK
    #[account(seeds = [Vault::AUTHORITY_PREFIX, &vault.key().to_bytes()], bump = vault.authority_bump)]
    pub vault_authority: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub vault_token: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub dest_token: UncheckedAccount<'info>,

    #[account(mut)]
    pub beneficiary_token: Option<InterfaceAccount<'info, TokenAccount>>,

    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: OK
    pub token_program: UncheckedAccount<'info>,
}
