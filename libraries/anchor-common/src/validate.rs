use anchor_lang::prelude::*;

pub trait Validate<'info> {
    /// Validates the account struct.
    fn validate(&self) -> Result<()>;
}
