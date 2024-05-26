use anchor_common::located::*;
use anchor_lang::prelude::*;

#[account]
pub struct Vault {
    pub admin: Pubkey,

    /// PDA of pool programs seeded by vault address
    pub withdraw_authority: Pubkey, // immutable
    /// bump seed of withdraw_authority PDA
    pub withdraw_authority_bump: u8, // immutable

    /// bump seed of vault_authority PDA
    pub authority_bump: u8, // immutable

    pub is_active: bool,

    pub beneficiary: Pubkey,
    pub beneficiary_fee: u64,

    pub pending_admin: Option<Pubkey>,
}

impl Vault {
    pub const AUTHORITY_PREFIX: &'static [u8] = b"vault_authority";
    pub const WITHDRAW_AUTHORITY_PREFIX: &'static [u8] = b"withdraw_authority";
}

////////////////////////////////////////////////////////////////

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

////////////////////////////////////////////////////////////////

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

////////////////////////////////////////////////////////////////

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct VaultUpdatedData {
    pub is_active: bool,
    pub beneficiary_fee: u64,
}

#[event]
pub struct VaultUpdatedEvent {
    pub pubkey: Pubkey,
    pub data: VaultUpdatedData,
}

pub trait EmitVaultUpdatedEvent {
    fn emit_updated_event(&self);
}

impl<T> EmitVaultUpdatedEvent for T
where
    T: Located<Vault>,
{
    fn emit_updated_event(&self) {
        emit!(VaultUpdatedEvent {
            pubkey: self.key(),
            data: VaultUpdatedData {
                is_active: self.as_ref().is_active,
                beneficiary_fee: self.as_ref().beneficiary_fee,
            },
        });
    }
}
