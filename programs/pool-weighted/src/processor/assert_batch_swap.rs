use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

pub fn process_assert_batch_swap(ctx: Context<AssertBatchSwap>, min_balance: u64) -> Result<()> {
    assert!(ctx.accounts.token.amount >= min_balance);
    Ok(())
}

#[derive(Accounts)]
pub struct AssertBatchSwap<'info> {
    pub token: Account<'info, TokenAccount>,
}
