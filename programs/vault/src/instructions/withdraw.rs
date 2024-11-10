use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{accessor::authority as get_token_owner, transfer, Token, Transfer};

pub fn process_withdraw<'a, 'b, 'c, 'info>(
    ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>,
    amount: u64,
    beneficiary_amount: u64,
) -> Result<()> {
    ctx.accounts.vault.authority_seeds(|signer_seed| {
        if beneficiary_amount > 0 {
            // CHECK: checked by swap programs
            let beneficiary_token_account = &ctx.remaining_accounts[0];

            // it does not transfer beneficiary fees if `beneficiary_token_account` is closed
            // to prevent unexpected errors for Jupiter's shared router
            if beneficiary_token_account.owner.key() == ctx.accounts.token_program.key() {
                // TODO: remove it once swap programs are upgraded
                assert_eq!(
                    ctx.accounts.vault.beneficiary,
                    get_token_owner(beneficiary_token_account)?
                );

                transfer(
                    CpiContext::new(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.vault_token.to_account_info(),
                            to: beneficiary_token_account.to_account_info(),
                            authority: ctx.accounts.vault_authority.to_account_info(),
                        },
                    )
                    .with_signer(&[signer_seed]),
                    beneficiary_amount,
                )?;
            }
        }

        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token.to_account_info(),
                    to: ctx.accounts.dest_token.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            amount,
        )
    })
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
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

    pub token_program: Program<'info, Token>,
}
