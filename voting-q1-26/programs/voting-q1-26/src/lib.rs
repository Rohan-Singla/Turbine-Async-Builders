use anchor_lang::prelude::*;

mod state;
mod instructions;

use instructions::*;

declare_id!("AeSScPYSECU5wdCP78DU1JHBgJMSSTDQwHfFxmLgmM2f");

#[program]
pub mod voting_q1_26 {
    use super::*;

    pub fn init_dao(ctx: Context<InitDao>, name: String) -> Result<()> {
        instructions::init_dao::init_dao(ctx, name)
    }

    pub fn init_proposal(ctx: Context<InitProposalContext>, metadata: String) -> Result<()> {
        instructions::init_proposal::init_proposal(ctx, metadata)
    }

    pub fn cast_vote(ctx: Context<CastVote>, vote_type: u8) -> Result<()> {
        instructions::cast_vote::cast_vote(ctx, vote_type)
    }
}
