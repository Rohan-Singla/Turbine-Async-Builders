import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorDiceGameQ425 } from "../target/types/anchor_dice_game_q4_25";
import {
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Ed25519Program,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Keypair,
} from "@solana/web3.js";
import { assert } from "chai";
import BN from "bn.js";

describe("anchor-dice-game-q4-25", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .anchorDiceGameQ425 as Program<AnchorDiceGameQ425>;

  const house = (provider.wallet as anchor.Wallet).payer;

  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), house.publicKey.toBuffer()],
    program.programId
  );

  const seed = new BN(1);

  const [betPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("bet"),
      vault.toBuffer(),
      seed.toArrayLike(Buffer, "le", 16),
    ],
    program.programId
  );

  it("Initialize - house funds the vault", async () => {
    const amount = new BN(2 * LAMPORTS_PER_SOL);

    const vaultBalanceBefore = await provider.connection.getBalance(vault);

    const tx = await program.methods
      .initialize(amount)
      .accounts({
        house: house.publicKey,
        vault: vault,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const vaultBalanceAfter = await provider.connection.getBalance(vault);
    assert.equal(
      vaultBalanceAfter - vaultBalanceBefore,
      2 * LAMPORTS_PER_SOL,
      "Vault should receive 2 SOL"
    );
    console.log("Initialize tx:", tx);
  });

  it("Place bet - player places a bet", async () => {
    const roll = 50;
    const amount = new BN(0.1 * LAMPORTS_PER_SOL);

    const tx = await program.methods
      .placeBet(seed, roll, amount)
      .accounts({
        player: house.publicKey,
        house: house.publicKey,
        vault: vault,
        bet: betPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const betAccount = await program.account.bet.fetch(betPda);
    assert.equal(
      betAccount.player.toBase58(),
      house.publicKey.toBase58(),
      "Bet player should match"
    );
    assert.equal(betAccount.roll, roll, "Roll should be 50");
    assert.equal(
      betAccount.amount.toNumber(),
      0.1 * LAMPORTS_PER_SOL,
      "Bet amount should be 0.1 SOL"
    );
    assert.ok(betAccount.seed.eq(seed), "Seed should match");

    console.log("Place bet tx:", tx);
  });

  it("Refund bet - fails if timeout not reached", async () => {
    try {
      await program.methods
        .refundBet()
        .accounts({
          player: house.publicKey,
          house: house.publicKey,
          vault: vault,
          bet: betPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should have failed with TimeoutNotReached");
    } catch (err) {
      assert.include(err.toString(), "Timeout not yet reached");
    }
  });

  it("Resolve bet - house resolves the bet", async () => {
    const betAccount = await program.account.bet.fetch(betPda);

    const betData = Buffer.concat([
      betAccount.player.toBuffer(), 
      betAccount.seed.toArrayLike(Buffer, "le", 16),
      betAccount.slot.toArrayLike(Buffer, "le", 8),
      betAccount.amount.toArrayLike(Buffer, "le", 8), 
      Buffer.from([betAccount.roll, betAccount.bump]), 
    ]);

    const ed25519Ix = Ed25519Program.createInstructionWithPrivateKey({
      privateKey: house.secretKey,
      message: betData,
    });

    // Read signature offset from Ed25519 instruction header (bytes 2-3, u16 LE)
    const sigOffset = ed25519Ix.data.readUInt16LE(2);
    const sig = Buffer.from(ed25519Ix.data.slice(sigOffset, sigOffset + 64));

    const vaultBefore = await provider.connection.getBalance(vault);
    const playerBefore = await provider.connection.getBalance(house.publicKey);

    const tx = await program.methods
      .resolveBet(sig)
      .accounts({
        player: house.publicKey,
        house: house.publicKey,
        vault: vault,
        bet: betPda,
        instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([ed25519Ix])
      .rpc();

    const betAccountInfo = await provider.connection.getAccountInfo(betPda);
    assert.isNull(betAccountInfo, "Bet account should be closed after resolve");

    console.log("Resolve bet tx:", tx);
  });
});
