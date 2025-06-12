use crate::state::*;
use anchor_lang::prelude::*;
use bn::safe_math::CheckedMulDiv;
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;
use vault::state::PriceFeed;

const MINIMUM_TVL: u64 = 3; // $3
const MAXIMUM_AGE: u64 = 30;

pub fn process_shutdown<'a, 'b, 'c, 'info>(ctx: Context<'_, '_, 'info, 'info, Shutdown<'info>>) -> Result<()> {
    let num_tokens = ctx.accounts.pool.tokens.len();

    if ctx.remaining_accounts.len() >> 1 == num_tokens {
        let clock = Clock::get()?;

        let mut total: u64 = 0;

        for index in 0..num_tokens {
            let token = &ctx.accounts.pool.tokens[index];
            let amount = ctx.accounts.pool.calc_unwrapped_amount(token.balance, index).unwrap();

            let price_update_account = &ctx.remaining_accounts[index];
            let price_feed_account = &ctx.remaining_accounts[index + num_tokens];

            let price_feed: Account<PriceFeed> = Account::try_from(price_feed_account)?;
            assert_eq!(price_feed.vault, ctx.accounts.pool.vault);
            assert_eq!(price_feed.mint, token.mint);
            assert_eq!(price_feed.price_update, price_update_account.key());

            let price_update: Account<PriceUpdateV2> = Account::try_from(price_update_account)?;
            let price_info = price_update.get_price_no_older_than(&clock, MAXIMUM_AGE, &price_feed.feed_id)?;
            let exp = price_info.exponent.abs() as u32;
            let price: u64 = price_info.price.try_into()?;
            let price_denom = 10_u64.pow(exp);

            total += amount.checked_mul_div_up(price, price_denom).unwrap();
        }

        require_gt!(MINIMUM_TVL, total);
    } else {
        for token in ctx.accounts.pool.tokens.iter() {
            assert_eq!(token.balance, 0);
        }
    }

    Ok(())
}

#[derive(Accounts)]
pub struct Shutdown<'info> {
    /// CHECK: OK
    #[account(mut)]
    pub owner: UncheckedAccount<'info>,

    #[account(mut, close = owner, has_one = owner)]
    pub pool: Account<'info, Pool>,
}
