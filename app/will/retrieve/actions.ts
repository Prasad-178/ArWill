"use server";

import { TAGS } from "@/app/ao_config";
import { processId } from "@/app/ao_config";
import { createDataItemSigner, message, result } from "@permaweb/aoconnect";
import Arweave from "arweave";
import * as crypto from "crypto";

interface WillDocument {
    pdfTxId: string;
    keyTxId: string;
    privateKey: string;
}

interface RetrieveResult {
    success: boolean;
    message: string;
    decryptedPdfData?: string;
    error?: string;
}

// Function to decrypt data using ChaCha20-Poly1305 (copied from upload/actions.ts)
function decryptData(
    encryptedData: Buffer,
    encryptedSymmetricKey: Buffer,
    privateKey: string
): Buffer {
    // Decrypt the symmetric key with the RSA private key
    const symmetricKey = crypto.privateDecrypt(
        {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        encryptedSymmetricKey
    );

    // Extract the nonce, authTag, and encrypted data
    const nonce = encryptedData.slice(0, 12);
    const authTag = encryptedData.slice(12, 28);
    const ciphertext = encryptedData.slice(28);

    // Create the decipher instance
    const decipher = crypto.createDecipheriv("chacha20-poly1305", symmetricKey, nonce);
    decipher.setAuthTag(authTag);

    // Decrypt the data
    const decryptedData = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return decryptedData;
}

export async function retrieveAndDecryptWill(
    willDocument: WillDocument
): Promise<RetrieveResult> {
    try {
        // Initialize Arweave
        const arweave = Arweave.init({
            host: "localhost",
            port: 1984,
            protocol: "http",
            timeout: 20000,
            logging: false,
        });

        console.log("Retrieving encrypted PDF from Arweave...");
        // Retrieve encrypted PDF from Arweave
        const encryptedPdfRetrieved = await arweave.transactions.getData(willDocument.pdfTxId, { decode: true });
        console.log(`Retrieved encrypted PDF data`);

        console.log("Retrieving encrypted symmetric key from Arweave...");
        // Retrieve encrypted symmetric key from Arweave
        const encryptedSymmetricKeyRetrieved = await arweave.transactions.getData(willDocument.keyTxId, { decode: true });
        console.log(`Retrieved encrypted symmetric key data`);

        console.log("Decrypting PDF...");
        // Decrypt the PDF
        const decryptedPdf = decryptData(
            Buffer.from(encryptedPdfRetrieved as ArrayBuffer),
            Buffer.from(encryptedSymmetricKeyRetrieved as ArrayBuffer),
            willDocument.privateKey
        );
        console.log(`Decrypted PDF size: ${decryptedPdf.byteLength} bytes`);

        // In a real server environment, you would save this to a temporary file
        // and provide a download link. For this example, we'll just return success.

        // For a real implementation, you might do something like:
        // const tempFilePath = path.join(os.tmpdir(), `will_${Date.now()}.pdf`);
        // fs.writeFileSync(tempFilePath, decryptedPdf);

        return {
            success: true,
            message: "Will document successfully retrieved and decrypted.",
            decryptedPdfData: decryptedPdf.toString('base64'),
        };
    } catch (error) {
        console.error("Error retrieving and decrypting will:", error);
        return {
            success: false,
            message: "Failed to retrieve and decrypt will document.",
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

// Function to upload data to Arweave (simplified version from upload/actions.ts)
async function uploadToArweave(
    data: Buffer,
    contentType: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    arweave: any
): Promise<string> {
    // Generate a temporary wallet for this upload
    console.log("Generating temporary Arweave key...");
    const wallet = await arweave.wallets.generate();
    const addr = await arweave.wallets.jwkToAddress(wallet);
    console.log(`Generated temporary address: ${addr}`);

    // Fund wallet (only for ArLocal testing)
    if (arweave.api.config.host === "localhost") {
        try {
            console.log(`Minting tokens for ${addr} on ArLocal...`);
            await arweave.api.get(`mint/${addr}/10000000000000000`);
            console.log("Minting successful (ArLocal).");
        } catch (mintError) {
            console.error("ArLocal minting failed (is ArLocal running?):", mintError);
        }
    }

    // Create and submit the transaction
    const transaction = await arweave.createTransaction({ data }, wallet);
    transaction.addTag("Content-Type", contentType);
    transaction.addTag("Type", "DeathCertificate");

    await arweave.transactions.sign(transaction, wallet);
    const response = await arweave.transactions.post(transaction);

    if (response.status === 200 || response.status === 202) {
        return transaction.id;
    } else {
        throw new Error(`Failed to upload data to Arweave: ${response.statusText}`);
    }
}

// Function to upload death certificate to Arweave
export async function uploadDeathCertificateToArweave(
    deathCertificate: File,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    arweave: any
): Promise<string> {
    try {

        // Read file data
        const fileBuffer = Buffer.from(await deathCertificate.arrayBuffer());
        console.log(`Read ${fileBuffer.byteLength} bytes from the death certificate.`);

        // Upload to Arweave
        console.log("Uploading death certificate to Arweave...");
        const txId = await uploadToArweave(fileBuffer, deathCertificate.type, arweave);
        console.log(`Death certificate uploaded with transaction ID: ${txId}`);

        return txId;
    } catch (error) {
        console.error("Error uploading death certificate:", error);
        throw error;
    }
}

export async function retrieveWill(
    prevState: RetrieveResult | null,
    formData: FormData
): Promise<RetrieveResult> {
    try {
        const arweave = Arweave.init({
            host: "localhost",
            port: 1984,
            protocol: "http",
            timeout: 20000,
            logging: false,
        });

        // Get the death certificate file from the form data
        const deathCertificate = formData.get("deathCertificate") as File;
        const userWalletAddress = formData.get("userWalletAddress") as string;
        const willOwnerEmail = formData.get("willOwnerEmail") as string;
        const email = formData.get("email") as string;

        // Log the received data
        console.log("Death Certificate received:", deathCertificate?.name);
        console.log("User Wallet Address:", userWalletAddress);
        console.log("User Email from Othent:", email);
        console.log("Death Certificate size:", deathCertificate?.size, "bytes");
        console.log("Death Certificate type:", deathCertificate?.type);
        console.log("Will Owner Email:", willOwnerEmail);

        // Upload the death certificate to Arweave
        const deathCertificateTxId = await uploadDeathCertificateToArweave(deathCertificate, arweave);

        const wallet = await arweave.wallets.generate();
        const addr = await arweave.wallets.jwkToAddress(wallet);
        console.log(`Generated temporary address: ${addr}`);

        console.log("Storing death certificate in database...");
        try {
            // Only call addDeathCertificate if email is available
            if (email) {
                const res = await addDeathCertificate(email, deathCertificateTxId, wallet, willOwnerEmail);
                console.log("Death certificate added successfully via AO:", res);
                if (res === false) {
                    console.log("You cannot access this will");
                    return {
                        success: false,
                        message: "You cannot access this will",
                    }
                } else {
                    console.log("pdfTxId:", res.pdfTxId);
                    console.log("keyTxId:", res.keyTxId);
                    console.log("privateKey:", res.pvtKey);

                    console.log("Retrieving encrypted PDF from Arweave...");
                    // Retrieve encrypted PDF from Arweave
                    const encryptedPdfRetrieved = await arweave.transactions.getData(res.pdfTxId, { decode: true });
                    console.log(`Retrieved encrypted PDF data`);

                    console.log("Retrieving encrypted symmetric key from Arweave...");
                    // Retrieve encrypted symmetric key from Arweave
                    const encryptedSymmetricKeyRetrieved = await arweave.transactions.getData(res.keyTxId, { decode: true });
                    console.log(`Retrieved encrypted symmetric key data`);

                    console.log("Decrypting PDF...");
                    // Decrypt the PDF
                    const decryptedPdf = decryptData(
                        Buffer.from(encryptedPdfRetrieved as ArrayBuffer),
                        Buffer.from(encryptedSymmetricKeyRetrieved as ArrayBuffer),
                        res.pvtKey
                    );
                    console.log(`Decrypted PDF size: ${decryptedPdf.byteLength} bytes`);

                    // Convert buffer to base64 to send to client
                    const decryptedPdfBase64 = decryptedPdf.toString('base64');

                    return {
                        success: true,
                        message: "Will document successfully retrieved and decrypted. Download should start shortly.",
                        decryptedPdfData: decryptedPdfBase64,
                    }
                }
            } else {
                console.warn("No email provided, skipping AO message");
                return {
                    success: false,
                    message: "Death certificate uploaded, but user email was missing for retrieval.",
                };
            }
        } catch (apiError) {
            console.error("Failed to add will via AO:", apiError);
            return {
                success: false,
                message: "Uploaded files to Arweave, but failed to store will information.",
                error: apiError instanceof Error ? apiError.message : String(apiError),
            };
        }
    } catch (error) {
        console.error("Error in retrieveWill function:", error);
        return {
            success: false,
            message: "Failed to process death certificate.",
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const addDeathCertificate = async (email: string, deathCertificateTxId: string, wallet: any, willOwnerEmail: string) => {
    console.log("Adding death certificate with params:", { email, deathCertificateTxId });
    try {
        const messageId = await message({
            process: processId!,
            tags: [
                ...TAGS.ADD_DEATH_CERTIFICATE,
                { name: "beneficiaryEmail", value: email },
                { name: "deathCertTxId", value: deathCertificateTxId },
                { name: "email", value: willOwnerEmail }
            ],
            signer: createDataItemSigner(wallet),
            data: "",
        });

        console.log("AO Message sent, ID:", messageId);

        const { Messages } = await result({
            message: messageId,
            process: processId!,
        });

        if (Messages[0].Data === "true") {
            console.log("Death certificate added successfully via AO");
            const willPvtKey = await getWillPvtKey(email, deathCertificateTxId, wallet, willOwnerEmail);
            return willPvtKey;
        } else {
            console.log("You cannot access this will");
            return false;
        }
    } catch (err) {
        console.error("Failed to send AO message:", err);
        throw err;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getWillPvtKey(email: string, deathCertificateTxId: string, wallet: any, willOwnerEmail: string) {
    try {
        const messageId = await message({
            process: processId!,
            tags: [
                ...TAGS.READ_WILL,
                { name: "accesserEmail", value: email },
                { name: "email", value: willOwnerEmail }
            ],
            signer: createDataItemSigner(wallet),
            data: "",
        });

        console.log("AO Message sent, ID:", messageId);

        const { Messages } = await result({
            message: messageId,
            process: processId!,
        });

        if (Messages[0].Data) {
            const pvtKey = Messages[0].Data;
            const jsondata = JSON.parse(pvtKey);
            return jsondata[0];
        } else {
            console.log("You cannot access this will");
            return false;
        }
    } catch (err) {
        console.error("Failed to get will PDF TxID:", err);
        throw err;
    }
}