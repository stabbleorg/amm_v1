use crate::located::*;
use anchor_lang::prelude::*;

#[account]
pub struct Vault {
    pub admin: Pubkey,

    /// PDA of pool programs seeded by vault address
    pub withdraw_authority: Pubkey, // immutable
    /// bump seed of withdraw authority PDA
    pub withdraw_authority_bump: u8, // immutable

    pub beneficiary: Pubkey,
    pub beneficiary_fee: u16,

    /// bump seed of vault authority PDA
    pub authority_bump: u8, // immutable
    pub is_active: bool,
}

impl Vault {
    pub const AUTHORITY_PREFIX: &'static [u8] = b"Vault Authority";
    pub const WITHDRAW_AUTHORITY_PREFIX: &'static [u8] = b"Withdraw Authority";
}

pub trait VaultAuthority {
    fn authority_seeds<R, F: FnOnce(&[&[u8]]) -> R>(&self, f: F) -> R;
}

impl<T> VaultAuthority for T
where
    T: Located<Vault>,
{
    fn authority_seeds<R, F: FnOnce(&[&[u8]]) -> R>(&self, f: F) -> R {
        f(&[
            Vault::AUTHORITY_PREFIX,
            &self.key().to_bytes(),
            &[self.as_ref().authority_bump],
        ])
    }
}

pub trait WithdrawAuthority {
    fn withdraw_authority_seeds<R, F: FnOnce(&[&[u8]]) -> R>(&self, f: F) -> R;
}

impl<T> WithdrawAuthority for T
where
    T: Located<Vault>,
{
    fn withdraw_authority_seeds<R, F: FnOnce(&[&[u8]]) -> R>(&self, f: F) -> R {
        f(&[
            Vault::WITHDRAW_AUTHORITY_PREFIX,
            &self.key().to_bytes(),
            &[self.as_ref().withdraw_authority_bump],
        ])
    }
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct VaultUpdatedData {
    pub beneficiary_fee: u16,
    pub is_active: bool,
}

#[event]
pub struct VaultUpdatedEvent {
    pub pubkey: Pubkey,
    pub data: VaultUpdatedData,
}
