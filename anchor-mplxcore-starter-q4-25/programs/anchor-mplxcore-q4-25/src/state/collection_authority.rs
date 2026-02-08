use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct CollectionAuthority {
    pub creator: Pubkey,
    pub collection: Pubkey,
    #[max_len(32)]
    pub nft_name: String,
    #[max_len(200)]
    pub nft_uri: String,
    pub bump: u8,
}