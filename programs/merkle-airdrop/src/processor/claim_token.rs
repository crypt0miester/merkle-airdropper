use crate::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

#[derive(Accounts)]
#[instruction(root: [u8; 32], amount: u64, verification_data: Vec<u8>)]
pub struct Claim<'info> {
    /// Authority just needs to pay for the receipt rent. Does not actually have
    /// to be the recipient.
    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: checked below
    #[account(mut)]
    pub owner_mint_ata: UncheckedAccount<'info>,

    #[account(mint::token_program = spl_token_program)]
    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        seeds = ["receipt".as_ref(), airdrop_state.key().as_ref(), owner.key().as_ref(), &verification_data[0..8]],
        bump,
        space = 8 + std::mem::size_of::<Receipt>(),
        payer = owner
    )]
    pub receipt: Account<'info, Receipt>,
    
    #[account(
        has_one = token_mint,
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

pub fn handle_claim(ctx: Context<Claim>, root: [u8; 32], amount: u64, verification_data: Vec<u8>) -> Result<()> {
    let owner = &ctx.accounts.owner;
    let token_mint = &ctx.accounts.token_mint;
    let owner_mint_ata = &ctx.accounts.owner_mint_ata;
    let airdrop_state = &ctx.accounts.airdrop_state;
    let vault = &ctx.accounts.vault;

    // Do the verification
    let verification_index_array: [u8; 8] = verification_data[0..8]
        .try_into()
        .expect("Invalid verification data");
    let verification_index: u64 = u64::from_le_bytes(verification_index_array);

    msg!("Verification Data {:02X?}", verification_data);
    msg!("Verification Data Length {}", verification_data.len());
    msg!("Amount {}", amount);
    msg!("Verification Index {}", verification_index);

    let leaf: [u8; 32] = anchor_lang::solana_program::keccak::hashv(&[
        &verification_index.to_le_bytes(),
        &ctx.accounts.owner.key().to_bytes(),
        &amount.to_le_bytes(),
    ])
    .0;

    let mut proof: Vec<[u8; 32]> = Vec::new();
    // Convert the Vec<u8> into Vec<[u8; 32]> and call the verifier
    let mut iter = verification_data[8..].chunks(32);
    while iter.len() > 0 {
        let next_hash: [u8; 32] = iter
            .next()
            .unwrap()
            .try_into()
            .expect("Invalid verification data");
        proof.push(next_hash);
        msg!("Proof hash {:02X?}", next_hash);
    }

    // This is the actual verification.
    verify_proof(proof, ctx.accounts.airdrop_state.root, leaf);

    // Fill in the receipt. Just the presence of this object makes another
    // attempt at verify fail.
    ctx.accounts.receipt.index = verification_index;
    ctx.accounts.receipt.recipient = ctx.accounts.owner.key();

    msg!("Claiming {:#} tokens", amount);

    if owner_mint_ata.data_is_empty() {
        make_ata(
            owner_mint_ata.to_account_info(),
            owner.to_account_info(),
            token_mint.to_account_info(),
            owner.to_account_info(),
            ctx.accounts.ata_program.to_account_info(),
            ctx.accounts.spl_token_program.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            &[],
        )?;
    }

    if airdrop_state.is_token_2022 {
        assert_is_ata_2022(
            &owner_mint_ata,
            owner.key,
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
        assert_is_ata(&owner_mint_ata, owner.key, &token_mint.key())?;
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
            owner_mint_ata.key,
            &airdrop_state.key(),
            &[],
            amount,
            token_mint.decimals,
        )?
    } else {
        spl_token::instruction::transfer(
            ctx.accounts.spl_token_program.key,
            &vault.key(),
            owner_mint_ata.key,
            &airdrop_state.key(),
            &[],
            amount,
        )?
    };

    let airdrop_state_bump = ctx
        .bumps
        .airdrop_state;
    let airdrop_state_prefix = "airdrop_state".to_string();
    let token_mint_key = token_mint.key();
    
    let signer_seeds: &[&[u8]] = &[
        &airdrop_state_prefix.as_bytes(),
        &token_mint_key.as_ref(), 
        &root.as_ref(),
        &[airdrop_state_bump],
    ];

    let mut invoke_args = vec![
        owner_mint_ata.to_account_info(),
        vault.to_account_info(),
        ctx.accounts.spl_token_program.to_account_info(),
        airdrop_state.to_account_info(),
    ];

    if airdrop_state.is_token_2022 {
        invoke_args.push(token_mint.to_account_info());
    }

    invoke_signed(&transfer_ix, &invoke_args, &[signer_seeds])?;

    Ok(())
}
