use anchor_lang::prelude::*;

#[error_code]
pub enum StablePoolError {
    #[msg("Slippage is out of range")]
    SlippageOutOfRange,
}
