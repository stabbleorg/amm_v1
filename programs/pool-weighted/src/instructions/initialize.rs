use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use math::weighted_math;
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
        assert!(data.decimals <= Pool::MAX_TOKEN_DECIMALS);
        assert_ne!(weights[token_index], 0);

        ctx.accounts.pool.tokens.push(PoolToken {
            mint: account.key(),
            decimals: data.decimals,
            scaling_factor: 10_u64
                .checked_pow(Pool::MAX_TOKEN_DECIMALS.saturating_sub(data.decimals) as u32)
                .unwrap(),
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
        assert_eq!(ctx.accounts.mint.decimals, Pool::MAX_TOKEN_DECIMALS);
        assert_eq!(
            ctx.accounts.mint.mint_authority.unwrap(),
            ctx.accounts.pool_authority.key()
        );
        assert!(ctx.accounts.mint.freeze_authority.is_none());

        assert!(swap_fee >= Pool::MIN_SWAP_FEE);
        assert!(swap_fee <= Pool::MAX_SWAP_FEE);

        let sum_weights: u64 = weights.iter().sum();
        assert_eq!(sum_weights, weighted_math::INV_PRECISION);

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
