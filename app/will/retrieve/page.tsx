"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import RequireWallet from '../components/RequireWallet'; // Adjust path if needed
import { useApi, useConnection } from "@arweave-wallet-kit/react";
import Image from "next/image";
import Link from "next/link";
import { processId } from "../../ao_config"; // Keep processId if needed elsewhere, otherwise remove
import { getMyRolesAction, MyRoles, RoleInfo } from "./actions"; // Import the action and type
import { Skeleton } from "@/components/ui/skeleton";
import { List, UserCheck, FileText } from "lucide-react"; // Icons

export default function RetrieveWillListPage() {
    const api = useApi();
    const { connected } = useConnection(); // Keep connected state for Othent fetch and UI logic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [othentDetails, setOthentDetails] = useState<any>(null);
    const [roles, setRoles] = useState<MyRoles | null>(null);
    const [isLoadingOthent, setIsLoadingOthent] = useState(true);
    const [isLoadingRoles, setIsLoadingRoles] = useState(false); // Keep this for loading roles result
    const [error, setError] = useState<string | null>(null);

    // Effect 1: Fetch Othent details
    useEffect(() => {
        const getOthentDetails = async () => {
            console.log("Attempting to fetch Othent details...");
            setIsLoadingOthent(true);
            setError(null); // Clear previous errors
            setRoles(null); // Clear previous roles
            try {
                // Use a timeout for Othent details fetch as well
                const details = await Promise.race([
                    api?.othent?.getUserDetails(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Othent details fetch timed out")), 5000)) // 5 second timeout
                ]);

                // const details = await api?.othent?.getUserDetails(); // Original call
                setOthentDetails(details);
                console.log('Othent details fetched:', details);
                if (!details?.email) {
                     console.warn("Othent details fetched, but no email found.");
                }
            } catch (err: any) {
                 console.error("Error fetching Othent details:", err);
                 // Check if it's the timeout error
                 if (err.message === "Othent details fetch timed out") {
                     setError("Failed to fetch user details (timeout). Please try reconnecting your wallet or check Othent status.");
                 } else {
                     setError("Failed to fetch your user details. Please try reconnecting your wallet.");
                 }
                 setOthentDetails(null);
            } finally {
                setIsLoadingOthent(false);
            }
        };

        if (api?.othent && connected) { // Also check connected here for Othent
            getOthentDetails();
        } else if (api && !connected) {
            console.log("API loaded, but wallet not connected for Othent fetch.");
            setIsLoadingOthent(false); // Not loading if not connected
            setOthentDetails(null); // Clear details if disconnected
        } else if (!api) {
            console.log("API not yet available for Othent fetch.");
            // Keep loading until API is available or timeout occurs (handled implicitly)
        }
    }, [api, connected]); // Add connected dependency for Othent fetch too

    // Effect 2: Fetch roles once Othent email is available
    useEffect(() => {
        // Only depends on Othent loading state and email availability now
        if (!isLoadingOthent && othentDetails?.email) {
            const fetchRoles = async () => {
                setIsLoadingRoles(true);
                setError(null);
                setRoles(null);

                try {
                    // Directly call the server action with the email
                    console.log(`Calling server action getMyRolesAction for email: ${othentDetails.email}`);
                    const result = await getMyRolesAction(othentDetails.email);

                    // Handle the result from the server action (same logic as before)
                    if (result.success && result.roles) {
                        setRoles(result.roles);
                        console.log("Roles result received and set:", result.roles);
                    } else {
                        setError(result.error || "Failed to fetch your roles result.");
                        console.error("Failed to fetch roles result:", result.error);
                        setRoles(null);
                    }
                } catch (err: any) {
                    // Catch errors during the action call itself (e.g., network issues)
                    console.error("Error calling getMyRolesAction:", err);
                    setError(err.message || "An unexpected error occurred while fetching roles.");
                    setRoles(null);
                } finally {
                    setIsLoadingRoles(false);
                }
            };
            fetchRoles();
        } else if (!isLoadingOthent && !othentDetails?.email) {
            // Othent loaded, but no email
            console.log("Othent details loaded, but no email available to fetch roles.");
            setRoles(null);
            setIsLoadingRoles(false);
            // Optionally set an error if email is required
            // setError("Could not verify your email via Othent.");
        }
        // No longer depends on 'connected' for this specific effect
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [othentDetails?.email, isLoadingOthent]); // Dependencies are now just email and Othent loading state

    const renderLoading = () => (
        <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-8 w-1/2 mt-4" />
            <Skeleton className="h-6 w-full" />
        </div>
    );

    const renderError = () => (
        <div className="text-destructive space-y-2">
            <p><strong>Error:</strong> {error}</p>
            <p>Please ensure your wallet is connected and you are logged in via Othent.</p>
        </div>
    );

    const renderRolesList = (title: string, rolesInfo: RoleInfo[], icon: React.ReactNode) => (
        <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">{icon} {title}</h3>
            {rolesInfo.length > 0 ? (
                <ul className="space-y-2 list-disc list-inside pl-2">
                    {rolesInfo.map((role) => (
                        <li key={role.pdfTxId} className="text-sm">
                            <Link
                                href={`/will/retrieve/${encodeURIComponent(role.pdfTxId)}`}
                                className="text-blue-600 hover:underline hover:text-blue-800 break-all"
                            >
                                Will of: {role.email}
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground italic">None found.</p>
            )}
        </div>
    );

    // Update overall loading state (simpler now)
    const isLoading = isLoadingOthent || isLoadingRoles;

    return (
        <RequireWallet>
            <div className="flex flex-1 items-start justify-center p-4 py-6 lg:p-8">
                <div className="flex flex-col lg:flex-row items-start justify-center gap-8 lg:gap-16 w-full max-w-4xl">

                    {/* Left Column: Content Card */}
                    <div className="w-full lg:w-2/3 flex justify-center">
                        <Card className="w-full shadow-lg">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><List /> Your Associated Wills</CardTitle>
                                <CardDescription>
                                    Here are the digital wills where you are listed as a beneficiary or have Power of Attorney. Click an identifier to view details and manage access.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {isLoading ? (
                                    renderLoading()
                                ) : error ? (
                                    renderError()
                                ) : roles && (roles.BeneficiaryOf.length > 0 || roles.PowerOfAttorneyFor.length > 0) ? (
                                    // Only render lists if roles exist and have content
                                    <>
                                        {renderRolesList("Beneficiary Of", roles.BeneficiaryOf, <FileText size={20} />)}
                                        {renderRolesList("Power of Attorney For", roles.PowerOfAttorneyFor, <UserCheck size={20} />)}
                                    </>
                                ) : !isLoading && !error ? (
                                     // Handles case where roles are loaded but empty, or othent failed before roles fetch
                                     <p className="text-muted-foreground">
                                         {othentDetails?.email ? "No wills found associated with your email." : "Could not verify your email to load associated wills."}
                                     </p>
                                ) : null /* Should not be reached if logic is correct */}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Image */}
                    <div className="w-full lg:w-1/3 flex justify-center items-start pt-4 lg:pt-0">
                         <div className="relative w-full max-w-sm h-[300px] lg:h-[400px]">
                            <Image
                                src="/key.jpg" // Or a more relevant image like a list/document
                                alt="List of documents"
                                layout="fill"
                                objectFit="contain"
                                priority
                                className="rounded-lg shadow-md"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </RequireWallet>
    );
}
