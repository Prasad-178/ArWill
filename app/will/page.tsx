"use client";

import { useActiveAddress, useConnection } from '@arweave-wallet-kit/react';
import { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyCreatedWillsAction } from './actions';
import {useApi} from '@arweave-wallet-kit/react';


interface WillDetails {
  userWalletAddress: string;
  pdfTxId: string;
  keyTxId: string;
  email: string;
}

export default function Will() {
  const activeAddress = useActiveAddress();
  const { connected } = useConnection();
  const api = useApi();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  const [myWill, setMyWill] = useState<WillDetails | null>(null);
  const [isWillLoading, setIsWillLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to track if email fetch has been attempted for the current connection session
  const emailFetchAttempted = useRef(false);
  // Ref to track if will fetch has been attempted for the current email
  const willFetchAttempted = useRef(false);

  useEffect(() => {
    // Reset attempt flag if connection status changes
    if (!connected) {
      emailFetchAttempted.current = false;
      setUserEmail(null); // Clear email if disconnected
      setError(null);
      setIsEmailLoading(false);
      return;
    }

    // Only attempt fetch if connected, have API, and haven't attempted yet for this session
    if (connected && activeAddress && api?.othent && !emailFetchAttempted.current) {
      const fetchUserEmail = async () => {
        setIsEmailLoading(true);
        setError(null);
        emailFetchAttempted.current = true; // Mark as attempted
        console.log("Wallet connected. Attempting to fetch user details via Othent...");
        try {
          const details = await api.othent.getUserDetails();
          console.log("Othent User Details:", details);

          if (details?.email) {
            setUserEmail(details.email);
            console.log("User email obtained:", details.email);
          } else {
            console.warn("Could not find email in Othent user details.");
            setError("Could not determine the email associated with your wallet via Othent.");
            setUserEmail(null);
          }
        } catch (err) {
          console.error("Failed to fetch user details via Othent:", err);
          setError("Error retrieving your email information. Please try reconnecting.");
          setUserEmail(null);
        } finally {
          setIsEmailLoading(false);
        }
      };
      fetchUserEmail();
    }
  }, [connected, activeAddress, api]); // Depend only on connection/API status

  useEffect(() => {
    // Reset attempt flag if email changes (e.g., user reconnects with different account)
    if (userEmail !== willFetchAttempted.current) {
      willFetchAttempted.current = false;
      setMyWill(null); // Clear old will data if email changes
    }

    // Only attempt fetch if we have an email and haven't attempted for this email yet
    if (connected && userEmail && !willFetchAttempted.current) {
      const fetchWillStatus = async () => {
        setIsWillLoading(true);
        setError(null); // Clear previous errors specific to will fetching
        willFetchAttempted.current = userEmail; // Mark as attempted for this email

        console.log("Fetching will status for user:", userEmail);
        try {
          const result = await getMyCreatedWillsAction(userEmail);

          if (Array.isArray(result) && result.length > 0) {
            setMyWill(result[0]); // Set the first will found
            console.log("User has an existing will:", result[0]);
          } else {
            setMyWill(null); // No will found or empty array returned
            console.log("User does not have an existing will or action returned null/empty.");
          }
        } catch (err: any) { // Catch specific error type if possible
          console.error("Error fetching user will:", err);
          setError(`Failed to check your will status: ${err.message || 'Please try again.'}`);
          setMyWill(null);
        } finally {
          setIsWillLoading(false);
        }
      };
      fetchWillStatus();
    } else if (!userEmail && connected) {
      // If connected but email is null (e.g., Othent failed), ensure will loading is false
      setIsWillLoading(false);
      setMyWill(null);
      willFetchAttempted.current = false; // Reset if email becomes null
    } else if (!connected) {
      // If disconnected, ensure will loading is false
      setIsWillLoading(false);
      setMyWill(null);
      willFetchAttempted.current = false; // Reset if disconnected
    }
  }, [connected, userEmail]); // Depend only on connection status and the obtained userEmail

  const isLoading = isEmailLoading || isWillLoading;

  const renderLoadingState = () => (
    <Card className="w-full shadow-lg h-full flex flex-col justify-center">
      <CardHeader>
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );

  const renderNoWalletState = () => (
     <Card className="w-full shadow-lg h-full flex flex-col justify-center">
        <CardHeader>
          <CardTitle>Connect Your Wallet</CardTitle>
          <CardDescription>
            Please connect your Arweave wallet using the button in the navigation bar to manage your will document.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
  );

  const renderWillExistsDashboard = () => (
    <Card className="w-full shadow-lg h-full flex flex-col justify-between">
      <div>
        <CardHeader>
          <CardTitle>Manage Your Digital Will</CardTitle>
          <CardDescription className="italic pt-1">
            You have already secured your legacy. You can download your encrypted will or manage access for others.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-2 text-sm border p-3 rounded-md bg-muted/30">
            <p><strong>Your Email:</strong> {myWill?.email}</p>
            <p><strong>Encrypted PDF TXID:</strong> <span className="font-mono break-all">{myWill?.pdfTxId}</span></p>
            <p><strong>Encryption Key TXID:</strong> <span className="font-mono break-all">{myWill?.keyTxId}</span></p>
          </div>
          <Button disabled className="w-full">Download Your Will (Coming Soon)</Button>
        </CardContent>
      </div>
      <CardContent className="mt-auto border-t pt-4">
         <Link href="/will/retrieve" className="w-full" passHref>
            <Button variant="outline" className="w-full">Retrieve Another Person's Will</Button>
          </Link>
      </CardContent>
    </Card>
  );

 const renderNoWillState = () => (
    <Card className="w-full shadow-lg h-full flex flex-col justify-center">
      <CardHeader>
        <CardTitle>Manage Your Digital Will</CardTitle>
        <CardDescription className="italic pt-1">
          "The best time to plant a tree was 20 years ago. The second best time is now." - Secure your legacy today.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Link href="/will/upload" className="w-full" passHref>
          <Button className="w-full">Upload New Will</Button>
        </Link>
        <Link href="/will/retrieve" className="w-full" passHref>
          <Button variant="outline" className="w-full">Retrieve Existing Will</Button>
        </Link>
      </CardContent>
    </Card>
 );

  return (
    <div className="flex flex-1 items-center justify-center p-4 py-2 lg:p-6">
      <div className="flex flex-col lg:flex-row items-stretch justify-center gap-8 lg:gap-16 w-full max-w-6xl">

        <div className="w-full max-w-md lg:w-1/2 flex justify-center h-[450px]">
          {!connected ? (
             renderNoWalletState()
          ) : isLoading ? (
            renderLoadingState()
          ) : error && !isLoading ? (
             <Card className="w-full shadow-lg h-full flex flex-col justify-center items-center text-destructive">
                <CardHeader><CardTitle>Error</CardTitle></CardHeader>
                <CardContent><p>{error}</p></CardContent>
             </Card>
          ) : connected && !isLoading && !error ? (
            userEmail && myWill ? (
              renderWillExistsDashboard()
            ) : userEmail && !myWill ? (
              renderNoWillState()
            ) : !userEmail && !isEmailLoading ? (
               <Card className="w-full shadow-lg h-full flex flex-col justify-center items-center text-muted-foreground">
                  <CardHeader><CardTitle>Email Verification Failed</CardTitle></CardHeader>
                  <CardContent><p>Could not retrieve the email associated with your wallet via Othent.</p></CardContent>
               </Card>
            ) : (
               renderLoadingState() // Fallback to loading if state is inconsistent
            )
          ) : (
             renderNoWalletState()
          )}
        </div>

        <div className="w-full max-w-md lg:w-1/2 flex justify-center items-center h-[450px]">
          <Image
            src="/will.jpg"
            alt="A path branching into two, symbolizing choice"
            width={600}
            height={450}
            priority
            className="object-contain rounded-lg shadow-md w-full h-full"
          />
        </div>

      </div>
    </div>
  );
}
