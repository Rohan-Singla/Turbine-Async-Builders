use anchor_lang::prelude::*;

#[account]
#[derive(Debug,InitSpace)]
pub struct Dao {
    #[max_len(500)]
    pub name: String,
    pub authority: Pubkey,
    pub proposal_account: u64,
    pub bump: u8,
}

#[account]
#[derive(Debug,InitSpace)]
pub struct Proposal {
    #[max_len(500)]
    pub metadata: String,
    pub authority: Pubkey,
    pub yes_vote_count: u64,
    pub no_vote_count: u64,
    pub bump: u8,
}

#[account]
#[derive(Debug,InitSpace)]
pub struct Vote {
    pub vote_type: u8,
    pub authority: Pubkey,
    pub vote_credits: u64,
    pub bump: u8,
}