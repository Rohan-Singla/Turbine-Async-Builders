import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorMplxcoreQ425 } from "../target/types/anchor_mplxcore_q4_25";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { MPL_CORE_PROGRAM_ID } from "@metaplex-foundation/mpl-core";

describe("anchor-mplxcore-q4-25", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.AnchorMplxcoreQ425 as Program<AnchorMplxcoreQ425>;
  const connection = provider.connection;

  // Accounts
  const payer = provider.wallet;
  const creator = Keypair.generate();
  const nonWhitelistedCreator = Keypair.generate();
  const collection = Keypair.generate();
  const asset = Keypair.generate();
  const unauthorizedAuthority = Keypair.generate();
  const invalidCollection = Keypair.generate();


  console.log(`payer / system_wallet ${payer.publicKey.toString()}`);
  console.log(`creator ${creator.publicKey.toString()}`);
  console.log(`nonWhitelistedCreator ${nonWhitelistedCreator.publicKey.toString()}`);
  console.log(`collection ${collection.publicKey.toString()}`);
  console.log(`asset ${asset.publicKey.toString()}`);
  console.log(`unauthorizedAuthority ${unauthorizedAuthority.publicKey.toString()}`);
  console.log(`invalidCollection ${invalidCollection.publicKey.toString()}`);

  // PDAs
  let whitelistedCreatorsPda: PublicKey;
  let collectionAuthorityPda: PublicKey;
  let programDataAccount: PublicKey;
  let invalidCollectionAuthorityPda: PublicKey;


  before(async () => {
    // Fund accounts
    await provider.connection.requestAirdrop(creator.publicKey, 2_000_000_000); // 2 SOL
    await provider.connection.requestAirdrop(nonWhitelistedCreator.publicKey, 2_000_000_000);
    await provider.connection.requestAirdrop(unauthorizedAuthority.publicKey, 2_000_000_000);
    await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for airdrops

    // Derive PDAs
    whitelistedCreatorsPda = PublicKey.findProgramAddressSync(
      [Buffer.from("whitelist")],
      program.programId
    )[0];
    console.log(`whitelistedCreatorsPda ${whitelistedCreatorsPda.toString()}`);

    collectionAuthorityPda = PublicKey.findProgramAddressSync(
      [Buffer.from("collection_authority"), collection.publicKey.toBuffer()],
      program.programId
    )[0];
    console.log(`collectionAuthorityPda ${collectionAuthorityPda.toString()}`);

    invalidCollectionAuthorityPda = PublicKey.findProgramAddressSync(
      [Buffer.from("collection_authority"), invalidCollection.publicKey.toBuffer()],
      program.programId
    )[0];
    console.log(`invalidCollectionAuthorityPda ${invalidCollectionAuthorityPda.toString()}`);

    // Derive ProgramData PDA using the BPF Loader Upgradeable program ID BPFLoaderUpgradeab1e11111111111111111111111
    const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
    programDataAccount = PublicKey.findProgramAddressSync(
      [
        program.programId.toBuffer(),
      ],
      BPF_LOADER_UPGRADEABLE_PROGRAM_ID
    )[0];
    console.log(`programDataAccount ${programDataAccount.toString()}`);
    // Verify ProgramData exists after deployment
    const programData = await connection.getAccountInfo(programDataAccount);
    assert.ok(programData, "ProgramData should exist after deployment");
  });

  describe("WhitelistCreator", () => {
    it("Whitelist a creator", async () => {
      try {
        const sig = await program.methods
          .whitelistCreator()
          .accountsStrict({
            payer: payer.publicKey,
            creator: creator.publicKey,
            whitelistedCreators: whitelistedCreatorsPda,
            systemProgram: SystemProgram.programId,
            thisProgram: program.programId,
            programData: programDataAccount,
          })
          .rpc();
        console.log(`sig ${sig}`);
      } catch (error: any) {
        console.error(`Oops, something went wrong: ${error}`);
        if (error.logs && Array.isArray(error.logs)) {
          console.log("Transaction Logs:");
          error.logs.forEach((log: string) => console.log(log));
        } else {
          console.log("No logs available in the error.");
        }
      }

      const whitelistedCreators = await program.account.whitelistedCreators.fetch(whitelistedCreatorsPda);
      console.log(`whitelistedCreators ${whitelistedCreators.creators}`);
      const creatorPubkeyStr = creator.publicKey.toString();
      assert.include(
        whitelistedCreators.creators.map(c => c.toString()),
        creatorPubkeyStr,
        "Creator should be whitelisted"
      );
    });
  });

  describe("CreateCollection", () => {
    it("Create a collection", async () => {
      const args = {
        name: "Test Collection",
        uri: "https://devnet.irys.xyz/yourhashhere",
        nftName: "Test NFT",
        nftUri: "https://gateway.irys.xyz/yourhashhere",
      };

      try {
        const sig = await program.methods
          .createCollection(args)
          .accountsStrict({
            creator: creator.publicKey,
            collection: collection.publicKey,
            whitelistedCreators: whitelistedCreatorsPda,
            collectionAuthority: collectionAuthorityPda,
            coreProgram: MPL_CORE_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([creator, collection])
          .rpc();
        console.log(`sig ${sig}`);
      } catch (error: any) {
        console.error(`Oops, something went wrong: ${error}`);
        if (error.logs && Array.isArray(error.logs)) {
          console.log("Transaction Logs:");
          error.logs.forEach((log: string) => console.log(log));
        } else {
          console.log("No logs available in the error.");
        }
      }
      const collectionAuthority = await program.account.collectionAuthority.fetch(collectionAuthorityPda);
      assert.equal(collectionAuthority.creator.toString(), creator.publicKey.toString(), "Creator should be the collection authority");
      assert.equal(collectionAuthority.collection.toString(), collection.publicKey.toString());
      assert.equal(collectionAuthority.nftName, args.nftName);
      assert.equal(collectionAuthority.nftUri, args.nftUri);
    });

    it("Non-whitelisted creator cannot create a collection", async () => {
      const args = {
        name: "Invalid Collection",
        uri: "https://example.com/invalid-uri",
        nftName: "Invalid NFT",
        nftUri: "https://example.com/invalid-nft-uri",
      };

      try {
        await program.methods
          .createCollection(args)
          .accountsPartial({
            creator: nonWhitelistedCreator.publicKey,
            collection: invalidCollection.publicKey,
            whitelistedCreators: whitelistedCreatorsPda,
            collectionAuthority: invalidCollectionAuthorityPda,
            coreProgram: MPL_CORE_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([nonWhitelistedCreator, invalidCollection])
          .rpc();
        assert.fail("Should have failed with non-whitelisted creator");
      } catch (error: any) {
        console.error(`Oops, something went wrong: ${error}`);
        if (error.logs && Array.isArray(error.logs)) {
          console.log("Transaction Logs:");
          error.logs.forEach((log: string) => console.log(log));
        } else {
          console.log("No logs available in the error.");
        }
      }
    });
  });

  describe("MintNft", () => {
    it("Mints an NFT", async () => {
      await program.methods
        .mintNft()
        .accountsStrict({
          minter: payer.publicKey,
          asset: asset.publicKey,
          collection: collection.publicKey,
          collectionAuthority: collectionAuthorityPda,
          coreProgram: MPL_CORE_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([asset])
        .rpc();

    });

    it("Fails to mint with invalid collection", async () => {
      const invalidCollection = Keypair.generate();
      const invalidAsset = Keypair.generate();

      try {
        await program.methods
          .mintNft()
          .accountsPartial({
            minter: creator.publicKey,
            asset: invalidAsset.publicKey,
            collection: invalidCollection.publicKey,
            collectionAuthority: collectionAuthorityPda,
            coreProgram: MPL_CORE_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([creator, invalidAsset])
          .rpc();
        assert.fail("Should have failed with invalid collection");
      } catch (err) {
        assert.equal(err.error.errorCode.code, "InvalidCollection", "Expected InvalidCollection error");
      }
    });
  });

  describe("FreezeNft", () => {
    it("Freeze an NFT", async () => {
      await program.methods
        .freezeNft()
        .accountsStrict({
          authority: creator.publicKey,
          asset: asset.publicKey,
          collection: collection.publicKey,
          collectionAuthority: collectionAuthorityPda,
          coreProgram: MPL_CORE_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

    });

    it("Fails to freeze with unauthorized authority", async () => {
      try {
        await program.methods
          .freezeNft()
          .accountsStrict({
            authority: unauthorizedAuthority.publicKey,
            asset: asset.publicKey,
            collection: collection.publicKey,
            collectionAuthority: collectionAuthorityPda,
            coreProgram: MPL_CORE_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([unauthorizedAuthority])
          .rpc();
        assert.fail("Should have failed with unauthorized authority");
      } catch (err) {
        assert.equal(err.error.errorCode.code, "NotAuthorized", "Expected NotAuthorized error");
      }
    });
  });

  describe("ThawNft", () => {
    it("Thaw an NFT", async () => {
      await program.methods
        .thawNft()
        .accountsStrict({
          authority: creator.publicKey,
          asset: asset.publicKey,
          collection: collection.publicKey,
          collectionAuthority: collectionAuthorityPda,
          coreProgram: MPL_CORE_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

    });

    it("Fails to thaw with unauthorized authority", async () => {
      try {
        await program.methods
          .thawNft()
          .accountsStrict({
            authority: unauthorizedAuthority.publicKey,
            asset: asset.publicKey,
            collection: collection.publicKey,
            collectionAuthority: collectionAuthorityPda,
            coreProgram: MPL_CORE_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([unauthorizedAuthority])
          .rpc();
        assert.fail("Should have failed with unauthorized authority");
      } catch (err) {
        assert.equal(err.error.errorCode.code, "NotAuthorized", "Expected NotAuthorized error");
      }
    });
  });
});