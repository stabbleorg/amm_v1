use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use vault::state::Vault;

pub fn process_initialize(ctx: Context<Initialize>, amp: u16, swap_fee: u16) -> Result<()> {
    ctx.accounts.pool.set_inner(Pool {
        owner: ctx.accounts.owner.key(),
        vault: ctx.accounts.vault.key(),
        mint: ctx.accounts.mint.key(),
        invariant: 0,
        amp,
        amp_start: 0,
        amp_start_time: 0,
        amp_end_time: 0,
        amp_duration: 0,
        swap_fee,
        is_active: true,
        authority_bump: ctx.bumps.pool_authority,
        tokens: vec![],
    });
    for account in ctx.remaining_accounts.iter() {
        let mut buff: &[u8] = &account.try_borrow_data()?;
        let data = Mint::try_deserialize(&mut buff)?;
        let decimals = data.decimals as u32;
        assert!(decimals <= Pool::MAX_TOKEN_DECIMALS);
        ctx.accounts.pool.tokens.push(PoolToken {
            mint: account.key(),
            decimals: data.decimals,
            multiplier: 10u32.saturating_pow(decimals),
            scaling_factor: 10u32.saturating_pow(Pool::MAX_TOKEN_DECIMALS.saturating_sub(decimals)),
            balance: 0,
        });
    }
    Ok(())
}

impl<'info> Initialize<'info> {
    pub fn validate(ctx: &Context<Initialize>, amp: u16, swap_fee: u16) -> Result<()> {
        // custom stable pool is not allowed
        assert_eq!(ctx.accounts.owner.key(), ctx.accounts.vault.admin);
        assert_eq!(ctx.accounts.mint.supply, 0);
        assert_eq!(ctx.accounts.mint.decimals, Pool::POOL_TOKEN_DECIMALS);
        assert_eq!(
            ctx.accounts.mint.mint_authority.unwrap(),
            ctx.accounts.pool_authority.key()
        );
        assert!(ctx.accounts.mint.freeze_authority.is_none());
        assert!(ctx.remaining_accounts.len() >= Pool::MIN_TOKENS);
        assert!(ctx.remaining_accounts.len() <= Pool::MAX_TOKENS);
        assert!(amp >= Pool::MIN_AMP);
        assert!(amp <= Pool::MAX_AMP);
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
