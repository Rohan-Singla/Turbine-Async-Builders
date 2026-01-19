import wallet from "../turbin3-wallet.json"
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults"
import { createGenericFile, createSignerFromKeypair, signerIdentity } from "@metaplex-foundation/umi"
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys"
import { readFile } from "fs/promises"

// Create a devnet connection
const umi = createUmi('https://api.devnet.solana.com');

let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);

umi.use(irysUploader({address:"https://devnet.irys.xyz"}));
umi.use(signerIdentity(signer));

(async () => {
    try {
        //1. Load image
        //2. Convert image to generic file.
        //3. Upload image

        const image = await readFile("./generug.png");

        const file = createGenericFile(image,"generug.png",{
            contentType : "image/png"
        })

        const [myUri] = await umi.uploader.upload([file]);

        console.log("Your image URI: ", myUri);

        // https://devnet.irys.xyz/6jRb38dV76A1apsB2XGL8d84aLXatpqTSv89qDXurf27
    }
    catch(error) {
        console.log("Oops.. Something went wrong", error);
    }
})();
