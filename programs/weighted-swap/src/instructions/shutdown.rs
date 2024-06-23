use crate::state::*;
use anchor_common::validate::*;
use anchor_lang::prelude::*;

impl<'info> Validate<'info> for Shutdown<'info> {
    fn validate(&self) -> Result<()> {
        for token in self.pool.tokens.iter() {
            assert_eq!(token.balance, 0);
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Shutdown<'info> {
    /// CHECK: OK
    #[account(mut)]
    pub owner: UncheckedAccount<'info>,

    #[account(mut, close = owner, has_one = owner)]
    pub pool: Account<'info, Pool>,
}
