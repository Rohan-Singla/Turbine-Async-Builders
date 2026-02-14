use anchor_lang::prelude::*;
use anchor_spl::token_interface::{TokenAccount, TokenInterface};
use crate::state::{Proposal, Vote};

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,

    #[account(
        
        init, payer = voter, space = 8 + Vote::INIT_SPACE, seeds = [b"vote", voter.key().as_ref(),proposal.key().as_ref()], bump
    
    )]

    pub vote_account: Account<'info, Vote>,
    #[account(token::authority = voter)]
    pub creator_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn cast_vote(ctx: Context<CastVote>, vote_type: u8) -> Result<()> {
    let vote_account = &mut ctx.accounts.vote_account;
    let proposal_account = &mut ctx.accounts.proposal;
    let voting_credits = (ctx.accounts.creator_token_account.amount as f64).sqrt() as u64;

    vote_account.set_inner(Vote {
        vote_type,
        authority: ctx.accounts.voter.key(),
        vote_credits: voting_credits,
        bump: ctx.bumps.vote_account,
    });

    match vote_type {
        0 => proposal_account.no_vote_count += voting_credits,
        1 => proposal_account.yes_vote_count += voting_credits,
        _ => return Err(anchor_lang::error::ErrorCode::InstructionFallbackNotFound.into()),
    }

    Ok(())
}