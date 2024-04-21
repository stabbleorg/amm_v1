use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Zero invariant")]
    ZeroInvariant,

    #[msg("Max in ratio")]
    MaxInRatio,

    #[msg("Max out ratio")]
    MaxOutRatio,

    #[msg("Max invariant ratio")]
    MaxInvariantRatio,

    #[msg("Min invariant ratio")]
    MinInvariantRatio,
}
