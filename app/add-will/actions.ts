"use server";

import Arweave from "arweave";
import { z } from "zod";
import { revalidatePath } from "next/cache"; // Optional: if you want to refresh data later

// Define the input schema for the action using Zod
// Matches the client-side form schema for the file part
const MAX_FILE_SIZE = 5 * 1024 * 1024;
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
});

// Define the structure of the response from the action
interface UploadResult {
  success: boolean;
  message: string;
  transactionId?: string;
  error?: string;
}

export async function uploadWillToArweave(
  prevState: UploadResult | null, // Used for form state feedback with useFormState
  formData: FormData
): Promise<UploadResult> {
  // 1. Validate form data
  const validatedFields = UploadWillSchema.safeParse({
    willFile: formData.get("willFile"),
  });

  if (!validatedFields.success) {
    console.error("Validation Error:", validatedFields.error.flatten().fieldErrors);
    return {
      success: false,
      message: "Invalid form data.",
      error: JSON.stringify(validatedFields.error.flatten().fieldErrors),
    };
  }

  const { willFile } = validatedFields.data;

  // 2. Initialize Arweave
  // IMPORTANT: Use environment variables for configuration in production
  const arweave = Arweave.init({
    host: process.env.ARWEAVE_HOST || "localhost", // Default to localhost for ArLocal
    port: process.env.ARWEAVE_PORT || 1984,       // Default to 1984 for ArLocal
    protocol: process.env.ARWEAVE_PROTOCOL || "http", // Default to http for ArLocal
    timeout: 20000,
    logging: false, // Disable excessive logging in production
  });

  try {
    // 3. Generate or Load Wallet
    // WARNING: Generating a new key per upload is usually not ideal.
    // In a real app, load a persistent wallet securely (e.g., from env vars or secrets manager).
    // For this example, we generate one. DO NOT log the key in production.
    console.log("Generating temporary Arweave key...");
    const key = await arweave.wallets.generate();
    const addr = await arweave.wallets.jwkToAddress(key);
    console.log(`Generated temporary address: ${addr}`);

    // 4. Fund Wallet (Only for ArLocal testing)
    // This will fail if not connected to ArLocal or a similar testnet with a mint endpoint.
    // Skip or remove this in production.
    if (arweave.api.config.host === "localhost") {
        try {
            console.log(`Minting tokens for ${addr} on ArLocal...`);
            // Mint a large amount for testing
            await arweave.api.get(`mint/${addr}/10000000000000000`);
            console.log("Minting successful (ArLocal).");
            // Check balance (optional)
            // const balance = await arweave.wallets.getBalance(addr);
            // console.log(`Wallet balance: ${arweave.ar.winstonToAr(balance)} AR`);
        } catch (mintError) {
            console.error("ArLocal minting failed (is ArLocal running?):", mintError);
            // Decide if this is a fatal error for your flow
            // return { success: false, message: "Failed to fund test wallet.", error: (mintError as Error).message };
        }
    }


    // 5. Read File Data
    const fileBuffer = Buffer.from(await willFile.arrayBuffer());
    console.log(`Read ${fileBuffer.byteLength} bytes from the file.`);

    // 6. Create Transaction
    console.log("Creating Arweave transaction...");
    let transaction = await arweave.createTransaction({ data: fileBuffer }, key);
    transaction.addTag("Content-Type", willFile.type); // Use the actual file type
    // Add any other relevant tags here
    transaction.addTag("App-Name", "YourAppName"); // Example tag
    transaction.addTag("App-Version", "0.0.1");   // Example tag
    transaction.addTag("Document-Type", "Will");  // Example tag

    console.log(`Transaction created with ID: ${transaction.id}`);

    // 7. Sign Transaction
    console.log("Signing transaction...");
    await arweave.transactions.sign(transaction, key);
    console.log("Transaction signed.");

    // 8. Upload Transaction
    console.log("Uploading transaction...");
    let uploader = await arweave.transactions.getUploader(transaction);

    while (!uploader.isComplete) {
      await uploader.uploadChunk();
      console.log(
        `${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`
      );
    }
    console.log("Upload complete.");
    console.log("Uploader details:", uploader); // Contains tx ID and status

    // Basic check after upload (status might still be pending)
    // const status = await arweave.transactions.getStatus(transaction.id);
    // console.log("Transaction status after upload:", status);

    // Optional: Revalidate path if you display uploaded wills elsewhere
    // revalidatePath('/some-path-to-display-wills');

    return {
      success: true,
      message: "Will uploaded successfully!",
      transactionId: transaction.id,
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
