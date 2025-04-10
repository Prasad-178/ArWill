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
import { message, result, dryrun, createDataItemSigner } from "@permaweb/aoconnect";

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
           description: `${state.message} Transaction ID: ${state.transactionIds}`,
           duration: 5000, // Optional: duration in ms
        });
        // Reset the form visually by changing the key
        setFormKey(Date.now());
        form.reset({ willFile: undefined, guardianEmail: "" }); // Reset react-hook-form state
        if (fileInputRef.current) {
          fileInputRef.current.value = ""; // Reset the actual file input element
        }
      } else if (state.success === false) {
        toast.error("Upload Failed", {
           description: state.message + (state.error ? ` Error: ${state.error}` : ''),
           duration: 5000, // Optional: duration in ms
        });
      }
    }
  }, [state, form]); // form added to dependency array

  // Client-side validation before calling server action
  const handleFormSubmit = async (data: z.infer<typeof formSchema>) => {
    // Create FormData to send to the server action
    const formData = new FormData();
    formData.append("willFile", data.willFile);
    formData.append("guardianEmail", data.guardianEmail);

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
      <div className="flex flex-col justify-center items-center min-h-screen p-4 gap-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Upload Will Document</CardTitle>
            <CardDescription>
              Please upload the will document in PDF format. Ensure it does not
              exceed 5MB.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Use the key to allow resetting */}
            <Form {...form} key={formKey}>
              {/*
                We use form.handleSubmit for client-side validation,
                which then calls our handleFormSubmit function.
                handleFormSubmit creates FormData and calls the server action.
              */}
              <form
                onSubmit={form.handleSubmit(handleFormSubmit)}
                className="space-y-8"
              >
                <FormField
                  control={form.control}
                  name="willFile"
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  render={({ field: { onChange, value, onBlur, name, ref: rhfRef } }) => ( // Use rhfRef to avoid conflict
                    <FormItem>
                      <FormLabel>Will Document (PDF only)</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept=".pdf"
                          ref={fileInputRef} // Assign the ref here
                          onChange={(e) => {
                             // Update react-hook-form state
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
                      <FormLabel>Guardian Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="guardian@example.com"
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
                {/* Display general server action errors here if needed */}
                {state && state.success === false && !state.error?.includes('{') && ( // Avoid showing JSON validation errors here
                   <p className="text-sm font-medium text-destructive">{state.message}</p>
                )}
                <SubmitButton /> {/* Use the dedicated submit button */}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </RequireWallet>
  );
}
