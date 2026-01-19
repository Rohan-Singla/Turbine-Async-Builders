import wallet from "../turbin3-wallet.json"
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults"
import { createGenericFile, createSignerFromKeypair, signerIdentity } from "@metaplex-foundation/umi"
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys"

// Create a devnet connection
const umi = createUmi('https://api.devnet.solana.com');

let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);

umi.use(irysUploader({address:"https://devnet.irys.xyz"}));
umi.use(signerIdentity(signer));

(async () => {
    try {
        // Follow this JSON structure
        // https://docs.metaplex.com/programs/token-metadata/changelog/v1.0#json-structure

        const image = "https://devnet.irys.xyz/6jRb38dV76A1apsB2XGL8d84aLXatpqTSv89qDXurf27"
        const metadata = {
            name: "Rohan Rug Day",
            symbol: "RRD",
            description: "My Turbine Rug Day LFG!",
            image: image,
            attributes: [
                {trait_type: 'bluish', value: '13'}
            ],
            properties: {
                files: [
                    {
                        type: "image/png",
                        uri: image
                    },
                ]
            },
            creators: []
        };
        const myUri = await umi.uploader.uploadJson(metadata);
        console.log("Your metadata URI: ", myUri);

        // https://gateway.irys.xyz/7FWe3VKCcyFPxKLh1tMss4TJWMX6iVmMfWaV8wBWHgU7
    }
    catch(error) {
        console.log("Oops.. Something went wrong", error);
    }
})();
