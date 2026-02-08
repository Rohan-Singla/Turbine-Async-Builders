use anchor_lang::prelude::*;
use mpl_core::{
    instructions::CreateV2CpiBuilder,
    types::{Attribute, Attributes, BurnDelegate, FreezeDelegate, Plugin, PluginAuthority, PluginAuthorityPair},
    ID as CORE_PROGRAM_ID,
};

use crate::{error::MPLXCoreError, state::CollectionAuthority};

#[derive(Accounts)]
pub struct MintNft<'info> {
    #[account(mut)]
    pub minter: Signer<'info>,
    #[account(mut, constraint = asset.data_is_empty() @ MPLXCoreError::AssetAlreadyInitialized)]
    pub asset: Signer<'info>,
    #[account(
        mut,
        constraint = collection.owner == &CORE_PROGRAM_ID @ MPLXCoreError::InvalidCollection,
        constraint = !collection.data_is_empty() @ MPLXCoreError::CollectionNotInitialized
    )]
    /// CHECK: This will also be checked by core
    pub collection: UncheckedAccount<'info>,
    #[account(
        seeds = [b"collection_authority", collection.key().as_ref()],
        bump = collection_authority.bump,
    )]
    pub collection_authority: Account<'info, CollectionAuthority>,
    #[account(address = CORE_PROGRAM_ID)]
    /// CHECK: This will also be checked by core
    pub core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> MintNft<'info> {
    pub fn mint_nft(&mut self) -> Result<()> {
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"collection_authority",
            &self.collection.key().to_bytes(),
            &[self.collection_authority.bump],
        ]];

        let current_timestamp = Clock::get()?.unix_timestamp;

        CreateV2CpiBuilder::new(&self.core_program.to_account_info())
            .asset(&self.asset.to_account_info())
            .collection(Some(&self.collection.to_account_info()))
            .authority(Some(&self.collection_authority.to_account_info()))
            .payer(&self.minter.to_account_info())
            .owner(Some(&self.minter.to_account_info()))
            .update_authority(None)
            .system_program(&self.system_program.to_account_info())
            .name(self.collection_authority.nft_name.clone())
            .uri(self.collection_authority.nft_uri.clone())
            .plugins(vec![
                PluginAuthorityPair {
                    plugin: Plugin::Attributes(Attributes {
                        attribute_list: vec![
                            Attribute {
                                key: "Creator".to_string(),
                                value: self.collection_authority.creator.to_string(),
                            },
                            Attribute {
                                key: "Minter".to_string(),
                                value: self.minter.key().to_string(),
                            },
                            Attribute {
                                key: "Collection".to_string(),
                                value: self.collection.key().to_string(),
                            },
                            Attribute {
                                key: "Mint Timestamp".to_string(),
                                value: current_timestamp.to_string(),
                            },
                        ],
                    }),
                    authority: None,
                },
                PluginAuthorityPair {
                    plugin: Plugin::FreezeDelegate(FreezeDelegate { frozen: true }),
                    authority: Some(PluginAuthority::Address {
                        address: self.collection_authority.key(),
                    }),
                },
                PluginAuthorityPair {
                    plugin: Plugin::BurnDelegate(BurnDelegate {}),
                    authority: Some(PluginAuthority::Address {
                        address: self.collection_authority.key(),
                    }),
                },
            ])
            .external_plugin_adapters(vec![])
            .invoke_signed(signer_seeds)?;

        Ok(())
    }
}