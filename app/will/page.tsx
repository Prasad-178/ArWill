"use client";

import { useActiveAddress } from '@arweave-wallet-kit/react';
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

export default function Will() {
  const activeAddress = useActiveAddress();

  return (
    <div className="flex flex-1 items-center justify-center p-4 py-2 lg:p-6">
      <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 w-full max-w-6xl">

        <div className="w-full max-w-md lg:w-1/2 flex justify-center items-center order-last lg:order-first">
          <Image
            src="/will.jpg"
            alt="A path branching into two, symbolizing choice"
            width={600}
            height={400}
            priority
            className="object-contain rounded-lg shadow-md w-full h-auto"
          />
        </div>

        <div className="w-full max-w-md lg:w-1/2 flex justify-center">
          {activeAddress ? (
            <Card className="w-full shadow-lg">
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
          ) : (
            <Card className="w-full shadow-lg">
              <CardHeader>
                <CardTitle>Connect Your Wallet</CardTitle>
                <CardDescription>
                  Please connect your Arweave wallet using the button in the navigation bar to manage your will document.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

      </div>
    </div>
  );
}
