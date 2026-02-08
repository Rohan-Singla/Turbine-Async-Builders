use anchor_lang::prelude::*;

use crate::{
    error::MPLXCoreError,
    program::AnchorMplxcoreQ425,
    state::WhitelistedCreators,
};

#[derive(Accounts)]
pub struct WhitelistCreator<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK should be a keypair
    pub creator: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        space = WhitelistedCreators::DISCRIMINATOR.len() + WhitelistedCreators::INIT_SPACE,
        seeds = [b"whitelist"],
        bump,
    )]
    pub whitelisted_creators: Account<'info, WhitelistedCreators>,
    pub system_program: Program<'info, System>,
    #[account(constraint = this_program.programdata_address()? == Some(program_data.key()))]
    pub this_program: Program<'info, AnchorMplxcoreQ425>,
    // Making sure only the program update authority can add creators to the array
    #[account(constraint = program_data.upgrade_authority_address == Some(payer.key()) @ MPLXCoreError::NotAuthorized)]
    pub program_data: Account<'info, ProgramData>,
}

impl<'info> WhitelistCreator<'info> {
    pub fn whitelist_creator(&mut self) -> Result<()> {
        self.whitelisted_creators.whitelist_creator(&self.creator)
    }
}