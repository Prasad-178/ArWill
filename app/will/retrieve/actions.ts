"use server";

// Import only what's needed for fetching the result
import { result, message, createDataItemSigner } from "@permaweb/aoconnect";
import { processId } from "../../ao_config"; // Use relative path
import Arweave from 'arweave'; // Import Arweave for temporary wallet
// Remove Arweave import if not used elsewhere in this specific file after cleanup
// import Arweave from "arweave";

// --- Get My Roles Action ---

// Export the RoleInfo interface so it can be imported elsewhere
export interface RoleInfo {
    email: string; // Email of the will owner
    pdfTxId: string; // Tx ID of the will PDF
}

// Update the MyRoles interface
export interface MyRoles {
    BeneficiaryOf: RoleInfo[];
    PowerOfAttorneyFor: RoleInfo[];
}

// Interface for the state returned by the action
interface GetMyRolesState {
    success: boolean;
    roles?: MyRoles;
    error?: string;
}

/**
 * Fetches the lists of wills where the given userEmail is either a
 * beneficiary or has Power of Attorney, using a temporary wallet for signing.
 * @param userEmail The email address of the user whose roles are being requested.
 * @returns GetMyRolesState object indicating success/failure and the roles.
 */
export async function getMyRolesAction(userEmail: string): Promise<GetMyRolesState> {
    if (!userEmail) {
        return { success: false, error: "User email is required." };
    }
    console.log(`getMyRolesAction called for: ${userEmail} (using temporary wallet)`);

    try {
        // 1. Initialize Arweave and generate a temporary wallet
        // Note: No gateway config needed just for key generation/signing
        const arweave = Arweave.init({});
        const temporaryWallet = await arweave.wallets.generate();
        const signer = createDataItemSigner(temporaryWallet);
        console.log("Generated temporary wallet for signing Get-My-Roles.");

        // 2. Send the message using the temporary signer
        console.log(`Sending Get-My-Roles message for ${userEmail} from server action...`);
        const msgId = await message({
            process: processId,
            tags: [
                { name: "Action", value: "Get-My-Roles" },
                { name: "userEmail", value: userEmail },
                // Add a tag indicating temporary wallet use if helpful for debugging handler
                // { name: "SignerType", value: "Temporary" }
            ],
            signer: signer,
            data: "", // No data needed for this action
        });
        console.log("Get-My-Roles message sent from server action, ID:", msgId);

        // 3. Fetch the result of the message we just sent
        console.log(`Fetching result for message (${msgId}) from process ${processId}`);
        // Add a small delay before fetching result, maybe AO needs a moment
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        const res = await result({ message: msgId, process: processId });
        console.log("Get-My-Roles Result Response:", res);

        // 4. Parse the result (Keep the existing parsing logic)
        if (res.Messages?.[0]?.Data) {
            try {
                const rolesData: MyRoles = JSON.parse(res.Messages[0].Data);
                console.log("Parsed Roles Data:", rolesData);
                if (rolesData && Array.isArray(rolesData.BeneficiaryOf) && Array.isArray(rolesData.PowerOfAttorneyFor)) {
                    return { success: true, roles: rolesData };
                } else {
                    console.error("Invalid roles data structure received:", rolesData);
                    return { success: false, error: "Received invalid roles data format from AO." };
                }
            } catch (parseError: any) {
                 console.error("Failed to parse roles data from AO message:", parseError);
                 console.error("Raw Data:", res.Messages[0].Data);
                 return { success: false, error: "Failed to parse roles data received from AO." };
            }
        } else if (res.Error) {
             console.error("AO Connect error:", res.Error);
             return { success: false, error: `AO Connect error: ${res.Error}` };
        } else {
             console.warn("No data in AO message result, assuming no roles found or message still processing.");
             const errorOutput = res.Output?.data?.output ?? 'No data or error found in result.';
              if (typeof errorOutput === 'string' && (errorOutput.includes("Failure") || errorOutput.includes("Reason"))) {
                 return { success: false, error: `Failed to get roles. AO Process Output: ${errorOutput}` };
             }
             return { success: true, roles: { BeneficiaryOf: [], PowerOfAttorneyFor: [] } };
        }

    } catch (error: any) {
        console.error("Error in getMyRolesAction (server):", error);
        const errorMessage = error.message?.includes('fetch failed')
            ? "Network error during AO interaction."
            : error.message || "An unexpected error occurred in the server action.";
        return {
            success: false,
            error: errorMessage,
        };
    }
}
