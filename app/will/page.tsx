"use client";

import { useActiveAddress } from '@arweave-wallet-kit/react';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { ConnectButton } from '@arweave-wallet-kit/react';
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Will() {
  const activeAddress = useActiveAddress();

  return (
    <div className="flex flex-col justify-center items-center min-h-screen p-4 gap-6">
      <div className="w-full max-w-md flex justify-center">
        <ConnectButton />
      </div>
      
      {activeAddress ? (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Your Arweave Will</CardTitle>
            <CardDescription>
              Choose an option to manage your will document.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Link href="/will/upload" className="w-full">
              <Button className="w-full">Upload Will</Button>
            </Link>
            <Link href="/will/retrieve" className="w-full">
              <Button variant="outline" className="w-full">Retrieve Will</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Connect Your Wallet</CardTitle>
            <CardDescription>
              Please connect your Arweave wallet to upload or retrieve your will document.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
