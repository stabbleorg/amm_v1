use crate::state::*;
use anchor_lang::prelude::*;
use bn::safe_math::CheckedDivCeil;
use math::stable_math;
use vault::state::Vault;

pub fn process_change_amp_factor(ctx: Context<AdminOnly>, new_amp_factor: u16, ramp_duration: u32) -> Result<()> {
    assert_ne!(ctx.accounts.pool.amp_target_factor, new_amp_factor);
    assert_ne!(ramp_duration, 0);
    assert!(new_amp_factor >= stable_math::MIN_AMP);
    assert!(new_amp_factor <= stable_math::MAX_AMP);

    let current_time = Clock::get()?.unix_timestamp;

    ctx.accounts.pool.amp_initial_factor = u16::try_from(
        ctx.accounts
            .pool
            .get_amplification(current_time)
            .unwrap()
            .checked_div_up(stable_math::AMP_PRECISION)
            .unwrap(),
    )
    .unwrap();
    ctx.accounts.pool.amp_target_factor = new_amp_factor;
    ctx.accounts.pool.ramp_start_ts = current_time;
    ctx.accounts.pool.ramp_stop_ts = ctx.accounts.pool.ramp_start_ts + ramp_duration as i64;

    ctx.accounts.pool.emit_updated_event();

    Ok(())
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(mut, has_one = vault)]
    pub pool: Account<'info, Pool>,

    #[account(has_one = admin)]
    pub vault: Account<'info, Vault>,

    pub admin: Signer<'info>,
}
