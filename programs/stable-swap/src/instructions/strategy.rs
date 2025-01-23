use crate::{instructions::*, state::*};
use anchor_lang::prelude::*;
use math::stable_math;

pub fn process_create_strategy(
    ctx: Context<CreateStrategy>,
    amp_min_factor: u16,
    amp_max_factor: u16,
    ramp_min_step: u16,
    ramp_max_step: u16,
    ramp_min_duration: u32,
    ramp_max_duration: u32,
) -> Result<()> {
    require_gte!(amp_min_factor, stable_math::MIN_AMP);
    require_gte!(stable_math::MAX_AMP, amp_max_factor);
    require_gt!(ramp_max_duration, ramp_min_duration);
    require_gt!(ramp_min_duration, 0);

    ctx.accounts.strategy.set_inner(Strategy {
        pool: ctx.accounts.owner_only.owner.key(),
        is_active: false,
        amp_min_factor,
        amp_max_factor,
        ramp_min_step,
        ramp_max_step,
        ramp_min_duration,
        ramp_max_duration,
    });

    Ok(())
}

pub fn process_approve_strategy(ctx: Context<ApproveStrategy>) -> Result<()> {
    assert_eq!(ctx.accounts.strategy.pool, ctx.accounts.admin_only.pool.key());

    ctx.accounts.strategy.is_active = true;

    Ok(())
}

pub fn process_exec_strategy(ctx: Context<ExecStrategy>, ramp_step: u16, ramp_duration: u32) -> Result<()> {
    assert!(ctx.accounts.strategy.is_active);

    require_gte!(ramp_step, ctx.accounts.strategy.ramp_min_step);
    require_gte!(ctx.accounts.strategy.ramp_max_step, ramp_step);
    require_gte!(ramp_duration, ctx.accounts.strategy.ramp_min_duration);
    require_gte!(ctx.accounts.strategy.ramp_max_duration, ramp_duration);

    let current_time = Clock::get().unwrap().unix_timestamp;
    require_gt!(current_time, ctx.accounts.pool.ramp_stop_ts);

    if ctx.accounts.pool.amp_initial_factor > ctx.accounts.pool.amp_target_factor {
        let mut amp_target_factor = ctx.accounts.pool.amp_target_factor - ramp_step;
        if amp_target_factor < ctx.accounts.strategy.amp_min_factor {
            amp_target_factor = ctx.accounts.pool.amp_target_factor + ramp_step;
            require_gte!(ctx.accounts.strategy.amp_max_factor, amp_target_factor);
        }
        ctx.accounts.pool.amp_initial_factor = ctx.accounts.pool.amp_target_factor;
        ctx.accounts.pool.amp_target_factor = amp_target_factor;
    } else {
        let mut amp_target_factor = ctx.accounts.pool.amp_target_factor + ramp_step;
        if amp_target_factor > ctx.accounts.strategy.amp_max_factor {
            amp_target_factor = ctx.accounts.pool.amp_target_factor - ramp_step;
            require_gte!(amp_target_factor, ctx.accounts.strategy.amp_min_factor);
        }
        ctx.accounts.pool.amp_initial_factor = ctx.accounts.pool.amp_target_factor;
        ctx.accounts.pool.amp_target_factor = amp_target_factor;
    }

    ctx.accounts.pool.ramp_start_ts = current_time;
    ctx.accounts.pool.ramp_stop_ts = current_time + ramp_duration as i64;

    ctx.accounts.pool.emit_updated_event();

    Ok(())
}

#[derive(Accounts)]
pub struct CreateStrategy<'info> {
    pub owner_only: OwnerOnly<'info>,

    #[account(zero, rent_exempt = enforce)]
    pub strategy: Account<'info, Strategy>,
}

#[derive(Accounts)]
pub struct ApproveStrategy<'info> {
    pub admin_only: AdminOnly<'info>,

    #[account(mut)]
    pub strategy: Account<'info, Strategy>,
}

#[derive(Accounts)]
pub struct ExecStrategy<'info> {
    #[account(has_one = pool)]
    pub strategy: Account<'info, Strategy>,

    #[account(mut)]
    pub pool: Account<'info, Pool>,
}
