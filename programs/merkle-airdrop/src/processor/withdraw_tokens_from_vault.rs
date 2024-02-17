use crate::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

#[derive(Accounts)]
#[instruction(root: [u8; 32])]
pub struct WithdrawTokensFromVault<'info> {
    /// Airdrop State Authority
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: checked below
    #[account(mut)]
    pub authority_mint_ata: UncheckedAccount<'info>,

    #[account(mint::token_program = spl_token_program)]
    pub token_mint: InterfaceAccount<'info, Mint>,
    
    #[account(
        mut,
        has_one = token_mint,
        has_one = authority,
        seeds = [&"airdrop_state".to_string().as_bytes(), token_mint.key().as_ref(), &root.as_ref()],
        bump,)]
    pub airdrop_state: Account<'info, AirdropState>,

    #[account(mut,
        token::mint = token_mint,
        token::authority = airdrop_state,
        token::token_program = spl_token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    /// The SPL token program account
    pub spl_token_program: Interface<'info, TokenInterface>,
    pub ata_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,
}

pub fn handle_withdraw_tokens_from_vault(ctx: Context<WithdrawTokensFromVault>) -> Result<()> {
    let authority = &ctx.accounts.authority;
    let token_mint = &ctx.accounts.token_mint;
    let authority_mint_ata = &ctx.accounts.authority_mint_ata;
    let airdrop_state = &ctx.accounts.airdrop_state;
    let vault = &ctx.accounts.vault;
    let amount = vault.amount;

    msg!("Withdrawing {:#} tokens", amount);

    if authority_mint_ata.data_is_empty() {
        make_ata(
            authority_mint_ata.to_account_info(),
            authority.to_account_info(),
            token_mint.to_account_info(),
            authority.to_account_info(),
            ctx.accounts.ata_program.to_account_info(),
            ctx.accounts.spl_token_program.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            &[],
        )?;
    }

    if airdrop_state.is_token_2022 {
        assert_is_ata_2022(
            &authority_mint_ata,
            authority.key,
            &token_mint.key(),
            airdrop_state.is_token_2022,
            false,
        )?;
        assert_is_ata_2022(
            &vault.to_account_info(),
            &airdrop_state.key(),
            &token_mint.key(),
            airdrop_state.is_token_2022,
            false,
        )?;
    } else {
        assert_is_ata(&authority_mint_ata, authority.key, &token_mint.key())?;
        assert_is_ata(
            &vault.to_account_info(),
            &airdrop_state.key(),
            &token_mint.key(),
        )?;
    }

    let transfer_ix = if airdrop_state.is_token_2022 {
        spl_token_2022::instruction::transfer_checked(
            ctx.accounts.spl_token_program.key,
            &vault.key(),
            &token_mint.key(),
            authority_mint_ata.key,
            &airdrop_state.key(),
            &[],
            amount,
            token_mint.decimals,
        )?
    } else {
        spl_token::instruction::transfer(
            ctx.accounts.spl_token_program.key,
            &vault.key(),
            authority_mint_ata.key,
            &airdrop_state.key(),
            &[],
            amount,
        )?
    };

    let airdrop_state_bump = ctx
        .bumps
        .airdrop_state;
    let airdrop_state_prefix = "airdrop_state".to_string();
    let root = airdrop_state.root;
    let token_mint_key = token_mint.key();
    
    let signer_seeds: &[&[u8]] = &[
        &airdrop_state_prefix.as_bytes(),
        &token_mint_key.as_ref(), 
        &root.as_ref(),
        &[airdrop_state_bump],
    ];

    let mut invoke_args = vec![
        authority_mint_ata.to_account_info(),
        vault.to_account_info(),
        ctx.accounts.spl_token_program.to_account_info(),
        airdrop_state.to_account_info(),
    ];

    if airdrop_state.is_token_2022 {
        invoke_args.push(token_mint.to_account_info());
    }

    invoke_signed(&transfer_ix, &invoke_args, &[signer_seeds])?;

    airdrop_state.close(authority.to_account_info())?;
    Ok(())
}
