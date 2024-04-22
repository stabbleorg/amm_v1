use crate::located::*;
use anchor_lang::prelude::*;

#[account]
pub struct Vault {
    pub admin: Pubkey,

    /// bump seed of vault_authority PDA
    pub authority_bump: u8, // immutable

    pub is_active: bool,

    pub beneficiary: Pubkey,
    pub beneficiary_fee: u64,

    pub pending_admin: Option<Pubkey>,
}

impl Vault {
    pub const AUTHORITY_PREFIX: &'static [u8] = b"vault_authority";
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
