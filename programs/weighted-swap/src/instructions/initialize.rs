use crate::state::*;
use anchor_common::validate::*;
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use bn::safe_math::CheckedDivCeil;
use math::{fixed_math, weighted_math};
use vault::state::Vault;

pub fn process_initialize(
    ctx: Context<Initialize>,
    swap_fee: u64,
    weights: Vec<u64>,
    max_caps: &Vec<u64>,
) -> Result<()> {
    assert_eq!(ctx.remaining_accounts.len(), weights.len());
    assert!(ctx.remaining_accounts.len() >= weighted_math::MIN_TOKENS);
    assert!(ctx.remaining_accounts.len() <= weighted_math::MAX_TOKENS);
    assert!(swap_fee >= weighted_math::MIN_SWAP_FEE);
    assert!(swap_fee <= weighted_math::MAX_SWAP_FEE);

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

    let mut sum_weights: u64 = 0;
    for (token_index, account) in ctx.remaining_accounts.iter().enumerate() {
        let mut buff: &[u8] = &account.try_borrow_data()?;
        let data = Mint::try_deserialize(&mut buff)?;
        let decimals = data.decimals as u32;
        assert!(decimals <= fixed_math::SCALE);
        assert!(weights[token_index] <= weighted_math::MAX_WEIGHT);
        assert!(weights[token_index] >= weighted_math::MIN_WEIGHT);
        sum_weights += weights[token_index];

        let default_scaling_factor = 10_u64.saturating_pow(fixed_math::SCALE.saturating_sub(decimals));
        let (scaling_up, scaling_factor) = if max_caps[token_index] > weighted_math::MAX_SAFE_BALANCE_INT {
            let tick_size = max_caps[token_index]
                .checked_div_up(weighted_math::MAX_SAFE_BALANCE_INT)
                .unwrap();
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
            weight: weights[token_index],
        });
    }
    assert_eq!(sum_weights, fixed_math::ONE);

    Ok(())
}

impl<'info> Validate<'info> for Initialize<'info> {
    fn validate(&self) -> Result<()> {
        assert!(self.vault.is_active);

        assert_eq!(self.mint.supply, 0);
        assert_eq!(self.mint.decimals as u32, fixed_math::SCALE);
        assert_eq!(self.mint.mint_authority.unwrap(), self.pool_authority.key());
        assert!(self.mint.freeze_authority.is_none());

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
    #[account(seeds = [Pool::AUTHORITY_PREFIX, &pool.key().to_bytes()], bump)]
    pub pool_authority: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(seeds = [Vault::WITHDRAW_AUTHORITY_PREFIX, &vault.key().to_bytes()], bump = vault.withdraw_authority_bump)]
    pub withdraw_authority: UncheckedAccount<'info>,

    #[account(has_one = withdraw_authority)]
    pub vault: Account<'info, Vault>,
}
