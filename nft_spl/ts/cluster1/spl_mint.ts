import { Keypair, PublicKey, Connection, Commitment } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import wallet from "../turbin3-wallet.json"

// Import our keypair from the wallet file
const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

//Create a Solana devnet connection
const commitment: Commitment = "confirmed";
const connection = new Connection("https://api.devnet.solana.com", commitment);

const token_decimals = 1_000_000n;

// Mint address
const mint = new PublicKey("487bQ72eUaVLDecrt1H1j2R4cxx7mJV2we7cwJ2PgtaY");

(async () => {
    try {
        // Create an ATA
        const ata = await getOrCreateAssociatedTokenAccount(connection, keypair, mint, keypair.publicKey)
        console.log(`Your ata is: ${ata.address.toBase58()}`)

        // ATA - 4Kj4VeNDbvK6mjbrkWmT6E59D5VX3DiAQVk2uD14RPJ1

        // Mint to ATA
        const mintTx = await mintTo(connection, keypair, mint, ata.address, keypair, 10000_000000)
        console.log(`Your mint txid: ${mintTx}`)

        // Mint Tx - MRFoHqdgm4eWEJxPKg7rvfL7eXCtpY5JMSdFDFagCJYhsYn9CwPA99wcJuzjqZfAtCjSDijN2D6fDyuBERyW4na
        
    } catch (error) {
        console.log(`Oops, something went wrong: ${error}`)
    }
})()
