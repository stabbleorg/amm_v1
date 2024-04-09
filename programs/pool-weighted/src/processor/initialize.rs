use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use vault::state::Vault;

pub fn process_initialize(ctx: Context<Initialize>, swap_fee: u64, weights: Vec<u64>, ticks: Vec<u64>) -> Result<()> {
    ctx.accounts.pool.set_inner(Pool {
        owner: ctx.accounts.owner.key(),
        vault: ctx.accounts.vault.key(),
        mint: ctx.accounts.mint.key(),
        invariant: 0,
        swap_fee,
        is_active: true,
        authority_bump: ctx.bumps.pool_authority,
        tokens: vec![],
    });
    for (token_index, account) in ctx.remaining_accounts.iter().enumerate() {
        assert_ne!(weights[token_index], 0);
        let mut buff: &[u8] = &account.try_borrow_data()?;
        let data = Mint::try_deserialize(&mut buff)?;
        let decimals = data.decimals as u32;
        assert!(decimals <= Pool::MAX_TOKEN_DECIMALS);
        ctx.accounts.pool.tokens.push(PoolToken {
            mint: account.key(),
            decimals: data.decimals,
            weight: weights[token_index],
            multiplier: 10u32.saturating_pow(decimals),
            scaling_factor: 10_u64.saturating_pow(Pool::MAX_TOKEN_DECIMALS.saturating_sub(decimals)),
            tick: ticks[token_index],
            balance: 0,
        });
    }
    Ok(())
}

impl<'info> Initialize<'info> {
    pub fn validate(ctx: &Context<Initialize>, swap_fee: u64, weights: &Vec<u64>) -> Result<()> {
        assert!(ctx.accounts.vault.is_active);
        assert_eq!(ctx.accounts.mint.supply, 0);
        assert_eq!(ctx.accounts.mint.decimals, Pool::POOL_TOKEN_DECIMALS);
        assert_eq!(
            ctx.accounts.mint.mint_authority.unwrap(),
            ctx.accounts.pool_authority.key()
        );
        assert!(ctx.accounts.mint.freeze_authority.is_none());
        let sum_weights: u64 = weights.iter().sum();
        assert_eq!(sum_weights, Pool::WEIGHT_PRECISION as u64);
        assert_eq!(ctx.remaining_accounts.len(), weights.len());
        assert!(weights.len() >= Pool::MIN_TOKENS);
        assert!(weights.len() <= Pool::MAX_TOKENS);
        assert!(swap_fee >= Pool::MIN_SWAP_FEE);
        assert!(swap_fee <= Pool::MAX_SWAP_FEE);
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
