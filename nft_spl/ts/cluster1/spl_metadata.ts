import wallet from "../turbin3-wallet.json"
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults"
import { 
    createMetadataAccountV3, 
    CreateMetadataAccountV3InstructionAccounts, 
    CreateMetadataAccountV3InstructionArgs,
    DataV2Args
} from "@metaplex-foundation/mpl-token-metadata";
import { createSignerFromKeypair, signerIdentity, publicKey } from "@metaplex-foundation/umi";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

// Define our Mint address
const mint = publicKey("487bQ72eUaVLDecrt1H1j2R4cxx7mJV2we7cwJ2PgtaY")

// Create a UMI connection
const umi = createUmi('https://api.devnet.solana.com');
const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(createSignerFromKeypair(umi, keypair)));

(async () => {
    try {
        // Start here
        let accounts: CreateMetadataAccountV3InstructionAccounts = { mint, mintAuthority: signer }

        let data: DataV2Args = {
          name: "Rohan Token",
          symbol: "ROH",
          uri: "https://devnet.irys.xyz/6jRb38dV76A1apsB2XGL8d84aLXatpqTSv89qDXurf27",
          sellerFeeBasisPoints: 500,
          creators: null,
          collection: null,
          uses: null,
        }
    
        let args: CreateMetadataAccountV3InstructionArgs = {
          data: data,
          isMutable: true,
          collectionDetails: null,
        }
    
        let tx = createMetadataAccountV3(umi, {
          ...accounts,
          ...args,
        })
    
        let result = await tx.sendAndConfirm(umi)
        console.log(bs58.encode(result.signature))

        // Signatuer - 4ahmmQTJQ1s2cRaTe9tjodVcxSfFjUEAEx4FU54c3FDkSjXyEhDLQHSke9WFNdm6eqYvSXCvGy5e9BwQ8xy73cYm
    } catch(e) {
        console.error(`Oops, something went wrong: ${e}`)
    }
})();
