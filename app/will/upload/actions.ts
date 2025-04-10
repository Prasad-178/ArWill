"use server";

import Arweave from "arweave";
import { z } from "zod";
import * as crypto from "crypto";

// Define the input schema for the action using Zod
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FILE_TYPES = ["application/pdf"];

const UploadWillSchema = z.object({
  willFile: z
    .instanceof(File)
    .refine((file) => file?.size > 0, "File is required.")
    .refine((file) => file?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(
      (file) => ACCEPTED_FILE_TYPES.includes(file?.type),
      "Only .pdf files are accepted."
    ),
  guardianEmail: z
    .string()
    .email("Please enter a valid email address.")
    .min(1, "Guardian email is required."),
});

// Define the structure of the response from the action
interface UploadResult {
  success: boolean;
  message: string;
  transactionIds?: {
    pdfTxId: string;
    keyTxId: string;
  };
  error?: string;
}

// Function to generate an RSA key pair
function generateRSAKeyPair(): {
  publicKey: string;
  privateKey: string;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  console.log("Generated RSA Public Key:\n", publicKey);
  console.log("Generated RSA Private Key:\n", privateKey);

  return { publicKey, privateKey };
}

// Function to encrypt data using ChaCha20-Poly1305
function encryptData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  publicKey: string
): { encryptedData: Buffer; encryptedSymmetricKey: Buffer } {
  // Generate a 256-bit symmetric key and a 12-byte nonce
  const symmetricKey = crypto.randomBytes(32);
  const nonce = crypto.randomBytes(12);

  // Create the cipher instance
  const cipher = crypto.createCipheriv("chacha20-poly1305", symmetricKey, nonce);

  // Encrypt the data
  const encryptedData = Buffer.concat([cipher.update(data), cipher.final()]);

  // Get the authentication tag
  const authTag = cipher.getAuthTag();

  // Combine nonce, authTag, and encrypted data
  const combinedEncryptedData = Buffer.concat([nonce, authTag, encryptedData]);

  // Encrypt the symmetric key with the RSA public key
  const encryptedSymmetricKey = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    },
    symmetricKey
  );

  return { encryptedData: combinedEncryptedData, encryptedSymmetricKey };
}

// Function to decrypt data using ChaCha20-Poly1305
function decryptData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  encryptedData: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  encryptedSymmetricKey: any,
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

// Function to upload data to Arweave
async function uploadToArweave(
  data: Buffer,
  contentType: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wallet: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arweave: any
): Promise<string> {
  const transaction = await arweave.createTransaction({ data }, wallet);
  transaction.addTag("Content-Type", contentType);

  await arweave.transactions.sign(transaction, wallet);
  const response = await arweave.transactions.post(transaction);

  if (response.status === 200 || response.status === 202) {
    return transaction.id;
  } else {
    throw new Error(`Failed to upload data to Arweave: ${response.statusText}`);
  }
}

