use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};
use solana_program::{
    ed25519_program,
    hash,
    sysvar::instructions as ix_sysvar,
};

use crate::{errors::DiceError, state::Bet};

#[derive(Accounts)]
pub struct ResolveBet<'info> {
    #[account(mut, address = bet.player)]
    pub player: SystemAccount<'info>,
    pub house: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", house.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,
    #[account(
        mut,
        close = player,
        seeds = [b"bet", vault.key().as_ref(), bet.seed.to_le_bytes().as_ref()],
        bump = bet.bump
    )]
    pub bet: Account<'info, Bet>,
    /// CHECK: Instructions sysvar
    #[account(address = ix_sysvar::ID)]
    pub instruction_sysvar: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> ResolveBet<'info> {
    pub fn verify_ed25519_signature(&self, sig: &[u8]) -> Result<()> {
        let ix = ix_sysvar::load_instruction_at_checked(0, &self.instruction_sysvar)
            .map_err(|_| DiceError::Ed25519Accounts)?;

        require_keys_eq!(ix.program_id, ed25519_program::ID, DiceError::Ed25519Program);

        require!(ix.data.len() >= 16, DiceError::Ed25519DataLength);

        require!(ix.data[0] == 1, DiceError::Ed25519Header);

        let sig_offset = u16::from_le_bytes([ix.data[2], ix.data[3]]) as usize;
        let pk_offset = u16::from_le_bytes([ix.data[6], ix.data[7]]) as usize;
        let msg_offset = u16::from_le_bytes([ix.data[10], ix.data[11]]) as usize;
        let msg_size = u16::from_le_bytes([ix.data[12], ix.data[13]]) as usize;

        require!(ix.data.len() >= sig_offset + 64, DiceError::Ed25519DataLength);
        require!(
            ix.data[sig_offset..sig_offset + 64] == sig[..64],
            DiceError::Ed25519Signature
        );

        require!(ix.data.len() >= pk_offset + 32, DiceError::Ed25519DataLength);
        require!(
            ix.data[pk_offset..pk_offset + 32] == self.house.key().to_bytes(),
            DiceError::Ed25519Pubkey
        );

        let bet_data = self.bet.to_slice();
        require!(msg_size == bet_data.len(), DiceError::Ed25519Message);
        require!(ix.data.len() >= msg_offset + msg_size, DiceError::Ed25519DataLength);
        require!(
            ix.data[msg_offset..msg_offset + msg_size] == bet_data[..],
            DiceError::Ed25519Message
        );

        Ok(())
    }

    pub fn resolve_bet(&mut self, sig: &[u8], bumps: &ResolveBetBumps) -> Result<()> {
        let hash = hash::hash(sig);
        let hash_bytes = hash.to_bytes();

        let roll_result = (hash_bytes[0] as u16 * 100 / 256) as u8;

        if roll_result < self.bet.roll {
            let payout = (self.bet.amount as u128)
                .checked_mul(100)
                .ok_or(DiceError::Overflow)?
                .checked_div(self.bet.roll as u128)
                .ok_or(DiceError::Overflow)? as u64;

            let accounts = Transfer {
                from: self.vault.to_account_info(),
                to: self.player.to_account_info(),
            };

            let signer_seeds: &[&[&[u8]]] = &[&[
                b"vault",
                &self.house.key().to_bytes(),
                &[bumps.vault],
            ]];

            let ctx = CpiContext::new_with_signer(
                self.system_program.to_account_info(),
                accounts,
                signer_seeds,
            );

            transfer(ctx, payout)?;
        }

        Ok(())
    }
}
