use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use bn::safe_math::CheckedDivCeil;
use math::{fixed_math, weighted_math};
use vault::state::Vault;

pub fn process_initialize(ctx: Context<Initialize>, swap_fee: u64, weights: Vec<u64>) -> Result<()> {
    ctx.accounts.pool.set_inner(Pool {
        owner: ctx.accounts.owner.key(),
        vault: ctx.accounts.vault.key(),
        mint: ctx.accounts.mint.key(),
        authority_bump: ctx.bumps.pool_authority,
        is_active: true,
        invariant: 0,
        swap_fee,
        tokens: vec![],
        pending_owner: None,
    });

    for (token_index, account) in ctx.remaining_accounts.iter().enumerate() {
        let mut buff: &[u8] = &account.try_borrow_data()?;
        let data = Mint::try_deserialize(&mut buff)?;
        let decimals = data.decimals as u32;
        assert!(decimals <= fixed_math::SCALE);
        assert!(weights[token_index] <= weighted_math::MAX_WEIGHT);
        assert!(weights[token_index] >= weighted_math::MIN_WEIGHT);

        let default_scaling_factor = 10_u64.saturating_pow(fixed_math::SCALE.saturating_sub(decimals));
        let max_balance = data.supply.checked_div_up(10_u64.saturating_pow(decimals)).unwrap();
        let (scaling_up, scaling_factor) = if max_balance > weighted_math::MAX_SAFE_BALANCE {
            let tick_size = max_balance.checked_div_up(weighted_math::MAX_SAFE_BALANCE).unwrap();
            if default_scaling_factor >= tick_size {
                (true, default_scaling_factor / tick_size)
            } else {
                (false, tick_size / default_scaling_factor)
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
            weight: weights[token_index],
        });
    }
    Ok(())
}

impl<'info> Initialize<'info> {
    pub fn validate(ctx: &Context<Initialize>, swap_fee: u64, weights: &Vec<u64>) -> Result<()> {
        assert!(ctx.accounts.vault.is_active);

        assert_eq!(ctx.accounts.mint.supply, 0);
        assert_eq!(ctx.accounts.mint.decimals as u32, fixed_math::SCALE);
        assert_eq!(
            ctx.accounts.mint.mint_authority.unwrap(),
            ctx.accounts.pool_authority.key()
        );
        assert!(ctx.accounts.mint.freeze_authority.is_none());

        assert!(swap_fee >= weighted_math::MIN_SWAP_FEE);
        assert!(swap_fee <= weighted_math::MAX_SWAP_FEE);

        let sum_weights: u64 = weights.iter().sum();
        assert_eq!(sum_weights, fixed_math::ONE);

        assert!(weights.len() >= weighted_math::MIN_TOKENS);
        assert!(weights.len() <= weighted_math::MAX_TOKENS);
        assert_eq!(ctx.remaining_accounts.len(), weights.len());

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
