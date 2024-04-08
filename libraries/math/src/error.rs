use num_derive::FromPrimitive;
use thiserror::Error;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Error, FromPrimitive)]
pub enum WeightedMathError {
  #[error("Zero invariant")]
  ZeroInvariant,
}


#[derive(Clone, Copy, Debug, PartialEq, Eq, Error, FromPrimitive)]
pub enum StableMathError {
  #[error("Invariant didnt converge")]
  InvariantDidntConverge,

  #[error("Get balance didnt converge")]
  GetBalanceDidntConverge,
}
