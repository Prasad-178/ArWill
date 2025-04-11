"use client";

import Link from "next/link";
import { useActiveAddress } from "@arweave-wallet-kit/react";
import { ConnectButton } from "@arweave-wallet-kit/react";
import { Button } from "@/components/ui/button";
import { Infinity } from "lucide-react";

export default function Navbar() {
  const activeAddress = useActiveAddress();

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between w-full p-4 border-b shadow-sm backdrop-blur-sm bg-sky-100/80 border-sky-200/60 dark:bg-sky-950/70 dark:border-sky-800/50">
      {/* Left side: Logo/Brand with Icon */}
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold hover:text-primary transition-colors">
        <Infinity className="h-5 w-5" />
        <span>ArWill</span>
      </Link>

      {/* Right side: Conditional Button + ConnectButton */}
      <div className="flex items-center gap-4">
        {/* Conditionally render the "Manage Will" button */}
        {activeAddress && (
          <Link href="/will" passHref>
            <Button variant="outline">Manage Will</Button>
          </Link>
        )}
        {/* Always show ConnectButton */}
        <ConnectButton
          profileModal={true}
          showBalance={false}
          showProfilePicture={true}
        />
      </div>
    </nav>
  );
} 