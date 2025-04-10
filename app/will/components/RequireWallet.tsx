"use client";

import { useActiveAddress } from '@arweave-wallet-kit/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

export default function RequireWallet({ children }: { children: React.ReactNode }) {
  const activeAddress = useActiveAddress();
  const router = useRouter();

  useEffect(() => {
    if (!activeAddress) {
      toast.error("Wallet Required", {
        description: "Please connect your Arweave wallet first.",
        duration: 5000,
      });
      router.push('/will');
    }
  }, [activeAddress, router]);

  // Only render children if wallet is connected
  if (!activeAddress) {
    return null; // Return nothing while redirecting
  }

  return <>{children}</>;
} 