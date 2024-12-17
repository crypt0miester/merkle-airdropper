use anchor_lang::prelude::*;

mod errors;
mod processor;
mod state;
mod utils;
pub use crate::errors::*;
pub use crate::processor::*;
pub use crate::state::*;
pub use crate::utils::*;

declare_id!("6ejWDiN63M19QaDAwEMw9kWNLrMbmL9SbecY5MejCT8Y");

#[program]
pub mod merkle_airdrop {
    use super::*;

    pub fn claim(
        ctx: Context<Claim>,
        root: [u8; 32],
        amount: u64,
        verification_data: Vec<u8>,
    ) -> Result<()> {
        handle_claim(ctx, root, amount, verification_data)
    }

    pub fn init(ctx: Context<InitializeAirdropState>, root: [u8; 32]) -> Result<()> {
        handle_init(ctx, root)
    }

    pub fn withdraw_from_vault(
        ctx: Context<WithdrawTokensFromVault>,
        _root: [u8; 32],
    ) -> Result<()> {
        handle_withdraw_tokens_from_vault(ctx)
    }
}
