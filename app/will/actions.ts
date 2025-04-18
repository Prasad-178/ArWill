"use server";

import { message, result, createDataItemSigner } from "@permaweb/aoconnect";
import { processId } from "@/app/ao_config"; // Assuming processId is exported from ao_config
import { TAGS } from "@/app/ao_config";
import Arweave from 'arweave'; // Import Arweave

// Define an interface for the expected will data structure
interface WillDetails {
  userWalletAddress: string;
  pdfTxId: string;
  keyTxId: string;
  email: string; // Creator's email
  // Add other fields if returned by the handler
}

// Action to get wills created by the user
export async function getMyCreatedWillsAction(creatorEmail: string): Promise<WillDetails[] | null> {
  if (!processId) {
    throw new Error("AO Process ID not defined.");
  }
  if (!creatorEmail) {
    console.error("getMyCreatedWillsAction requires creatorEmail.");
    // Returning null or throwing an error are options
    return null;
    // throw new Error("Creator email is required to fetch wills.");
  }

  console.log(`Fetching created wills for: ${creatorEmail}`);

  try {
    // Initialize Arweave client
    const arweave = Arweave.init({
      host: process.env.ARWEAVE_HOST || "localhost", // Use env var or default
      port: process.env.ARWEAVE_PORT || 1984,       // Use env var or default
      protocol: process.env.ARWEAVE_PROTOCOL || "http", // Use env var or default
      timeout: 20000,
      logging: false,
    });

    // Generate a temporary wallet for signing this read request
    // Note: Read operations in AO often don't strictly require a specific user's
    // signature unless the handler enforces it. A temporary signer is usually fine.
    const temporaryWallet = await arweave.wallets.generate();
    const temporaryAddress = await arweave.wallets.jwkToAddress(temporaryWallet);
    console.log("Using temporary address for signing AO read:", temporaryAddress);

    // Mint tokens for the temporary wallet if running on ArLocal
    // This is primarily for local testing environments
    if (arweave.api.config.host === "localhost") {
        try {
            console.log(`Minting tokens for temporary wallet ${temporaryAddress} on ArLocal...`);
            // Adjust the mint amount as needed
            await arweave.api.get(`mint/${temporaryAddress}/1000000000000`);
            console.log("Minting successful for temporary wallet (ArLocal).");
        } catch (mintError) {
            console.error("ArLocal minting for temporary wallet failed:", mintError);
        }
    }

    // Send message to AO using the temporary wallet signer
    const messageId = await message({
      process: processId!,
      tags: [
        ...TAGS.GET_MY_CREATED_WILLS,
        { name: "creatorEmail", value: creatorEmail },
      ],
      signer: createDataItemSigner(temporaryWallet),
      data: "",
    });

    console.log("getMyCreatedWills AO message sent, ID:", messageId);

    // Get the result
    const response = await result({
      message: messageId,
      process: processId,
    });

    console.log("getMyCreatedWills AO Response:", response);

    // Messages[0].Data is expected to be a JSON string array of will objects
    if (response.Messages?.[0]?.Data) {
      try {
        const willsData = JSON.parse(response.Messages[0].Data);
        // Ensure it's an array before returning
        return Array.isArray(willsData) ? willsData : null;
      } catch (parseError) {
        console.error("Failed to parse Get-My-Created-Wills response:", parseError);
        console.error("Raw Data:", response.Messages[0].Data);
        return null;
      }
    } else {
      // Handle cases where no data is returned (e.g., no wills found)
      console.log("No created wills found or unexpected response structure.");
      return null;
    }
  } catch (error) {
    console.error("Failed to fetch created wills via AO:", error);
    // Consider throwing the error or returning null based on desired error handling
    // throw error;
    return null;
  }
}

// --- Other actions like addWill, etc. ---
