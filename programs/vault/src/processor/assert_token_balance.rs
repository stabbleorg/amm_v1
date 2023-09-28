use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

pub fn process_assert_token_balance(ctx: Context<AssertTokenBalance>, min_balance: u64) -> Result<()> {
    assert!(ctx.accounts.token.amount >= min_balance);
    Ok(())
}

#[derive(Accounts)]
pub struct AssertTokenBalance<'info> {
    pub token: Account<'info, TokenAccount>,
}
