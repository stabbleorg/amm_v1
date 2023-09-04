use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Eq, PartialEq, Clone, Copy)]
pub struct PoolToken {
    pub mint: Pubkey,
    pub decimals: u8,
    pub balance: u64,
}

#[account]
pub struct Pool {
    pub authority_bump: u8,
    pub is_active: bool,
    pub swap_fee_bps: u16,

    pub mint: Pubkey,
    pub vault: Pubkey,
    pub admin: Pubkey,

    pub tokens: Vec<PoolToken>,
}

impl Pool {
    pub const AUTHORITY_PREFIX: &'static [u8] = b"Composable Stable Pool Authority";
}
