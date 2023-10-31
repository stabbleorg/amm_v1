use anchor_lang::declare_id;

pub mod admin {
    use super::*;
    declare_id!("7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma");
}

pub mod bot {
    use super::*;
    declare_id!("7cfgcwEWQr5vmJrEemdbafhCyTywPYDt46TXQ8wBi4ma");
}

pub mod vault {
    use super::*;

    const SEED_PREFIX: &'static [u8] = b"SLR Vault Authority";
    const BUMP: u8 = 254;

    pub fn authority_seeds<R, F: FnOnce(&[&[u8]]) -> R>(f: F) -> R {
        f(&[SEED_PREFIX, &[BUMP]])
    }

    declare_id!("tvmw3gFJvvWnD2SuvGi6vhMkwNNY6sLwYhBy6XhffU6");
}
