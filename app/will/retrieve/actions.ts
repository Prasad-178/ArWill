"use server";

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
  decryptedPdfPath?: string;
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
      host: process.env.ARWEAVE_HOST || "localhost",
      port: process.env.ARWEAVE_PORT || 1984,
      protocol: process.env.ARWEAVE_PROTOCOL || "http",
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
      decryptedPdfPath: "will_document.pdf", // This would be a real path in production
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