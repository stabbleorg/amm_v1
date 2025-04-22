use anchor_lang::prelude::*;

#[account]
pub struct PriceFeed {
    pub vault: Pubkey,
    pub mint: Pubkey,
    pub price_update: Pubkey,
    pub feed_id: [u8; 32],
}
