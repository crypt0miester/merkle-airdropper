use anchor_lang::prelude::*;

/// State for the verifier
#[account]
pub struct AirdropState {
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub root: [u8; 32],
    pub is_token_2022: bool,
}

/// Receipt for claiming. This prevents multiple redemptions.
#[account]
pub struct Receipt {
    pub index: u64,
    pub recipient: Pubkey,
}