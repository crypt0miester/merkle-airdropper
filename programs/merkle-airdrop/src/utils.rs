use anchor_lang::{prelude::*, solana_program::{program::invoke_signed, program_memory::sol_memcmp, program_pack::{IsInitialized, Pack}, pubkey::PUBKEY_BYTES}};
use anchor_spl::associated_token::get_associated_token_address_with_program_id;

use crate::MerkleAirdropError;

pub fn verify_proof(proof: Vec<[u8; 32]>, root: [u8; 32], leaf: [u8; 32]) {
    let mut current_hash = leaf;
    for node in proof.into_iter() {
        msg!("Current Hash {:02X?}", current_hash);
        // Nodes are arranged so the smaller one is on the left.
        if current_hash <= node {
            current_hash = anchor_lang::solana_program::keccak::hashv(&[&current_hash, &node]).0;
        } else {
            current_hash = anchor_lang::solana_program::keccak::hashv(&[&node, &current_hash]).0;
        }
    }
    msg!("Last Hash {:02X?}", current_hash);
    msg!("Root {:02X?}", root);
    assert_eq!(current_hash, root)
}



pub fn assert_initialized<T: Pack + IsInitialized>(account_info: &AccountInfo) -> Result<T> {
    let account: T = T::unpack_unchecked(&account_info.data.borrow())?;
    if !account.is_initialized() {
        Err(MerkleAirdropError::UninitializedAccount.into())
    } else {
        Ok(account)
    }
}

pub fn assert_is_ata_2022(
    ata: &AccountInfo,
    wallet: &Pubkey,
    mint: &Pubkey,
    is_token_2022: bool,
    initialized: bool,
) -> Result<()> {
    if is_token_2022 {
        if initialized {
            let ata_account: spl_token_2022::state::Account = assert_initialized(ata)?;
            assert_owned_by(ata, &spl_token_2022::id())?;
            assert_keys_equal(ata_account.owner, *wallet)?;
            assert_keys_equal(ata_account.mint, *mint)?;
        }
        assert_keys_equal(
            get_associated_token_address_with_program_id(wallet, mint, &spl_token_2022::id()),
            *ata.key,
        )?;
    } else {
        if initialized {
            let ata_account: spl_token::state::Account = assert_initialized(ata)?;
            assert_owned_by(ata, &spl_token::id())?;
            assert_keys_equal(ata_account.owner, *wallet)?;
            assert_keys_equal(ata_account.mint, *mint)?;
        }
        assert_keys_equal(
            get_associated_token_address_with_program_id(wallet, mint, &spl_token::id()),
            *ata.key,
        )?;
    }

    Ok(())
}

pub fn assert_is_ata(ata: &AccountInfo, wallet: &Pubkey, mint: &Pubkey) -> Result<()> {
    let ata_account: spl_token::state::Account = assert_initialized(ata)?;
    assert_owned_by(ata, &spl_token::id())?;
    assert_keys_equal(ata_account.owner, *wallet)?;
    assert_keys_equal(ata_account.mint, *mint)?;
    assert_keys_equal(
        get_associated_token_address_with_program_id(wallet, mint, &spl_token::id()),
        *ata.key,
    )?;
    Ok(())
}


pub fn assert_owned_by(account: &AccountInfo, owner: &Pubkey) -> Result<()> {
    if account.owner != owner {
        msg!("Wrong account owner: {} should be {}", account.owner, owner);
        return Err(MerkleAirdropError::WrongAccountOwner.into());
    }
    Ok(())
}

pub fn assert_keys_equal(key1: Pubkey, key2: Pubkey) -> Result<()> {
    if sol_memcmp(key1.as_ref(), key2.as_ref(), PUBKEY_BYTES) != 0 {
        msg!("Wrong public key: {} should be {}", key1, key2);
        return err!(MerkleAirdropError::PublicKeyMismatch);
    } else {
        Ok(())
    }
}



pub fn make_ata<'a>(
    ata: AccountInfo<'a>,
    wallet: AccountInfo<'a>,
    mint: AccountInfo<'a>,
    fee_payer: AccountInfo<'a>,
    ata_program: AccountInfo<'a>,
    token_program: AccountInfo<'a>,
    system_program: AccountInfo<'a>,
    // rent: AccountInfo<'a>, not needed anymore
    fee_payer_seeds: &[&[u8]],
) -> Result<()> {
    let as_arr = [fee_payer_seeds];

    let seeds: &[&[&[u8]]] = if !fee_payer_seeds.is_empty() {
        &as_arr
    } else {
        &[]
    };

    invoke_signed(
        &spl_associated_token_account::instruction::create_associated_token_account(
            fee_payer.key,
            wallet.key,
            mint.key,
            token_program.key,
        ),
        &[
            ata,
            wallet,
            mint,
            fee_payer,
            ata_program,
            system_program,
            token_program,
        ],
        seeds,
    )?;

    Ok(())
}
