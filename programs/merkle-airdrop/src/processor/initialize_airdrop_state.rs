use crate::*;

use anchor_spl::token_interface::{Mint, TokenInterface};

#[derive(Accounts)]
#[instruction(root: [u8; 32])]
pub struct InitializeAirdropState<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        seeds = [&"airdrop_state".to_string().as_bytes(), token_mint.key().as_ref(), &root.as_ref()],
        bump,
        space = 8 + std::mem::size_of::<AirdropState>(),
        payer = authority
    )]
    pub airdrop_state: Account<'info, AirdropState>,

    #[account(mut, mint::token_program = spl_token_program)]
    pub token_mint: InterfaceAccount<'info, Mint>,

    /// The SPL token program account
    pub spl_token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handle_init(ctx: Context<InitializeAirdropState>, root: [u8; 32], is_token_2022: bool) -> Result<()> {
    ctx.accounts.airdrop_state.root = root;
    ctx.accounts.airdrop_state.authority = ctx.accounts.authority.key();
    ctx.accounts.airdrop_state.token_mint = ctx.accounts.token_mint.key();
    ctx.accounts.airdrop_state.is_token_2022 = is_token_2022;
    
    Ok(())
}