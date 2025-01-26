use anchor_lang::prelude::*;

#[error_code]
pub enum SwapError {
    #[msg("Slippage exceeded")]
    SlippageExceeded,

    #[msg("Not supported mint")]
    NotSupportedMint,

    #[msg("Max supply exceeded")]
    MaxSupplyExceeded,
}
