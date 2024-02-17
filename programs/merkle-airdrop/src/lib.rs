use anchor_lang::prelude::*;

mod processor;
mod utils;
mod state;
mod errors;
pub use crate::processor::*;
pub use crate::state::*;
pub use crate::utils::*;
pub use crate::errors::*;

declare_id!("HjHfxeQKw3MKVae6W29YLEeFkohABygiY71Zq1J6FJsd");

#[program]
pub mod merkle_airdrop {
    use super::*;

    pub fn claim(ctx: Context<Claim>, root: [u8; 32], amount: u64, verification_data: Vec<u8>) -> Result<()> {
        handle_claim(ctx, root, amount, verification_data)
    }

    pub fn init(ctx: Context<InitializeAirdropState>, root: [u8; 32], is_token_2022: bool) -> Result<()> {
        handle_init(ctx, root, is_token_2022)
    }

    pub fn withdraw_from_vault(ctx: Context<WithdrawTokensFromVault>, _root: [u8; 32]) -> Result<()> {
        handle_withdraw_tokens_from_vault(ctx)
    }
}