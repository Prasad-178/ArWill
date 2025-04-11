"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useFormStatus } from "react-dom";
import { useActionState } from "react";
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
import { retrieveWill } from "./actions"; // Import the dummy function
import { toast } from "sonner";
import RequireWallet from '../components/RequireWallet';
import { useActiveAddress, useApi } from "@arweave-wallet-kit/react";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ACCEPTED_FILE_TYPES = ["application/pdf"];

// Define the form schema using Zod (client-side validation)
const formSchema = z.object({
  deathCertificate: z
    .instanceof(File, { message: "File is required." })
    .refine((file) => file?.size > 0, "File cannot be empty.")
    .refine((file) => file?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(
      (file) => ACCEPTED_FILE_TYPES.includes(file?.type),
      "Only .pdf files are accepted."
    ),
});

// Separate component for the submit button to use useFormStatus
function SubmitButton({ isFileUploaded }: { isFileUploaded: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending || !isFileUploaded}>
      {pending ? "Retrieving..." : "Retrieve Will"}
    </Button>
  );
}

export default function RetrieveWillPage() {
  const activeAddress = useActiveAddress();
  const api = useApi();
  const [formKey, setFormKey] = useState(Date.now()); // Key to force form reset
  const [isFileUploaded, setIsFileUploaded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [othentDetails, setOthentDetails] = useState<any>(null);
  
  // useActionState hook to manage server action state
  const [state, formAction] = useActionState(retrieveWill, null);

  // Define your form (primarily for client-side validation)
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      deathCertificate: undefined,
    },
  });

  // Ref for the file input to reset it
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Othent details when the component mounts
  useEffect(() => {
    const getOthentDetails = async () => {
      const details = await api?.othent?.getUserDetails();
      setOthentDetails(details);
      console.log('Othent details:', details);
    };
    
    if (api?.othent) {
      getOthentDetails();
    }
  }, [api]);

  // Effect to show toast messages based on server action state
  useEffect(() => {
    if (state) {
      if (state.success === true) {
        toast.success("Success!", {
          description: state.message,
          duration: 5000,
        });
        // Reset the form visually by changing the key
        setFormKey(Date.now());
        form.reset({ deathCertificate: undefined }); // Reset react-hook-form state
        setIsFileUploaded(false); // Reset file upload state
        if (fileInputRef.current) {
          fileInputRef.current.value = ""; // Reset the actual file input element
        }
      } else if (state.success === false) {
        // Show an error toast
        toast.error("Retrieval Failed", {
          description: state.message + (state.error ? ` Error: ${state.error}` : ''),
          duration: 5000,
        });
      }
    }
  }, [state, form]);

  // Client-side validation before calling server action
  const handleFormSubmit = async (data: z.infer<typeof formSchema>) => {
    // Create FormData to send to the server action
    const formData = new FormData();
    formData.append("deathCertificate", data.deathCertificate);
    
    // Add the activeAddress to the FormData
    if (activeAddress) {
      formData.append("userWalletAddress", activeAddress);
    } else {
      console.error("User wallet address not available.");
      toast.error("Error", { description: "Wallet address not found. Please ensure your wallet is connected." });
      return; // Prevent form submission if address is missing
    }

    // Add Othent email to the FormData if available
    if (othentDetails?.email) {
      formData.append("email", othentDetails.email);
      console.log("Adding email to form data:", othentDetails.email);
    } else {
      console.log("No Othent email available");
    }

    // Manually trigger the server action
    await formAction(formData);
  };

  return (
    <RequireWallet>
      <div className="flex flex-col justify-center items-center min-h-screen p-4 gap-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Retrieve Will Document</CardTitle>
            <CardDescription>
              Please upload a death certificate in PDF format to retrieve the will document.
              Ensure it does not exceed 5MB.
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
                  name="deathCertificate"
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  render={({ field: { onChange, value, onBlur, name, ref: rhfRef } }) => (
                    <FormItem>
                      <FormLabel>Death Certificate (PDF only)</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept=".pdf"
                          ref={fileInputRef}
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? undefined;
                            onChange(file);
                            setIsFileUploaded(!!file); // Update file upload state
                          }}
                          onBlur={onBlur}
                          name={name}
                        />
                      </FormControl>
                      <FormDescription>
                        Upload the death certificate to verify your access to the will.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Display general server action errors here if needed */}
                {state && state.success === false && !state.error?.includes('{') && (
                  <p className="text-sm font-medium text-destructive">{state.message}</p>
                )}
                <SubmitButton isFileUploaded={isFileUploaded} />
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </RequireWallet>
  );
}
