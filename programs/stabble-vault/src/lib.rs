use anchor_lang::prelude::*;

declare_id!("359c376ustKUBAy8ZJdjyRub9Kf7W4LHxxahXP8P9LEW");

#[program]
pub mod stabble_vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
