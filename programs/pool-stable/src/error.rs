use anchor_lang::prelude::*;

#[error_code]
pub enum PoolStableError {
    #[msg("Get invariant didnt converge")]
    GetInvariantDidntConverge,
    #[msg("Get balance didnt converge")]
    GetBalanceDidntConverge,
}
