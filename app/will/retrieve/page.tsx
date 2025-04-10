"use client";

import { useState, useEffect } from 'react';
import { useActiveAddress, useApi } from '@arweave-wallet-kit/react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import RequireWallet from '../components/RequireWallet';
import { toast } from 'sonner';
import { TAGS } from '@/app/ao_config';
import { retrieveAndDecryptWill } from './actions';

interface WillDocument {
  pdfTxId: string;
  keyTxId: string;
  privateKey: string;
  uploadDate?: string;
  guardianEmail?: string;
}

export default function RetrieveWillPage() {
  const [loading, setLoading] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [willDocument, setWillDocument] = useState<WillDocument | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const activeAddress = useActiveAddress();
  const api = useApi();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Get user email from Othent
  useEffect(() => {
    const getOthentDetails = async () => {
      try {
        const details = await api?.othent?.getUserDetails();
        console.log('Othent user details:', details);
        if (details?.email) {
          setUserEmail(details.email);
        }
      } catch (error) {
        console.error('Error getting Othent user details:', error);
      }
    };
    
    if (api?.othent) {
      getOthentDetails();
    }
  }, [api]);

  const retrieveWill = async () => {
    if (!activeAddress) {
      toast.error("Wallet not connected", {
        description: "Please connect your wallet to retrieve your will documents.",
      });
      return;
    }

    if (!userEmail) {
      toast.error("Email not available", {
        description: "We couldn't retrieve your email from your wallet. Please try again.",
      });
      return;
    }

    setLoading(true);
    setHasSearched(true);
    
    try {
      // In a real implementation, this would be an actual API call
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.example.com/retrieve-will";
      
      // Make the API call with the user's email
      const response = await fetch(`${apiUrl}?email=${encodeURIComponent(userEmail)}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_API_KEY || "dummy-api-key"}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // For demo purposes, we'll simulate the API response
      if (!data || Object.keys(data).length === 0) {
        setWillDocument(null);
        toast.info("No will document found", {
          description: "We couldn't find any will document associated with your email address.",
        });
      } else {
        // Set the will document from the API response
        setWillDocument(data);
        toast.success("Will document found", {
          description: "Your will document has been retrieved successfully.",
        });
      }
    } catch (error) {
      console.error("Error retrieving will:", error);
      toast.error("Retrieval failed", {
        description: "There was an error retrieving your will document. Please try again.",
      });
      setWillDocument(null);
    } finally {
      setLoading(false);
    }
  };

  const decryptAndDownload = async () => {
    if (!willDocument) return;
    
    setDecrypting(true);
    toast.info("Processing", {
      description: "Retrieving and decrypting your will document...",
    });
    
    try {
      // Call the server action to retrieve and decrypt the will
      const result = await retrieveAndDecryptWill(willDocument);
      
      if (result.success) {
        toast.success("Decryption successful", {
          description: "Your will document has been decrypted successfully.",
        });
        
        // In a real application, you would provide a download link here
        // For now, we'll simulate a download by creating a blob and downloading it
        
        // This is a client-side simulation of downloading a PDF
        // In a real app, you would get the actual PDF data from the server
        const dummyPdfContent = "This is a simulated PDF document";
        const blob = new Blob([dummyPdfContent], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'will_document.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        toast.error("Decryption failed", {
          description: result.message,
        });
      }
    } catch (error) {
      console.error("Error decrypting will:", error);
      toast.error("Decryption failed", {
        description: "There was an error decrypting your will document. Please try again.",
      });
    } finally {
      setDecrypting(false);
    }
  };

  const viewDocument = (txId: string) => {
    // In a real implementation, this would redirect to a document viewer or download the document
    toast.info("Viewing document", {
      description: `Accessing document with transaction ID: ${txId}`,
    });
    window.open(`https://arweave.net/${txId}`, '_blank');
  };

  return (
    <RequireWallet>
      <div className="flex flex-col justify-center items-center min-h-screen p-4 gap-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Retrieve Your Will</CardTitle>
            <CardDescription>
              Click the button below to search for a will document associated with your email address: {userEmail || "Loading..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button 
              onClick={retrieveWill} 
              disabled={loading || !userEmail}
              className="w-full"
            >
              {loading ? "Searching..." : "Retrieve My Will"}
            </Button>

            {hasSearched && !loading && (
              <div className="mt-4">
                {willDocument ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Your Will Document</h3>
                    <Card className="p-4">
                      <div className="flex flex-col gap-2">
                        <p className="text-sm"><strong>PDF Transaction ID:</strong> {willDocument.pdfTxId}</p>
                        <p className="text-sm"><strong>Key Transaction ID:</strong> {willDocument.keyTxId}</p>
                        <p className="text-sm"><strong>Private Key:</strong> <span className="font-mono text-xs break-all">{willDocument.privateKey.substring(0, 40)}...</span></p>
                        <div className="flex flex-col sm:flex-row gap-2 mt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => viewDocument(willDocument.pdfTxId)}
                            className="flex-1"
                          >
                            View Encrypted Document
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => {
                              navigator.clipboard.writeText(willDocument.privateKey);
                              toast.success("Private key copied to clipboard");
                            }}
                            className="flex-1"
                          >
                            Copy Private Key
                          </Button>
                        </div>
                        <Button 
                          onClick={decryptAndDownload}
                          disabled={decrypting}
                          className="w-full mt-2"
                        >
                          {decrypting ? "Decrypting..." : "Decrypt & Download Will"}
                        </Button>
                      </div>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center p-4 border rounded-md">
                    <p className="text-muted-foreground">No will document found for your email address.</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RequireWallet>
  );
}
