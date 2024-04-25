use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use bn::safe_math::CheckedDivCeil;
use math::{fixed_math, stable_math};
use vault::state::Vault;

pub fn process_initialize(ctx: Context<Initialize>, amp_factor: u16, swap_fee: u64, max_caps: &Vec<u64>) -> Result<()> {
    ctx.accounts.pool.set_inner(Pool {
        owner: ctx.accounts.owner.key(),
        vault: ctx.accounts.vault.key(),
        mint: ctx.accounts.mint.key(),
        authority_bump: ctx.bumps.pool_authority,
        is_active: true,
        amp_initial_factor: amp_factor,
        amp_target_factor: amp_factor,
        ramp_start_ts: 0,
        ramp_stop_ts: 0,
        swap_fee,
        tokens: vec![],
        pending_owner: None,
    });

    for (token_index, account) in ctx.remaining_accounts.iter().enumerate() {
        let mut buff: &[u8] = &account.try_borrow_data()?;
        let data = Mint::try_deserialize(&mut buff)?;
        let decimals = data.decimals as u32;
        assert!(decimals <= fixed_math::SCALE);

        let default_scaling_factor = 10_u64.saturating_pow(fixed_math::SCALE.saturating_sub(decimals));
        let (scaling_up, scaling_factor) = if max_caps[token_index] > stable_math::SAFE_MAX_CAP {
            let tick_size = max_caps[token_index].checked_div_up(stable_math::SAFE_MAX_CAP).unwrap();
            if default_scaling_factor >= tick_size {
                (true, default_scaling_factor / tick_size)
            } else {
                (false, tick_size)
            }
        } else {
            (true, default_scaling_factor)
        };

        ctx.accounts.pool.tokens.push(PoolToken {
            mint: account.key(),
            decimals: data.decimals,
            scaling_up,
            scaling_factor,
            balance: 0,
        });
    }

    Ok(())
}

impl<'info> Initialize<'info> {
    pub fn validate(ctx: &Context<Initialize>, amp_factor: u16, swap_fee: u64) -> Result<()> {
        assert!(ctx.accounts.vault.is_active);

        assert_eq!(ctx.accounts.mint.supply, 0);
        assert_eq!(ctx.accounts.mint.decimals as u32, fixed_math::SCALE);
        assert_eq!(
            ctx.accounts.mint.mint_authority.unwrap(),
            ctx.accounts.pool_authority.key()
        );
        assert!(ctx.accounts.mint.freeze_authority.is_none());

        assert!(amp_factor >= stable_math::MIN_AMP);
        assert!(amp_factor <= stable_math::MAX_AMP);

        assert!(swap_fee >= stable_math::MIN_SWAP_FEE);
        assert!(swap_fee <= stable_math::MAX_SWAP_FEE);

        assert!(ctx.remaining_accounts.len() >= stable_math::MIN_TOKENS);
        assert!(ctx.remaining_accounts.len() <= stable_math::MAX_TOKENS);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    pub owner: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(zero, rent_exempt = enforce)]
    pub pool: Account<'info, Pool>,
    /// CHECK: OK
    #[account(seeds = [Pool::AUTHORITY_PREFIX, pool.key().as_ref()], bump)]
    pub pool_authority: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(seeds = [Vault::WITHDRAW_AUTHORITY_PREFIX, vault.key().as_ref()], bump = vault.withdraw_authority_bump)]
    pub withdraw_authority: UncheckedAccount<'info>,

    #[account(has_one = withdraw_authority)]
    pub vault: Account<'info, Vault>,
}
