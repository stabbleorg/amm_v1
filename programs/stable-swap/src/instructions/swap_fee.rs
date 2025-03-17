use crate::state::*;
use anchor_common::validate::*;
use anchor_lang::prelude::*;
use math::stable_math;

pub fn process_reset_min_swap_fee(ctx: Context<ResetMinSwapFee>) -> Result<()> {
    ctx.accounts.pool.swap_fee = stable_math::MIN_SWAP_FEE;

    ctx.accounts.pool.emit_updated_event();

    Ok(())
}

impl<'info> Validate<'info> for ResetMinSwapFee<'info> {
    fn validate(&self) -> Result<()> {
        require_gt!(stable_math::MIN_SWAP_FEE, self.pool.swap_fee);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct ResetMinSwapFee<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
}
