"use server";

import Arweave from "arweave";
import { z } from "zod";
import * as crypto from "crypto";
import { message, createDataItemSigner } from "@permaweb/aoconnect";
import { processId, TAGS } from "../../ao_config";

// Define the input schema for the action using Zod
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FILE_TYPES = ["application/pdf"];

// Custom validation for comma-separated emails
const commaSeparatedEmails = z.string()
  .min(1, "At least one beneficiary email is required.")
  .refine(value => {
    if (!value) return false;
    const emails = value.split(',').map(email => email.trim()).filter(email => email.length > 0);
    if (emails.length === 0) return false; // Must have at least one email after trimming/filtering
    // Basic check for email format - Zod's email() doesn't work directly on the list
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emails.every(email => emailRegex.test(email));
  }, "Please provide a comma-separated list of valid email addresses.");

const UploadWillSchema = z.object({
  willFile: z
    .instanceof(File)
    .refine((file) => file?.size > 0, "File is required.")
    .refine((file) => file?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(
      (file) => ACCEPTED_FILE_TYPES.includes(file?.type),
      "Only .pdf files are accepted."
    ),
  // Changed from guardianEmail to beneficiaries, using custom validation
  beneficiaries: commaSeparatedEmails,
  // Added optional Power of Attorney email
  powerOfAttorneyEmail: z
    .string()
    .email("Please enter a valid email address for the Power of Attorney.")
    .optional()
    .or(z.literal('')), // Allow empty string
  userWalletAddress: z
    .string()
    .min(1, "User wallet address is required."),
  userEmail: z
    .string()
    .email("Please enter a valid user email address.")
    .min(1, "User email is required."), // Make user email required as per handler logic
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
    beneficiaries: formData.get("beneficiaries"), // Changed from guardianEmail
    powerOfAttorneyEmail: formData.get("powerOfAttorneyEmail"), // Added POA email
    userWalletAddress: formData.get("userWalletAddress"),
    userEmail: formData.get("userEmail"),
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

  // Destructure validated data including new fields
  const { willFile, beneficiaries, powerOfAttorneyEmail, userWalletAddress, userEmail } = validatedFields.data;

  // Log the validated data
  console.log("Beneficiaries:", beneficiaries);
  console.log("Power of Attorney Email:", powerOfAttorneyEmail);
  console.log("User Wallet Address:", userWalletAddress);
  console.log("User Email:", userEmail);

  // 2. Initialize Arweave
  const arweave = Arweave.init({
    host: "localhost",
    port: 1984,
    protocol: "http",
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

    // 10. Store will information in database (AO)
    console.log("Storing will information via AO...");
    try {
      // Pass updated fields to addWill
      const res = await addWill(
        beneficiaries,
        powerOfAttorneyEmail || "", // Pass empty string if optional field is undefined/null
        pdfTxId,
        keyTxId,
        privateKey,
        wallet,
        userWalletAddress,
        userEmail // User email is now required by schema
      );
      console.log("Will added successfully via AO:", res);
    } catch (apiError) {
        console.error("Failed to add will via AO:", apiError);
        return {
          success: false,
          message: "Uploaded files to Arweave, but failed to store will information.",
          error: apiError instanceof Error ? apiError.message : String(apiError),
        };
    }

    return {
      success: true,
      message: "Will uploaded and stored successfully!",
      transactionIds: {
        pdfTxId,
        keyTxId,
      },
    };
  } catch (error) {
    console.error("Arweave upload or processing failed:", error);
    return {
      success: false,
      message: "Failed to process and upload will.",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Update the addWill function signature and tags
const addWill = async (
  beneficiaries: string, // Comma-separated string
  powerOfAttorneyEmail: string, // Optional email
  pdfTxId: string,
  keyTxId: string,
  privateKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wallet: any,
  userWalletAddress: string,
  userEmail: string // Required user email
) => {
  console.log("Adding will with params:", { beneficiaries, powerOfAttorneyEmail, pdfTxId, keyTxId, /* privateKey hidden */ userWalletAddress, userEmail });

  // Dynamically build tags
  const tags = [
    ...TAGS.CREATE_WILL,
    { name: "beneficiaries", value: beneficiaries }, // Use the beneficiaries string directly
    { name: "pdfTxId", value: pdfTxId },
    { name: "keyTxId", value: keyTxId },
    { name: "pvtKey", value: privateKey },
    { name: "userWalletAddress", value: userWalletAddress },
    { name: "email", value: userEmail } // Use userEmail for the creator's email tag
  ];

  // Conditionally add the PowerOfAttorneyEmail tag if provided
  if (powerOfAttorneyEmail && powerOfAttorneyEmail.trim().length > 0) {
    tags.push({ name: "PowerOfAttorneyEmail", value: powerOfAttorneyEmail });
  }

  console.log("Sending AO message with tags:", tags);

  try {
    const messageId = await message({
      process: processId!,
      tags: tags, // Use the dynamically built tags array
      signer: createDataItemSigner(wallet),
      data: "", // No data payload needed for this action
    });

    console.log("AO Message sent, ID:", messageId);

    // Consider adding result check here if needed
    // const response = await result({ message: messageId, process: processId! });
    // console.log("AO Create-Will Response:", response);
    // if (response?.Messages?.[0]?.Data !== 'Success') { // Adjust based on actual success message
    //   throw new Error(`AO Create-Will failed: ${response?.Messages?.[0]?.Data}`);
    // }

    return { messageId };

  } catch (err) {
    console.error("Failed to send AO message:", err);
    throw err; // Re-throw the error to be caught by the main function
  }
}
