use anchor_lang::prelude::*;

#[error_code]
pub enum MerkleAirdropError {
    // 6000
    #[msg("PublicKeyMismatch")]
    PublicKeyMismatch,
    // 6001
    #[msg("UninitializedAccount")]
    UninitializedAccount,
    // 6002
    #[msg("IncorrectAuthority")]
    IncorrectAuthority,
    // 6003
    #[msg("NumericalOverflow")]
    NumericalOverflow,
    // 6004
    #[msg("Derived key invalid")]
    DerivedKeyInvalid,
    // 6005
    #[msg("Wrong account owner")]
    WrongAccountOwner,
}