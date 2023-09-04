use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
pub struct AssertBatchSwap<'info> {
    pub token_in: Account<'info, TokenAccount>,
    pub token_out: Account<'info, TokenAccount>,
}

pub fn process_assert_batch_swap(
    ctx: Context<AssertBatchSwap>,
    token_in_balance: u64,
    min_amount_out: u64,
) -> Result<()> {
    Ok(())
}
