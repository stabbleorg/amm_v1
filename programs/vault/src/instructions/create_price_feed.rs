use crate::{instructions::*, state::*};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2, VerificationLevel};

pub fn process_create_price_feed(ctx: Context<CreatePriceFeed>, feed_id: &String) -> Result<()> {
    assert_eq!(ctx.accounts.price_update.verification_level, VerificationLevel::Full);

    ctx.accounts.price_feed.set_inner(PriceFeed {
        vault: ctx.accounts.admin_only.vault.key(),
        mint: ctx.accounts.mint.key(),
        price_update: ctx.accounts.price_update.key(),
        feed_id: get_feed_id_from_hex(&feed_id[..])?,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CreatePriceFeed<'info> {
    pub admin_only: AdminOnly<'info>,

    #[account(zero)]
    pub price_feed: Account<'info, PriceFeed>,

    pub price_update: Account<'info, PriceUpdateV2>,

    pub mint: InterfaceAccount<'info, Mint>,
}
