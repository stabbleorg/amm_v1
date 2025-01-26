use crate::state::*;
use anchor_common::validate::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};
use anchor_spl::token_interface::Mint as MintInterface;
use bn::safe_math::CheckedDivCeil;
use math::{fixed_math, weighted_math};
use vault::{error::SwapError, state::Vault};

pub fn process_initialize<'a, 'b, 'c, 'info>(
    ctx: Context<'_, '_, 'info, 'info, Initialize<'info>>,
    swap_fee: u64,
    weights: Vec<u64>,
    max_caps: &Vec<u64>,
) -> Result<()> {
    let num_tokens = ctx.remaining_accounts.len();

    assert_eq!(num_tokens, weights.len());
    assert_eq!(num_tokens, max_caps.len());
    assert!(num_tokens >= weighted_math::MIN_TOKENS);
    assert!(num_tokens <= weighted_math::MAX_TOKENS);
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
        max_supply: 0,
        pending_owner: None,
    });

    let mut sum_weights: u64 = 0;
    for (token_index, account) in ctx.remaining_accounts.iter().enumerate() {
        // TODO: it should support Token 2022 once Jupiter is fully ready
        require_eq!(account.owner.key(), Token::id(), SwapError::NotSupportedMint);
        // let interface_account = InterfaceAccount::try_from(account).unwrap();
        // require!(
        //     is_supported_mint(&interface_account).unwrap(),
        //     SwapError::NotSupportedMint
        // );

        let mut buff: &[u8] = &account.try_borrow_data()?;
        let data = MintInterface::try_deserialize(&mut buff)?;
        let decimals = data.decimals as u32;
        assert!(decimals <= fixed_math::SCALE);
        assert!(weights[token_index] <= weighted_math::MAX_WEIGHT);
        assert!(weights[token_index] >= weighted_math::MIN_WEIGHT);
        sum_weights += weights[token_index];

        let (scaling_up, scaling_factor) = if max_caps[token_index] > weighted_math::MAX_SAFE_BALANCE {
            let tick_size = max_caps[token_index]
                .checked_div_up(weighted_math::MAX_SAFE_BALANCE)
                .unwrap();
            (false, tick_size)
        } else {
            let default_scaling_factor = 10_u64.saturating_pow(fixed_math::SCALE.saturating_sub(decimals));
            let tick_size = weighted_math::MAX_SAFE_BALANCE
                .checked_div_up(max_caps[token_index])
                .unwrap();
            if tick_size < default_scaling_factor {
                (true, tick_size)
            } else {
                (true, default_scaling_factor)
            }
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
