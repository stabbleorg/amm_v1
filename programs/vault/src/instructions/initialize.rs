use crate::state::*;
use anchor_lang::prelude::*;
use math::fixed_math::ONE;

pub fn process_initialize(
    ctx: Context<Initialize>,
    withdraw_authority: &Pubkey,
    withdraw_authority_bump: u8,
    beneficiary: &Pubkey,
    beneficiary_fee: u64,
) -> Result<()> {
    assert!(beneficiary_fee <= ONE);

    ctx.accounts.vault.set_inner(Vault {
        admin: ctx.accounts.admin.key(),
        withdraw_authority: withdraw_authority.key(),
        withdraw_authority_bump,
        authority_bump: ctx.bumps.vault_authority,
        is_active: true,
        beneficiary: beneficiary.key(),
        beneficiary_fee,
        pending_admin: None,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    pub admin: Signer<'info>,

    #[account(zero, rent_exempt = enforce)]
    pub vault: Account<'info, Vault>,

    /// CHECK: OK
    #[account(seeds = [Vault::AUTHORITY_PREFIX, &vault.key().to_bytes()], bump)]
    pub vault_authority: UncheckedAccount<'info>,
}
