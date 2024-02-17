use anchor_lang::prelude::*;

mod processor;
mod utils;
mod state;
mod errors;
pub use crate::processor::*;
pub use crate::state::*;
pub use crate::utils::*;
pub use crate::errors::*;

declare_id!("8BjdTzm1Q852B2FqJagx3aAqpmuTjF4hatTBn7uAXt7f");

#[program]
pub mod merkle_airdrop {
    use super::*;

    pub fn claim(ctx: Context<Claim>, root: [u8; 32], amount: u64, verification_data: Vec<u8>) -> Result<()> {
        handle_claim(ctx, root, amount, verification_data)
    }

    pub fn init(ctx: Context<InitializeAirdropState>, root: [u8; 32], is_token_2022: bool) -> Result<()> {
        handle_init(ctx, root, is_token_2022)
    }
}