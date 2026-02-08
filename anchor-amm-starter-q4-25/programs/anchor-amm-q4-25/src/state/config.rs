use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub seed: u64,                 // Seed to be able to create different pools / configs
    pub authority: Option<Pubkey>, // If we want an authority to lock the config account
    pub mint_x: Pubkey,            // Token X
    pub mint_y: Pubkey,            // Token Y
    pub fee: u16,                  // Swap fee in basis points
    pub locked: bool,              // If the pool is locked
    pub config_bump: u8,           // Bump seed for the config account
    pub lp_bump: u8,               // Bump seed for the LP token
}
