import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ConnectButton } from '@arweave-wallet-kit/react';

// Optional: Import icons if you want to use them in feature cards
// import { Lock, Clock, Users, FileText } from "lucide-react";

export default function Home() {
  return (
    // Main container: Full screen height, flexbox column, center items horizontally
    // Added padding bottom for spacing below content
    <div className="flex flex-col items-center min-h-screen bg-background p-4 md:p-8 pb-16">

      {/* Top Section: Introduction Card */}
      <Card className="flex flex-col md:flex-row max-w-5xl w-full overflow-hidden shadow-lg mb-12 md:mb-16">

        {/* Left Column (Text + Button) */}
        <div className="w-full md:w-1/2 flex flex-col justify-center items-center md:items-start text-center md:text-left p-8 lg:p-12 order-2 md:order-1">
          {/* Updated Heading */}
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight text-foreground">
            The Future of Inheritance: Secure, Permanent Wills on Arweave.
          </h1>
          {/* Updated Description */}
          <p className="text-md sm:text-lg mb-6 text-muted-foreground max-w-md">
            Create encrypted smart wills with trustless beneficiary access, powered by the permanence of the Arweave blockchain.
            {/* Disclaimer example - uncomment and modify if needed
            <span className="text-xs block mt-2">*Consult with a legal professional regarding the enforceability of digital wills in your jurisdiction.</span>
            */}
          </p>

          {/* Arweave Value Proposition */}
          <div className="mb-6 p-4 bg-secondary/50 rounded-md border border-border max-w-md w-full">
             <p className="text-sm font-semibold mb-1 text-foreground">Powered by the Permaweb.</p>
             <p className="text-sm text-muted-foreground">
               Arweave keeps your story alive — immutable, unstoppable, and forever online.
             </p>
          </div>
          <ConnectButton />
        </div>

        {/* Right Column (Image) */}
        <div className="w-full md:w-1/2 h-64 md:h-[450px] lg:h-[500px] relative order-1 md:order-2"> {/* Adjusted height */}
          <Image
            src="/family_picture.jpg" // <<<--- IMPORTANT: Use an appropriate image
            alt="Visual representation of legacy or security"
            layout="fill"
            objectFit="cover"
            quality={90}
          />
        </div>
      </Card>

      {/* --- Additional Sections --- */}
      <div className="w-full max-w-5xl px-4">

        {/* Section: How it Works */}
        <section className="mb-12 md:mb-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold mb-8 text-foreground">How It Works</h2> {/* Increased bottom margin */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {/* Step 1 Card with Hover Effect */}
            <Card className="text-left transition-transform duration-300 ease-in-out hover:scale-105 hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">1. Connect & Create</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Securely connect your Arweave wallet (or create one easily). Draft or upload your will document through our simple interface.
                </p>
              </CardContent>
            </Card>
            {/* Step 2 Card with Hover Effect */}
            <Card className="text-left transition-transform duration-300 ease-in-out hover:scale-105 hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">2. Encrypt & Store</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Your document is encrypted client-side using beneficiary details. It's then uploaded to Arweave for permanent, immutable storage.
                </p>
              </CardContent>
            </Card>
            {/* Step 3 Card with Hover Effect */}
            <Card className="text-left transition-transform duration-300 ease-in-out hover:scale-105 hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">3. Trustless Access</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Beneficiaries can request access by providing necessary verification (e.g., death certificate). The system automatically decrypts upon validation.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section: Key Features */}
        <section className="mb-16 md:mb-20 text-center"> {/* Increased bottom margin */}
          <h2 className="text-2xl sm:text-3xl font-semibold mb-8 text-foreground">Why Choose Us?</h2> {/* Increased bottom margin */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {/* Feature 1 Card with Hover Effect */}
            <Card className="text-center transition-transform duration-300 ease-in-out hover:scale-105 hover:shadow-md p-4">
              {/* Optional: <Lock className="w-8 h-8 mb-3 text-primary mx-auto" /> */}
              <CardHeader className="p-2">
                 <CardTitle className="text-lg font-medium">Permanent Storage</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <p className="text-muted-foreground text-sm">Leveraging Arweave, your will is stored forever, resistant to censorship or deletion.</p>
              </CardContent>
            </Card>
            {/* Feature 2 Card with Hover Effect */}
            <Card className="text-center transition-transform duration-300 ease-in-out hover:scale-105 hover:shadow-md p-4">
              {/* Optional: <Clock className="w-8 h-8 mb-3 text-primary mx-auto" /> */}
               <CardHeader className="p-2">
                 <CardTitle className="text-lg font-medium">End-to-End Encryption</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <p className="text-muted-foreground text-sm">Your sensitive data is encrypted before it leaves your device, ensuring privacy.</p>
              </CardContent>
            </Card>
            {/* Feature 3 Card with Hover Effect */}
            <Card className="text-center transition-transform duration-300 ease-in-out hover:scale-105 hover:shadow-md p-4">
              {/* Optional: <Users className="w-8 h-8 mb-3 text-primary mx-auto" /> */}
               <CardHeader className="p-2">
                 <CardTitle className="text-lg font-medium">Trustless Access Control</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <p className="text-muted-foreground text-sm">Automated verification processes minimize human intervention for beneficiary access.</p>
              </CardContent>
            </Card>
             {/* Feature 4 Card with Hover Effect */}
            <Card className="text-center transition-transform duration-300 ease-in-out hover:scale-105 hover:shadow-md p-4">
              {/* Optional: <FileText className="w-8 h-8 mb-3 text-primary mx-auto" /> */}
               <CardHeader className="p-2">
                 <CardTitle className="text-lg font-medium">Simple Interface</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <p className="text-muted-foreground text-sm">Easily create, manage, and understand the status of your digital will.</p>
              </CardContent>
            </Card>
          </div>
        </section>

      </div>
      {/* --- End Additional Sections --- */}

      {/* Footer Section */}
      <footer className="w-full max-w-5xl mt-8 pt-8 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          Built on the principles of permanence and privacy. Your digital legacy, secured for generations.
        </p>
        <p className="text-xs text-muted-foreground/80 mt-2">
          © {new Date().getFullYear()} ArWill.
        </p>
      </footer>

    </div>
  );
}
