"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useFormStatus } from "react-dom"; // Import hooks for server actions
import { useActionState } from "react";
import {useApi} from '@arweave-wallet-kit/react';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRef, useEffect, useState } from "react";
import { uploadWillToArweave } from "./actions"; // Import the server action
import { toast } from "sonner"; // Import toast from sonner
import RequireWallet from '../components/RequireWallet';
import { useActiveAddress } from "@arweave-wallet-kit/react";
import Image from "next/image"; // Import the Next.js Image component

// Define the maximum file size (e.g., 5MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;
// Define accepted file types
const ACCEPTED_FILE_TYPES = ["application/pdf"];

// Define the form schema using Zod (client-side validation)
const formSchema = z.object({
  willFile: z
    .instanceof(File, { message: "File is required." })
    .refine((file) => file?.size > 0, "File cannot be empty.") // Ensure file is not empty
    .refine((file) => file?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(
      (file) => ACCEPTED_FILE_TYPES.includes(file?.type),
      "Only .pdf files are accepted."
    ),
  guardianEmail: z
    .string()
    .email("Please enter a valid email address.")
    .min(1, "Guardian email is required."),
});

// Separate component for the submit button to use useFormStatus
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Uploading..." : "Upload Will"}
    </Button>
  );
}

export default function AddWillPage() {
  const activeAddress = useActiveAddress();
  const [formKey, setFormKey] = useState(Date.now()); // Key to force form reset
  const api = useApi();
  
  // useFormState hook to manage server action state
  const [state, formAction] = useActionState(uploadWillToArweave, null);

  // 1. Define your form (primarily for client-side validation)
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      willFile: undefined,
      guardianEmail: "",
    },
  });

  // Ref for the file input to reset it
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Effect to show toast messages based on server action state
  useEffect(() => {
    if (state) {
      if (state.success === true) {
        toast.success("Success!", {
           // Display the success message and transaction IDs from the state
           description: `${state.message} Transaction IDs: PDF: ${state.transactionIds?.pdfTxId}, Key: ${state.transactionIds?.keyTxId}`,
           duration: 5000, // Optional: duration in ms
        });
        // Reset the form visually by changing the key
        setFormKey(Date.now());
        form.reset({ willFile: undefined, guardianEmail: "" }); // Reset react-hook-form state
        if (fileInputRef.current) {
          fileInputRef.current.value = ""; // Reset the actual file input element
        }
      // If the action failed
      } else if (state.success === false) {
        // Show an error toast
        toast.error("Upload Failed", {
           // Display the error message and details from the state
           description: state.message + (state.error ? ` Error: ${state.error}` : ''),
           duration: 5000, // Optional: duration in ms
        });
      }
    }
    // This effect runs whenever the 'state' or 'form' object changes
  }, [state, form]);

  // Client-side validation before calling server action
  const handleFormSubmit = async (data: z.infer<typeof formSchema>) => {
    // Create FormData to send to the server action
    const formData = new FormData();
    formData.append("willFile", data.willFile);
    formData.append("guardianEmail", data.guardianEmail);
    
    // Add the activeAddress to the FormData
    if (activeAddress) {
      formData.append("userWalletAddress", activeAddress);
    } else {
      // Handle case where address is not available (optional, but good practice)
      console.error("User wallet address not available.");
      toast.error("Error", { description: "Wallet address not found. Please ensure your wallet is connected." });
      return; // Prevent form submission if address is missing
    }
    
    // Add user email from Othent if available
    if (othentDetails?.email) {
      formData.append("userEmail", othentDetails.email);
    } else {
      console.warn("User email not available from Othent.");
      // You can decide if you want to block submission or just warn
      // toast.warning("Warning", { description: "Your email address couldn't be retrieved. Some features may be limited." });
    }

    // Manually trigger the server action
    await formAction(formData);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [othentDetails, setOthentDetails] = useState<any>(null);
  console.log('othentDetails', othentDetails);
  console.log('User Email', othentDetails?.email);

  useEffect(() => {
    const getOthentDetails = async () => {
        const details = await api?.othent?.getUserDetails();
        setOthentDetails(details);
    };
    getOthentDetails();
  }, [api]);

  return (
    <RequireWallet>
      <div className="flex flex-1 items-center justify-center p-4 py-2 lg:p-6">
        {/* Inner container */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 w-full max-w-6xl">

          {/* Left Column: Form Card - Comes first in code */}
          <div className="w-full max-w-md lg:w-1/2 flex justify-center">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Upload Will Document</CardTitle>
                <CardDescription>
                  Please upload the will document in PDF format. Ensure it does not
                  exceed 10MB.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form} key={formKey}>
                  <form
                    onSubmit={form.handleSubmit(handleFormSubmit)}
                    className="space-y-8"
                  >
                    <FormField
                      control={form.control}
                      name="willFile"
                      render={({ field: { onChange, value, onBlur, name, ref: rhfRef } }) => (
                        <FormItem>
                          <FormLabel>Will Document (PDF only)</FormLabel>
                          <FormControl>
                            <Input
                              type="file"
                              accept=".pdf"
                              ref={fileInputRef}
                              onChange={(e) => {
                                onChange(e.target.files?.[0] ?? undefined);
                              }}
                              onBlur={onBlur}
                              name={name}
                            />
                          </FormControl>
                          <FormDescription>
                            Upload the finalized will document.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="guardianEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Beneficiary Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="beneficiary@example.com"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Email of the person who should have access to your will.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {state && state.success === false && !state.error?.includes('{') && (
                      <p className="text-sm font-medium text-destructive">{state.message}</p>
                    )}
                    <SubmitButton />
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Image with Text Overlay - Comes second in code */}
          {/* Added fixed height container */}
          <div className="w-full max-w-md lg:w-1/2 flex justify-center items-center h-[400px]"> {/* Consistent height */}
            {/* Relative container for overlay */}
            <div className="relative w-full h-full"> {/* Make relative container fill height */}
              <Image
                src="/vault.jpg"
                alt="Vault representing secure will storage"
                width={1000} // Aspect ratio hint
                height={1000} // Aspect ratio hint
                priority
                className="object-contain w-full h-full rounded-md" // Fill container
              />
              {/* Absolute positioned overlay for text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 p-4 text-center rounded-md">
                <p className="text-white text-2xl md:text-3xl lg:text-4xl font-bold mb-2">
                  Your Legacy, Secured Forever.
                </p>
                <p className="text-white text-sm md:text-base font-light">
                  Create smart wills with trustless access, encrypted
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </RequireWallet>
  );
}