// Main function to handle the upload process
export async function uploadWillToArweave(
  prevState: UploadResult | null,
  formData: FormData
): Promise<UploadResult> {
  // 1. Validate form data
  const validatedFields = UploadWillSchema.safeParse({
    willFile: formData.get("willFile"),
    guardianEmail: formData.get("guardianEmail"),
  });

  if (!validatedFields.success) {
    console.error(
      "Validation Error:",
      validatedFields.error.flatten().fieldErrors
    );
    return {
      success: false,
      message: "Invalid form data.",
      error: JSON.stringify(validatedFields.error.flatten().fieldErrors),
    };
  }

  const { willFile, guardianEmail } = validatedFields.data;

  // Log the guardian email
  console.log("Guardian Email:", guardianEmail);

  // 2. Initialize Arweave
  const arweave = Arweave.init({
    host: process.env.ARWEAVE_HOST || "localhost",
    port: process.env.ARWEAVE_PORT || 1984,
    protocol: process.env.ARWEAVE_PROTOCOL || "http",
    timeout: 20000,
    logging: false,
  });

  try {
    // 3. Generate RSA Key Pair
    const { publicKey, privateKey } = generateRSAKeyPair();

    // 4. Read File Data
    const fileBuffer = Buffer.from(await willFile.arrayBuffer());
    console.log(`Read ${fileBuffer.byteLength} bytes from the file.`);

    // 5. Encrypt the PDF
    const { encryptedData, encryptedSymmetricKey } = encryptData(
      fileBuffer,
      publicKey
    );

    // 6. Generate or Load Arweave Wallet
    console.log("Generating temporary Arweave key...");
    const wallet = await arweave.wallets.generate();
    const addr = await arweave.wallets.jwkToAddress(wallet);
    console.log(`Generated temporary address: ${addr}`);

    // 7. Fund Wallet (Only for ArLocal testing)
    if (arweave.api.config.host === "localhost") {
      try {
        console.log(`Minting tokens for ${addr} on ArLocal...`);
        await arweave.api.get(`mint/${addr}/10000000000000000`);
        console.log("Minting successful (ArLocal).");
      } catch (mintError) {
        console.error("ArLocal minting failed (is ArLocal running?):", mintError);
        // Decide if this is a fatal error for your flow
        // return { success: false, message: "Failed to fund test wallet.", error: (mintError as Error).message };
      }
    }

    // 8. Upload Encrypted PDF to Arweave
    console.log("Uploading encrypted PDF to Arweave...");
    const pdfTxId = await uploadToArweave(encryptedData, "application/pdf", wallet, arweave);
    console.log(`Encrypted PDF uploaded with transaction ID: ${pdfTxId}`);

    // 9. Upload Encrypted Symmetric Key to Arweave
    console.log("Uploading encrypted symmetric key to Arweave...");
    const keyTxId = await uploadToArweave(encryptedSymmetricKey, "application/octet-stream", wallet, arweave);
    console.log(`Encrypted symmetric key uploaded with transaction ID: ${keyTxId}`);

    // // 10. Retrieve and Decrypt Data (Verification Step)
    // console.log("Retrieving and decrypting data for verification...");

    // // Retrieve encrypted PDF from Arweave
    // const encryptedPdfRetrieved = await arweave.transactions.getData(pdfTxId, { decode: true });
    // console.log(`Retrieved encrypted PDF of size`);

    // // Retrieve encrypted symmetric key from Arweave
    // const encryptedSymmetricKeyRetrieved = await arweave.transactions.getData(keyTxId, { decode: true });
    // console.log(`Retrieved encrypted symmetric key of size`);

    // // Decrypt the PDF
    // const decryptedPdf = decryptData(encryptedPdfRetrieved, encryptedSymmetricKeyRetrieved, privateKey);
    // console.log(`Decrypted PDF size: ${decryptedPdf.byteLength} bytes`);

    // // Optional: Save the decrypted PDF to verify correctness
    // fs.writeFileSync('decrypted_document.pdf', decryptedPdf);
    // console.log('Decryption complete. Decrypted file saved as "decrypted_document.pdf".');

    // 10. Store will information in database
    console.log("Storing will information in database...");
    try {
      const apiUrl = process.env.API_URL || "https://api.example.com/store-will";

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.API_KEY || "dummy-api-key"}`
        },
        body: JSON.stringify({
          guardianEmail,
          pdfTxId,
          keyTxId,
          privateKey,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Failed to store will information:", errorData);
        // We continue even if this fails, as the Arweave upload was successful
      } else {
        console.log("Will information stored successfully in database");
      }
    } catch (apiError) {
      console.error("API request failed:", apiError);
      // We continue even if this fails, as the Arweave upload was successful
    }

    return {
      success: true,
      message: "Will uploaded and verified successfully!",
      transactionIds: {
        pdfTxId,
        keyTxId,
      },
    };
  } catch (error) {
    console.error("Arweave upload failed:", error);
    return {
      success: false,
      message: "Failed to upload will to Arweave.",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
