use anchor_lang::prelude::*;
use mpl_core::{
    instructions::UpdatePluginV1CpiBuilder,
    types::{FreezeDelegate, Plugin},
    ID as CORE_PROGRAM_ID,
};

use crate::{error::MPLXCoreError, state::CollectionAuthority};

#[derive(Accounts)]
pub struct ThawNft<'info> {
   // TODO
   #[account(
        mut,
        constraint = collection_authority.creator == authority.key() @MPLXCoreError::NotAuthorized,
   )]
   pub authority: Signer<'info>,

   #[account(mut)]
    /// CHECK: This is checked by the core program
   pub asset: UncheckedAccount<'info>,

   #[account(
        mut,
        constraint = collection.owner == &CORE_PROGRAM_ID @MPLXCoreError::InvalidCollection,
        constraint = !collection.data_is_empty() @MPLXCoreError::NotAuthorized,
   )]
   /// CHECK: checked by the core program
   pub collection: UncheckedAccount<'info>,

   #[account(
        mut,
        seeds = [b"collection_authority", collection.key.as_ref()],
        bump = collection_authority.bump, 
   )]
   pub collection_authority: Account<'info, CollectionAuthority>,

   #[account(address = CORE_PROGRAM_ID)]
   /// CHECK: Checked by core program
   pub core_program: UncheckedAccount<'info>,
   pub system_program: Program<'info, System>,
}

impl<'info> ThawNft<'info> {
    pub fn thaw_nft(&mut self) -> Result<()> {
        // TODO
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"collection_authority",
            self.collection.key.as_ref(),
            &[self.collection_authority.bump],
        ]];

        UpdatePluginV1CpiBuilder::new(&self.core_program)
        .asset(&self.asset)
        .collection(Some(&self.collection))
        .payer(&self.authority)
        .authority(Some(&self.collection_authority.to_account_info()))
        .system_program(&self.system_program)
        .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: false }))
        .invoke_signed(signer_seeds)?;

        Ok(())
    }
}