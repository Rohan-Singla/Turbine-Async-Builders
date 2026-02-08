import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { AnchorAmmQ425 } from "../target/types/anchor_amm_q4_25";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
  getAccount,
  getMint,
} from "@solana/spl-token";
import { assert } from "chai";

describe("anchor-amm-q4-25", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.anchorAmmQ425 as Program<AnchorAmmQ425>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  // Token mints
  let mintX: PublicKey;
  let mintY: PublicKey;

  // PDAs
  let config: PublicKey;
  let mintLp: PublicKey;
  let vaultX: PublicKey;
  let vaultY: PublicKey;

  // User token accounts
  let userX: PublicKey;
  let userY: PublicKey;
  let userLp: PublicKey;

  // Constants
  const seed = new BN(1);
  const fee = 300; // 3% fee in basis points
  const decimals = 6;

  // Amounts
  const initialMintAmount = 1_000_000 * 10 ** decimals; // 1M tokens
  const depositAmountX = 100_000 * 10 ** decimals; // 100K tokens
  const depositAmountY = 100_000 * 10 ** decimals; // 100K tokens
  const lpAmount = 100_000 * 10 ** decimals; // LP tokens to claim

  before(async () => {
    // Create token mints
    mintX = await createMint(
      connection,
      payer,
      payer.publicKey,
      null,
      decimals
    );

    mintY = await createMint(
      connection,
      payer,
      payer.publicKey,
      null,
      decimals
    );

    // Derive PDAs
    [config] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    [mintLp] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp"), config.toBuffer()],
      program.programId
    );

    vaultX = await getAssociatedTokenAddress(mintX, config, true);
    vaultY = await getAssociatedTokenAddress(mintY, config, true);

    // Create user token accounts
    userX = await createAssociatedTokenAccount(
      connection,
      payer,
      mintX,
      payer.publicKey
    );

    userY = await createAssociatedTokenAccount(
      connection,
      payer,
      mintY,
      payer.publicKey
    );

    // Mint tokens to user
    await mintTo(
      connection,
      payer,
      mintX,
      userX,
      payer,
      initialMintAmount
    );

    await mintTo(
      connection,
      payer,
      mintY,
      userY,
      payer,
      initialMintAmount
    );

    // User LP account will be created by deposit instruction
    userLp = await getAssociatedTokenAddress(mintLp, payer.publicKey);
  });

  it("1. Initialize pool", async () => {
    const tx = await program.methods
      .initialize(seed, fee, null)
      .accountsPartial({
        initializer: payer.publicKey,
        mintX,
        mintY,
        mintLp,
        vaultX,
        vaultY,
        config,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Initialize tx:", tx);

    // Verify config account
    const configAccount = await program.account.config.fetch(config);
    assert.equal(configAccount.seed.toNumber(), seed.toNumber());
    assert.equal(configAccount.fee, fee);
    assert.equal(configAccount.locked, false);
    assert.equal(configAccount.mintX.toBase58(), mintX.toBase58());
    assert.equal(configAccount.mintY.toBase58(), mintY.toBase58());
  });

  it("2. Deposit liquidity (first deposit)", async () => {
    const tx = await program.methods
      .deposit(new BN(lpAmount), new BN(depositAmountX), new BN(depositAmountY))
      .accountsPartial({
        user: payer.publicKey,
        mintX,
        mintY,
        config,
        mintLp,
        vaultX,
        vaultY,
        userX,
        userY,
        userLp,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Deposit tx:", tx);

    // Verify vault balances
    const vaultXAccount = await getAccount(connection, vaultX);
    const vaultYAccount = await getAccount(connection, vaultY);
    assert.equal(Number(vaultXAccount.amount), depositAmountX);
    assert.equal(Number(vaultYAccount.amount), depositAmountY);

    // Verify LP token balance
    const userLpAccount = await getAccount(connection, userLp);
    assert.equal(Number(userLpAccount.amount), lpAmount);
  });

  it("3. Swap X for Y", async () => {
    const swapAmount = 10_000 * 10 ** decimals; // 10K tokens
    const minOutput = 1; // Minimum output (slippage protection)

    // Get initial balances
    const userXBefore = await getAccount(connection, userX);
    const userYBefore = await getAccount(connection, userY);
    const vaultXBefore = await getAccount(connection, vaultX);
    const vaultYBefore = await getAccount(connection, vaultY);

    const tx = await program.methods
      .swap(true, new BN(swapAmount), new BN(minOutput))
      .accountsPartial({
        user: payer.publicKey,
        mintX,
        mintY,
        config,
        vaultX,
        vaultY,
        userX,
        userY,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Swap X->Y tx:", tx);

    // Get final balances
    const userXAfter = await getAccount(connection, userX);
    const userYAfter = await getAccount(connection, userY);
    const vaultXAfter = await getAccount(connection, vaultX);
    const vaultYAfter = await getAccount(connection, vaultY);

    // Verify user X decreased
    assert.isTrue(
      Number(userXAfter.amount) < Number(userXBefore.amount),
      "User X balance should decrease"
    );

    // Verify user Y increased
    assert.isTrue(
      Number(userYAfter.amount) > Number(userYBefore.amount),
      "User Y balance should increase"
    );

    // Verify vault X increased
    assert.isTrue(
      Number(vaultXAfter.amount) > Number(vaultXBefore.amount),
      "Vault X balance should increase"
    );

    // Verify vault Y decreased
    assert.isTrue(
      Number(vaultYAfter.amount) < Number(vaultYBefore.amount),
      "Vault Y balance should decrease"
    );

    // Calculate expected output manually to verify
    // fee = swapAmount * 300 / 10000 = swapAmount * 0.03
    // amountAfterFee = swapAmount - fee = swapAmount * 0.97
    // output = (amountAfterFee * vaultY) / (vaultX + amountAfterFee)
    const feeAmount = Math.floor((swapAmount * fee) / 10000);
    const amountAfterFee = swapAmount - feeAmount;
    const expectedOutput = Math.floor(
      (amountAfterFee * Number(vaultYBefore.amount)) /
        (Number(vaultXBefore.amount) + amountAfterFee)
    );

    const actualOutput =
      Number(userYAfter.amount) - Number(userYBefore.amount);
    assert.equal(actualOutput, expectedOutput, "Output should match expected");

    console.log(`  Swapped ${swapAmount / 10 ** decimals} X for ${actualOutput / 10 ** decimals} Y`);
  });

  it("4. Swap Y for X", async () => {
    const swapAmount = 5_000 * 10 ** decimals; // 5K tokens
    const minOutput = 1; // Minimum output (slippage protection)

    // Get initial balances
    const userXBefore = await getAccount(connection, userX);
    const userYBefore = await getAccount(connection, userY);
    const vaultXBefore = await getAccount(connection, vaultX);
    const vaultYBefore = await getAccount(connection, vaultY);

    const tx = await program.methods
      .swap(false, new BN(swapAmount), new BN(minOutput))
      .accountsPartial({
        user: payer.publicKey,
        mintX,
        mintY,
        config,
        vaultX,
        vaultY,
        userX,
        userY,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Swap Y->X tx:", tx);

    // Get final balances
    const userXAfter = await getAccount(connection, userX);
    const userYAfter = await getAccount(connection, userY);
    const vaultXAfter = await getAccount(connection, vaultX);
    const vaultYAfter = await getAccount(connection, vaultY);

    // Verify user X increased
    assert.isTrue(
      Number(userXAfter.amount) > Number(userXBefore.amount),
      "User X balance should increase"
    );

    // Verify user Y decreased
    assert.isTrue(
      Number(userYAfter.amount) < Number(userYBefore.amount),
      "User Y balance should decrease"
    );

    // Verify vault X decreased
    assert.isTrue(
      Number(vaultXAfter.amount) < Number(vaultXBefore.amount),
      "Vault X balance should decrease"
    );

    // Verify vault Y increased
    assert.isTrue(
      Number(vaultYAfter.amount) > Number(vaultYBefore.amount),
      "Vault Y balance should increase"
    );

    // Calculate expected output manually
    const feeAmount = Math.floor((swapAmount * fee) / 10000);
    const amountAfterFee = swapAmount - feeAmount;
    const expectedOutput = Math.floor(
      (amountAfterFee * Number(vaultXBefore.amount)) /
        (Number(vaultYBefore.amount) + amountAfterFee)
    );

    const actualOutput =
      Number(userXAfter.amount) - Number(userXBefore.amount);
    assert.equal(actualOutput, expectedOutput, "Output should match expected");

    console.log(`  Swapped ${swapAmount / 10 ** decimals} Y for ${actualOutput / 10 ** decimals} X`);
  });

  it("5. Deposit more liquidity (maintains ratio)", async () => {
    const additionalLpAmount = 50_000 * 10 ** decimals; // 50K LP tokens

    // Get current vault balances to calculate required deposit
    const vaultXBefore = await getAccount(connection, vaultX);
    const vaultYBefore = await getAccount(connection, vaultY);
    const userXBefore = await getAccount(connection, userX);
    const userYBefore = await getAccount(connection, userY);
    const userLpBefore = await getAccount(connection, userLp);

    // Set max to high values since we want to accept the calculated amounts
    const maxX = new BN(Number(userXBefore.amount));
    const maxY = new BN(Number(userYBefore.amount));

    const tx = await program.methods
      .deposit(new BN(additionalLpAmount), maxX, maxY)
      .accountsPartial({
        user: payer.publicKey,
        mintX,
        mintY,
        config,
        mintLp,
        vaultX,
        vaultY,
        userX,
        userY,
        userLp,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Deposit more tx:", tx);

    // Verify LP tokens increased
    const userLpAfter = await getAccount(connection, userLp);
    assert.equal(
      Number(userLpAfter.amount),
      Number(userLpBefore.amount) + additionalLpAmount,
      "LP balance should increase"
    );

    // Verify vault balances increased
    const vaultXAfter = await getAccount(connection, vaultX);
    const vaultYAfter = await getAccount(connection, vaultY);
    assert.isTrue(
      Number(vaultXAfter.amount) > Number(vaultXBefore.amount),
      "Vault X should increase"
    );
    assert.isTrue(
      Number(vaultYAfter.amount) > Number(vaultYBefore.amount),
      "Vault Y should increase"
    );

    console.log(`  Deposited for ${additionalLpAmount / 10 ** decimals} LP tokens`);
  });

  it("6. Withdraw liquidity", async () => {
    const withdrawLpAmount = 50_000 * 10 ** decimals; // 50K LP tokens

    // Get balances before withdrawal
    const vaultXBefore = await getAccount(connection, vaultX);
    const vaultYBefore = await getAccount(connection, vaultY);
    const userXBefore = await getAccount(connection, userX);
    const userYBefore = await getAccount(connection, userY);
    const userLpBefore = await getAccount(connection, userLp);
    const mintLpAccount = await getMint(connection, mintLp);
    const lpSupply = Number(mintLpAccount.supply);

    // Calculate expected withdrawal amounts
    const expectedX = Math.floor(
      (withdrawLpAmount * Number(vaultXBefore.amount)) / lpSupply
    );
    const expectedY = Math.floor(
      (withdrawLpAmount * Number(vaultYBefore.amount)) / lpSupply
    );

    const tx = await program.methods
      .withdraw(new BN(withdrawLpAmount), new BN(1), new BN(1))
      .accountsPartial({
        user: payer.publicKey,
        mintX,
        mintY,
        config,
        mintLp,
        vaultX,
        vaultY,
        userX,
        userY,
        userLp,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Withdraw tx:", tx);

    // Verify LP tokens burned
    const userLpAfter = await getAccount(connection, userLp);
    assert.equal(
      Number(userLpAfter.amount),
      Number(userLpBefore.amount) - withdrawLpAmount,
      "LP balance should decrease"
    );

    // Verify user received tokens
    const userXAfter = await getAccount(connection, userX);
    const userYAfter = await getAccount(connection, userY);
    const actualX = Number(userXAfter.amount) - Number(userXBefore.amount);
    const actualY = Number(userYAfter.amount) - Number(userYBefore.amount);

    assert.equal(actualX, expectedX, "X withdrawal should match expected");
    assert.equal(actualY, expectedY, "Y withdrawal should match expected");

    // Verify vault balances decreased
    const vaultXAfter = await getAccount(connection, vaultX);
    const vaultYAfter = await getAccount(connection, vaultY);
    assert.equal(
      Number(vaultXAfter.amount),
      Number(vaultXBefore.amount) - expectedX,
      "Vault X should decrease"
    );
    assert.equal(
      Number(vaultYAfter.amount),
      Number(vaultYBefore.amount) - expectedY,
      "Vault Y should decrease"
    );

    console.log(`  Withdrew ${actualX / 10 ** decimals} X and ${actualY / 10 ** decimals} Y for ${withdrawLpAmount / 10 ** decimals} LP tokens`);
  });
});
