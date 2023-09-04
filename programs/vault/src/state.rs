use anchor_lang::prelude::*;

#[account]
pub struct Vault {
    pub authority_bump: u8,
    pub is_active: bool,

    pub beneficiary: Pubkey,
    pub withdraw_authority: Pubkey,
    pub arbitrage_authority: Pubkey,
    pub delegate_authority: Pubkey,
    pub admin: Pubkey,
}

impl Vault {
    pub const AUTHORITY_PREFIX: &'static [u8] = b"Vault Authority";
}
