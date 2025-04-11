"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ArweaveWalletKit } from "@arweave-wallet-kit/react";
import OthentStrategy from "@arweave-wallet-kit/othent-strategy";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/app/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <ArweaveWalletKit
          config={{
            permissions: [
              "ACCESS_ADDRESS",
              "ACCESS_PUBLIC_KEY",
              "SIGN_TRANSACTION",
              "DISPATCH",
            ],
            ensurePermissions: true,
            strategies: [
              new OthentStrategy(),
            ],
          }}
        >
          <Navbar />
          <main className="flex-grow">{children}</main>
        </ArweaveWalletKit>
        <Toaster richColors />
      </body>
    </html>
  );
}
